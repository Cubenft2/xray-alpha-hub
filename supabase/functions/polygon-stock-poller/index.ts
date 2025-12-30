import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PriceUpdate {
  ticker: string;
  price: number;
  change24h: number;
  day_open: number | null;
  day_high: number | null;
  day_low: number | null;
  volume: number | null;
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
    
    console.log('🚀 Polygon Stock Poller starting (market-cap priority, full coverage)...');

    // Step 1: Fetch ALL stocks from stock_cards ordered by market cap
    // This ensures highest-value stocks are always processed first
    let allStocks: { symbol: string; name: string | null; market_cap: number | null }[] = [];
    let offset = 0;
    const pageSize = 1000;
    let hasMore = true;

    console.log('📊 Fetching all stocks ordered by market cap...');

    while (hasMore) {
      const { data, error } = await supabase
        .from('stock_cards')
        .select('symbol, name, market_cap')
        .order('market_cap', { ascending: false, nullsFirst: false })
        .range(offset, offset + pageSize - 1);

      if (error) {
        console.error(`⚠️ Error fetching stocks page at offset ${offset}:`, error.message);
        break;
      }

      if (data && data.length > 0) {
        allStocks = allStocks.concat(data);
        offset += data.length;
        hasMore = data.length === pageSize;
        console.log(`📄 Fetched ${data.length} stocks (total: ${allStocks.length})`);
      } else {
        hasMore = false;
      }
    }

    if (allStocks.length === 0) {
      console.log('✅ No stocks found in stock_cards');
      return new Response(
        JSON.stringify({ status: 'complete', message: 'No stocks to process' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`📊 Total stocks to process: ${allStocks.length}`);

    // Step 2: Build a map of symbol -> polygon_ticker from polygon_assets
    // Fetch all polygon mappings with pagination
    let polygonMappings: { polygon_ticker: string; asset_id: string; assets: { symbol: string } }[] = [];
    offset = 0;
    hasMore = true;

    while (hasMore) {
      const { data, error } = await supabase
        .from('polygon_assets')
        .select('polygon_ticker, asset_id, assets!inner(symbol)')
        .eq('market', 'stocks')
        .eq('is_active', true)
        .range(offset, offset + pageSize - 1);

      if (error) {
        console.error(`⚠️ Error fetching polygon_assets at offset ${offset}:`, error.message);
        break;
      }

      if (data && data.length > 0) {
        polygonMappings = polygonMappings.concat(data as any);
        offset += data.length;
        hasMore = data.length === pageSize;
      } else {
        hasMore = false;
      }
    }

    console.log(`🔗 Found ${polygonMappings.length} polygon ticker mappings`);

    // Create lookup map: symbol -> { polygon_ticker, asset_id }
    const tickerMap = new Map<string, { polygon_ticker: string; asset_id: string }>();
    for (const mapping of polygonMappings) {
      const symbol = (mapping.assets as any).symbol;
      tickerMap.set(symbol, {
        polygon_ticker: mapping.polygon_ticker,
        asset_id: mapping.asset_id
      });
    }

    // Step 3: Filter stocks that have polygon tickers and prepare for fetching
    const stocksToFetch = allStocks
      .filter(stock => tickerMap.has(stock.symbol))
      .map(stock => ({
        symbol: stock.symbol,
        name: stock.name,
        market_cap: stock.market_cap,
        ...tickerMap.get(stock.symbol)!
      }));

    console.log(`📈 Stocks with polygon tickers: ${stocksToFetch.length} (out of ${allStocks.length})`);

    if (stocksToFetch.length === 0) {
      return new Response(
        JSON.stringify({ status: 'complete', message: 'No stocks with polygon tickers' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Step 4: Fetch prices from Polygon in parallel batches
    const priceUpdates: PriceUpdate[] = [];
    const batchSize = 100; // Increased parallel batch size for faster processing
    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < stocksToFetch.length; i += batchSize) {
      const batch = stocksToFetch.slice(i, i + batchSize);
      
      const promises = batch.map(async (stock) => {
        try {
          const url = `https://api.polygon.io/v2/aggs/ticker/${stock.polygon_ticker}/prev?apiKey=${polygonKey}`;
          const response = await fetch(url);
          
          if (!response.ok) {
            if (response.status !== 404) {
              console.warn(`⚠️ Failed to fetch ${stock.symbol}: ${response.status}`);
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
              ticker: stock.symbol,
              price,
              change24h: Math.round(change24h * 100) / 100,
              day_open: result.o || null,
              day_high: result.h || null,
              day_low: result.l || null,
              volume: result.v || null,
              display: stock.name || stock.symbol,
              asset_id: stock.asset_id,
              source: 'polygon',
            };
          }
          
          return null;
        } catch (error) {
          console.error(`❌ Error fetching ${stock.symbol}:`, error);
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

      // Progress logging every 500 stocks
      if (successCount > 0 && successCount % 500 < batchSize) {
        console.log(`⏳ Progress: ${successCount}/${stocksToFetch.length} stocks updated`);
      }

      // Small delay between batches to be nice to Polygon API
      if (i + batchSize < stocksToFetch.length) {
        await new Promise(resolve => setTimeout(resolve, 25));
      }
    }

    // Step 5: Batch upsert to live_prices
    if (priceUpdates.length > 0) {
      // Upsert in batches of 500 to avoid payload limits
      const upsertBatchSize = 500;
      for (let i = 0; i < priceUpdates.length; i += upsertBatchSize) {
        const batch = priceUpdates.slice(i, i + upsertBatchSize);
        
        const { error: upsertError } = await supabase
          .from('live_prices')
          .upsert(
            batch.map(update => ({
              ticker: update.ticker,
              price: update.price,
              change24h: update.change24h,
              day_open: update.day_open,
              day_high: update.day_high,
              day_low: update.day_low,
              volume: update.volume,
              display: update.display,
              asset_id: update.asset_id,
              source: update.source,
              updated_at: new Date().toISOString()
            })),
            { onConflict: 'ticker', ignoreDuplicates: false }
          );

        if (upsertError) {
          console.error(`❌ Upsert error (batch ${i / upsertBatchSize + 1}):`, upsertError);
        }
      }

      console.log(`✅ Updated ${priceUpdates.length} stock prices in live_prices`);

      // Step 6: Also update stock_cards with fresh prices
      for (let i = 0; i < priceUpdates.length; i += upsertBatchSize) {
        const batch = priceUpdates.slice(i, i + upsertBatchSize);
        
        const { error: stockCardsError } = await supabase
          .from('stock_cards')
          .upsert(
            batch.map(update => ({
              symbol: update.ticker,
              price_usd: update.price,
              change_pct: update.change24h,
              open_price: update.day_open,
              high_price: update.day_high,
              low_price: update.day_low,
              volume: update.volume ? Math.round(update.volume) : null,
              price_updated_at: new Date().toISOString()
            })),
            { onConflict: 'symbol', ignoreDuplicates: false }
          );

        if (stockCardsError) {
          console.error(`❌ stock_cards upsert error (batch ${i / upsertBatchSize + 1}):`, stockCardsError);
        }
      }

      console.log(`✅ Updated ${priceUpdates.length} stock prices in stock_cards`);
    }

    const duration = Date.now() - startTime;
    
    // Log top 5 by market cap that were updated
    const top5 = stocksToFetch.slice(0, 5).map(s => s.symbol).join(', ');
    console.log(`🏆 Top 5 stocks processed: ${top5}`);
    console.log(`🏁 Completed in ${duration}ms: ${successCount} success, ${errorCount} errors`);

    return new Response(
      JSON.stringify({
        status: 'success',
        total_stocks_in_db: allStocks.length,
        stocks_with_polygon: stocksToFetch.length,
        prices_updated: priceUpdates.length,
        errors: errorCount,
        duration_ms: duration,
        top_5_processed: stocksToFetch.slice(0, 5).map(s => s.symbol),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Polygon Stock Poller error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
