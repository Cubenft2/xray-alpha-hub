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
    
    console.log('🚀 Polygon REST Poller starting...');

    // Get all active crypto tickers with polygon_ticker
    const { data: tickers, error: tickerError } = await supabase
      .from('ticker_mappings')
      .select('symbol, polygon_ticker, display_name')
      .not('polygon_ticker', 'is', null)
      .eq('type', 'crypto')
      .eq('is_active', true)
      .limit(100); // Process top 100 for now

    if (tickerError) {
      throw new Error(`Failed to fetch tickers: ${tickerError.message}`);
    }

    if (!tickers || tickers.length === 0) {
      console.log('⚠️ No mapped tickers found');
      return new Response(
        JSON.stringify({ status: 'skipped', reason: 'No mapped tickers' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`📊 Fetching prices for ${tickers.length} tickers via REST API`);

    const priceUpdates: PriceUpdate[] = [];
    const batchSize = 20;
    let successCount = 0;
    let errorCount = 0;

    // Process tickers in batches
    for (let i = 0; i < tickers.length; i += batchSize) {
      const batch = tickers.slice(i, i + batchSize);
      
      // Fetch prices in parallel for each batch
      const promises = batch.map(async (ticker) => {
        try {
          // Polygon ticker format: X:BTCUSD
          const polygonTicker = ticker.polygon_ticker;
          
          // Use Polygon's previous close endpoint (unlimited REST API)
          const url = `https://api.polygon.io/v2/aggs/ticker/${polygonTicker}/prev?apiKey=${polygonKey}`;
          
          const response = await fetch(url);
          
          if (!response.ok) {
            console.warn(`⚠️ Failed to fetch ${ticker.symbol}: ${response.status}`);
            return null;
          }

          const data = await response.json();
          
          if (data.results && data.results.length > 0) {
            const result = data.results[0];
            const price = result.c || result.vw || 0; // close or vwap
            const open = result.o || price;
            const change24h = open > 0 ? ((price - open) / open) * 100 : 0;

            return {
              ticker: polygonTicker,
              price,
              change24h: Math.round(change24h * 100) / 100,
              display: ticker.display_name || ticker.symbol,
            };
          }
          
          return null;
        } catch (error) {
          console.error(`❌ Error fetching ${ticker.symbol}:`, error);
          return null;
        }
      });

      const results = await Promise.all(promises);
      
      for (const result of results) {
        if (result) {
          priceUpdates.push(result);
          successCount++;
        } else {
          errorCount++;
        }
      }

      // Small delay between batches to avoid rate limiting
      if (i + batchSize < tickers.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    // Batch upsert to live_prices
    if (priceUpdates.length > 0) {
      const { error: upsertError } = await supabase
        .from('live_prices')
        .upsert(
          priceUpdates.map(update => ({
            ...update,
            updated_at: new Date().toISOString()
          })),
          { onConflict: 'ticker', ignoreDuplicates: false }
        );

      if (upsertError) {
        console.error('❌ Upsert error:', upsertError);
      } else {
        console.log(`✅ Updated ${priceUpdates.length} prices in live_prices`);
      }
    }

    const duration = Date.now() - startTime;
    
    console.log(`🏁 Completed in ${duration}ms: ${successCount} success, ${errorCount} errors`);

    return new Response(
      JSON.stringify({
        status: 'success',
        tickers_processed: tickers.length,
        prices_updated: priceUpdates.length,
        errors: errorCount,
        duration_ms: duration,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Polygon REST Poller error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
