import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Top 50 stocks by market cap + crypto-related stocks - always fetch first
const PRIORITY_STOCKS = [
  'AAPL', 'MSFT', 'NVDA', 'GOOGL', 'GOOG', 'AMZN', 'META', 'BRK.B', 'TSLA', 'LLY',
  'UNH', 'V', 'AVGO', 'WMT', 'XOM', 'JPM', 'MA', 'PG', 'JNJ', 'ORCL',
  'HD', 'COST', 'MRK', 'ABBV', 'CVX', 'CRM', 'KO', 'AMD', 'NFLX', 'BAC',
  'PEP', 'TMO', 'ADBE', 'ACN', 'LIN', 'MCD', 'CSCO', 'WFC', 'ABT', 'QCOM',
  'DHR', 'INTC', 'INTU', 'TXN', 'DIS', 'GE', 'IBM', 'CAT', 'VZ', 'CMCSA',
  // Crypto-related stocks
  'COIN', 'MSTR', 'MARA', 'RIOT', 'CLSK', 'HOOD', 'HUT', 'HIVE', 'BITF',
  // Popular ETFs
  'SPY', 'QQQ', 'IWM', 'DIA', 'VOO'
];

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
    
    console.log('🚀 Polygon Stock Poller starting (priority-first mode)...');

    const batchLimit = 5000; // Process all stocks per run (~4,973 total)

    // QUERY 1: Fetch priority stocks FIRST (guaranteed coverage for top stocks)
    const { data: priorityTickers, error: priorityError } = await supabase
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
      .eq('market', 'stocks')
      .eq('is_active', true)
      .in('assets.symbol', PRIORITY_STOCKS);

    if (priorityError) {
      console.error('⚠️ Priority query error:', priorityError.message);
    }

    console.log(`📌 Found ${priorityTickers?.length || 0} priority stock tickers`);

    // Get list of priority asset_ids to exclude from second query
    const priorityAssetIds = (priorityTickers || []).map((t: any) => t.asset_id);

    // QUERY 2: Fetch ALL other stocks (excluding priority to avoid duplicates)
    let otherTickers: any[] = [];
    if (priorityAssetIds.length > 0) {
      const { data, error } = await supabase
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
        .eq('market', 'stocks')
        .eq('is_active', true)
        .not('asset_id', 'in', `(${priorityAssetIds.join(',')})`)
        .order('polygon_ticker')
        .range(0, batchLimit - 1);

      if (error) {
        console.error('⚠️ Other tickers query error:', error.message);
      } else {
        otherTickers = data || [];
      }
    } else {
      // No priority tickers found, fetch all
      const { data, error } = await supabase
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
        .eq('market', 'stocks')
        .eq('is_active', true)
        .order('polygon_ticker')
        .range(0, batchLimit - 1);

      if (error) {
        console.error('⚠️ All tickers query error:', error.message);
      } else {
        otherTickers = data || [];
      }
    }

    // COMBINE: Priority first, then the rest
    const tickers = [...(priorityTickers || []), ...otherTickers];

    if (!tickers || tickers.length === 0) {
      console.log('✅ No stock tickers to process');
      return new Response(
        JSON.stringify({ status: 'complete', message: 'No stocks to process' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`📊 Fetching prices for ${tickers.length} stock tickers (${priorityTickers?.length || 0} priority + ${otherTickers.length} others)`);

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
          
          // Use Polygon's previous close endpoint for stocks
          const url = `https://api.polygon.io/v2/aggs/ticker/${polygonTicker}/prev?apiKey=${polygonKey}`;
          
          const response = await fetch(url);
          
          if (!response.ok) {
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
              ticker: asset.symbol,  // Use simple format (AAPL) not Polygon format
              price,
              change24h: Math.round(change24h * 100) / 100,
              day_open: result.o || null,
              day_high: result.h || null,
              day_low: result.l || null,
              volume: result.v || null,
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

      // Small delay between batches
      if (i + batchSize < tickers.length) {
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }

    // Batch upsert to live_prices with asset_id, source, and OHLC data
    if (priceUpdates.length > 0) {
      const { error: upsertError } = await supabase
        .from('live_prices')
        .upsert(
          priceUpdates.map(update => ({
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
        console.error('❌ Upsert error:', upsertError);
      } else {
        console.log(`✅ Updated ${priceUpdates.length} stock prices in live_prices`);
      }
    }

    const duration = Date.now() - startTime;
    
    console.log(`🏁 Completed in ${duration}ms: ${successCount} success, ${errorCount} errors`);

    return new Response(
      JSON.stringify({
        status: 'success',
        priority_count: priorityTickers?.length || 0,
        other_count: otherTickers.length,
        total_processed: tickers.length,
        prices_updated: priceUpdates.length,
        errors: errorCount,
        duration_ms: duration,
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
