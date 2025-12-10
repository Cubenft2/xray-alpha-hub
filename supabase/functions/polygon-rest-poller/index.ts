import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PriceUpdate {
  ticker: string;
  price: number;
  change24h: number;
  display: string;
  asset_id: string;
  source: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const polygonKey = Deno.env.get('POLYGON_API_KEY');

    if (!polygonKey) {
      throw new Error('POLYGON_API_KEY not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    
    console.log('🚀 Polygon REST Crypto Poller starting...');

    // Get offset from request body or default to 0
    const body = await req.json().catch(() => ({}));
    const offset = body.offset || 0;
    const batchLimit = 500; // Process 500 crypto per run

    // Query NEW normalized schema: polygon_assets joined with assets
    const { data: tickers, error: tickerError } = await supabase
      .from('polygon_assets')
      .select(`
        polygon_ticker,
        asset_id,
        assets!inner (
          id,
          symbol,
          name
        )
      `)
      .eq('market', 'crypto')
      .eq('is_active', true)
      .order('polygon_ticker')
      .range(offset, offset + batchLimit - 1);

    if (tickerError) {
      throw new Error(`Failed to fetch tickers: ${tickerError.message}`);
    }

    if (!tickers || tickers.length === 0) {
      console.log('✅ No more crypto tickers to process');
      return new Response(
        JSON.stringify({ status: 'complete', message: 'All crypto processed' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`📊 Fetching prices for ${tickers.length} crypto tickers (offset: ${offset})`);

    const priceUpdates: PriceUpdate[] = [];
    const batchSize = 50; // Parallel batch size
    let successCount = 0;
    let errorCount = 0;

    // Process tickers in parallel batches
    for (let i = 0; i < tickers.length; i += batchSize) {
      const batch = tickers.slice(i, i + batchSize);
      
      const promises = batch.map(async (ticker: any) => {
        try {
          const polygonTicker = ticker.polygon_ticker;
          const asset = ticker.assets;
          
          // Use Polygon's previous close endpoint (unlimited REST API)
          const url = `https://api.polygon.io/v2/aggs/ticker/${polygonTicker}/prev?apiKey=${polygonKey}`;
          
          const response = await fetch(url);
          
          if (!response.ok) {
            // 404 is common for low-volume crypto, don't log
            if (response.status !== 404) {
              console.warn(`⚠️ Failed to fetch ${asset.symbol}: ${response.status}`);
            }
            return null;
          }

          const data = await response.json();
          
          if (data.results && data.results.length > 0) {
            const result = data.results[0];
            const price = result.c || result.vw || 0;
            const open = result.o || price;
            const change24h = open > 0 ? ((price - open) / open) * 100 : 0;

            return {
              ticker: asset.symbol,  // Use simple format (BTC) not Polygon format (X:BTCUSD)
              price,
              change24h: Math.round(change24h * 100) / 100,
              display: asset.name || asset.symbol,
              asset_id: ticker.asset_id,
              source: 'polygon',
            };
          }
          
          return null;
        } catch (error) {
          console.error(`❌ Error fetching ${ticker.assets?.symbol}:`, error);
          return null;
        }
      });

      const results = await Promise.all(promises);
      
      for (const result of results) {
        if (result && result.price > 0) {
          priceUpdates.push(result);
          successCount++;
        } else {
          errorCount++;
        }
      }

      // Small delay between batches to avoid rate limiting
      if (i + batchSize < tickers.length) {
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }

    // Batch upsert to live_prices with asset_id and source
    if (priceUpdates.length > 0) {
      const { error: upsertError } = await supabase
        .from('live_prices')
        .upsert(
          priceUpdates.map(update => ({
            ticker: update.ticker,
            price: update.price,
            change24h: update.change24h,
            display: update.display,
            asset_id: update.asset_id,
            source: update.source,
            updated_at: new Date().toISOString()
          })),
          { onConflict: 'ticker', ignoreDuplicates: false }
        );

      if (upsertError) {
        console.error('❌ Upsert error:', upsertError);
      } else {
        console.log(`✅ Updated ${priceUpdates.length} crypto prices in live_prices`);
      }
    }

    const duration = Date.now() - startTime;
    const nextOffset = offset + tickers.length;
    const hasMore = tickers.length === batchLimit;
    
    console.log(`🏁 Completed in ${duration}ms: ${successCount} success, ${errorCount} errors`);

    return new Response(
      JSON.stringify({
        status: 'success',
        crypto_processed: tickers.length,
        prices_updated: priceUpdates.length,
        errors: errorCount,
        offset: offset,
        next_offset: hasMore ? nextOffset : null,
        has_more: hasMore,
        duration_ms: duration,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Polygon REST Crypto Poller error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
