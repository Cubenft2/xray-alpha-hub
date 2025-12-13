import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SnapshotTicker {
  ticker: string;
  day?: {
    o: number;
    h: number;
    l: number;
    c: number;
    v: number;
    vw: number;
  };
  lastTrade?: {
    p: number;
    s: number;
    t: number;
  };
  min?: {
    o: number;
    h: number;
    l: number;
    c: number;
    v: number;
  };
  prevDay?: {
    o: number;
    h: number;
    l: number;
    c: number;
    v: number;
    vw: number;
  };
  todaysChange?: number;
  todaysChangePerc?: number;
  updated?: number;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const apiKey = Deno.env.get('MASSIVE_API_KEY') || Deno.env.get('POLYGON_API_KEY');

    if (!apiKey) {
      throw new Error('MASSIVE_API_KEY or POLYGON_API_KEY not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    
    console.log('🚀 Massive Crypto Unified Snapshot starting...');

    // Use unified snapshot endpoint - ONE call returns ALL crypto tickers
    const baseUrl = Deno.env.get('MASSIVE_BASE_URL') || 'https://api.polygon.io';
    const snapshotUrl = `${baseUrl}/v2/snapshot/locale/global/markets/crypto/tickers?apiKey=${apiKey}`;
    
    console.log('📡 Fetching unified crypto snapshot...');
    const response = await fetch(snapshotUrl);
    
    if (!response.ok) {
      throw new Error(`Snapshot API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const tickers: SnapshotTicker[] = data.tickers || [];
    
    console.log(`📊 Received ${tickers.length} tickers from unified snapshot`);

    // Filter to USD pairs only (X:*USD format)
    const usdPairs = tickers.filter(t => 
      t.ticker?.startsWith('X:') && 
      t.ticker?.endsWith('USD') &&
      (t.lastTrade?.p || t.day?.c || t.prevDay?.c)
    );
    
    console.log(`💰 Found ${usdPairs.length} USD pairs with valid prices`);

    // Get all crypto assets from our assets table for matching
    const { data: assets } = await supabase
      .from('assets')
      .select('id, symbol, name, logo_url')
      .eq('type', 'crypto');

    const assetMap = new Map<string, any>();
    (assets || []).forEach(asset => {
      assetMap.set(asset.symbol.toUpperCase(), asset);
    });

    // Build price updates
    const priceUpdates: any[] = [];
    let matched = 0;
    let unmatched = 0;

    for (const ticker of usdPairs) {
      // Extract symbol from X:BTCUSD -> BTC
      const symbol = ticker.ticker.replace('X:', '').replace('USD', '');
      const asset = assetMap.get(symbol);

      // Get best available price
      const price = ticker.lastTrade?.p || ticker.day?.c || ticker.prevDay?.c || 0;
      
      if (price <= 0) continue;

      // Calculate 24h change
      const change24h = ticker.todaysChangePerc ?? 0;

      // Get OHLC data
      const dayOpen = ticker.day?.o || ticker.prevDay?.o || null;
      const dayHigh = ticker.day?.h || ticker.prevDay?.h || null;
      const dayLow = ticker.day?.l || ticker.prevDay?.l || null;
      const volume = ticker.day?.v || ticker.prevDay?.v || null;

      priceUpdates.push({
        ticker: symbol,
        price,
        change24h: Math.round(change24h * 100) / 100,
        display: asset?.name || symbol,
        asset_id: asset?.id || null,
        source: 'massive',
        day_open: dayOpen,
        day_high: dayHigh,
        day_low: dayLow,
        volume,
        is_delayed: false,
        last_trade_ts: ticker.lastTrade?.t ? new Date(ticker.lastTrade.t).toISOString() : null,
        updated_at: new Date().toISOString(),
      });

      if (asset) {
        matched++;
      } else {
        unmatched++;
      }
    }

    console.log(`🔗 Matched ${matched} to assets, ${unmatched} unmatched`);

    // Batch upsert to live_prices
    if (priceUpdates.length > 0) {
      // Split into batches of 500 for large upserts
      const batchSize = 500;
      let upsertedTotal = 0;

      for (let i = 0; i < priceUpdates.length; i += batchSize) {
        const batch = priceUpdates.slice(i, i + batchSize);
        
        const { error: upsertError } = await supabase
          .from('live_prices')
          .upsert(batch, { onConflict: 'ticker', ignoreDuplicates: false });

        if (upsertError) {
          console.error(`❌ Upsert batch error:`, upsertError);
        } else {
          upsertedTotal += batch.length;
        }
      }

      console.log(`✅ Upserted ${upsertedTotal} prices to live_prices`);
    }

    const duration = Date.now() - startTime;
    
    console.log(`🏁 Massive Crypto Snapshot completed in ${duration}ms`);

    return new Response(
      JSON.stringify({
        status: 'success',
        snapshot_tickers: tickers.length,
        usd_pairs: usdPairs.length,
        prices_updated: priceUpdates.length,
        matched,
        unmatched,
        duration_ms: duration,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Massive Crypto Snapshot error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
