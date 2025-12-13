import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ForexTicker {
  ticker: string;
  day?: {
    o: number;
    h: number;
    l: number;
    c: number;
  };
  lastQuote?: {
    a: number; // ask
    b: number; // bid
    t: number; // timestamp
  };
  min?: {
    o: number;
    h: number;
    l: number;
    c: number;
  };
  prevDay?: {
    o: number;
    h: number;
    l: number;
    c: number;
  };
  todaysChange?: number;
  todaysChangePerc?: number;
  updated?: number;
}

// Major forex pairs to prioritize
const PRIORITY_PAIRS = [
  'C:EURUSD', 'C:GBPUSD', 'C:USDJPY', 'C:USDCHF', 'C:AUDUSD', 'C:USDCAD',
  'C:NZDUSD', 'C:EURGBP', 'C:EURJPY', 'C:GBPJPY', 'C:XAUUSD', 'C:XAGUSD',
];

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
    
    console.log('🚀 Massive Forex Unified Snapshot starting...');

    // Use unified snapshot endpoint for forex
    const baseUrl = Deno.env.get('MASSIVE_BASE_URL') || 'https://api.polygon.io';
    const snapshotUrl = `${baseUrl}/v2/snapshot/locale/global/markets/forex/tickers?apiKey=${apiKey}`;
    
    console.log('📡 Fetching unified forex snapshot...');
    const response = await fetch(snapshotUrl);
    
    if (!response.ok) {
      throw new Error(`Forex Snapshot API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const tickers: ForexTicker[] = data.tickers || [];
    
    console.log(`📊 Received ${tickers.length} forex tickers from unified snapshot`);

    // Filter to C: prefixed pairs with valid prices
    const validPairs = tickers.filter(t => 
      t.ticker?.startsWith('C:') &&
      (t.lastQuote?.a || t.lastQuote?.b || t.day?.c || t.prevDay?.c)
    );
    
    console.log(`💱 Found ${validPairs.length} valid forex pairs`);

    // Get existing forex assets for matching
    const { data: assets } = await supabase
      .from('assets')
      .select('id, symbol, name')
      .eq('type', 'forex');

    const assetMap = new Map<string, any>();
    (assets || []).forEach(asset => {
      // Map both display symbol (EUR/USD) and raw symbol (EURUSD)
      assetMap.set(asset.symbol.toUpperCase(), asset);
      assetMap.set(asset.symbol.replace('/', '').toUpperCase(), asset);
    });

    // Build price updates
    const priceUpdates: any[] = [];
    let matched = 0;
    let unmatched = 0;

    for (const ticker of validPairs) {
      // Extract symbol from C:EURUSD -> EURUSD
      const rawSymbol = ticker.ticker.replace('C:', '');
      
      // Create display symbol (EUR/USD)
      const displaySymbol = rawSymbol.length === 6 
        ? `${rawSymbol.slice(0, 3)}/${rawSymbol.slice(3)}` 
        : rawSymbol;
      
      const asset = assetMap.get(rawSymbol) || assetMap.get(displaySymbol.replace('/', ''));

      // Calculate mid price from bid/ask, or use close
      let price = 0;
      if (ticker.lastQuote?.a && ticker.lastQuote?.b) {
        price = (ticker.lastQuote.a + ticker.lastQuote.b) / 2;
      } else if (ticker.day?.c) {
        price = ticker.day.c;
      } else if (ticker.prevDay?.c) {
        price = ticker.prevDay.c;
      }
      
      if (price <= 0) continue;

      // Calculate 24h change
      const change24h = ticker.todaysChangePerc ?? 0;

      // Get OHLC data
      const dayOpen = ticker.day?.o || ticker.prevDay?.o || null;
      const dayHigh = ticker.day?.h || ticker.prevDay?.h || null;
      const dayLow = ticker.day?.l || ticker.prevDay?.l || null;

      priceUpdates.push({
        ticker: ticker.ticker, // Keep full C:EURUSD format for forex
        price,
        change24h: Math.round(change24h * 10000) / 10000, // Forex uses more precision
        display: displaySymbol,
        asset_id: asset?.id || null,
        source: 'massive',
        day_open: dayOpen,
        day_high: dayHigh,
        day_low: dayLow,
        volume: null, // Forex doesn't have volume in same way
        is_delayed: false,
        last_trade_ts: ticker.lastQuote?.t ? new Date(ticker.lastQuote.t).toISOString() : null,
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
      const { error: upsertError } = await supabase
        .from('live_prices')
        .upsert(priceUpdates, { onConflict: 'ticker', ignoreDuplicates: false });

      if (upsertError) {
        console.error(`❌ Upsert error:`, upsertError);
      } else {
        console.log(`✅ Upserted ${priceUpdates.length} forex prices to live_prices`);
      }
    }

    const duration = Date.now() - startTime;
    
    console.log(`🏁 Massive Forex Snapshot completed in ${duration}ms`);

    return new Response(
      JSON.stringify({
        status: 'success',
        snapshot_tickers: tickers.length,
        valid_pairs: validPairs.length,
        prices_updated: priceUpdates.length,
        matched,
        unmatched,
        duration_ms: duration,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Massive Forex Snapshot error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
