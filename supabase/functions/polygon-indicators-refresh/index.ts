import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface IndicatorResult {
  ticker: string;
  indicator_type: string;
  timeframe: string;
  timestamp: string;
  value: Record<string, unknown>;
  expires_at: string;
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
    
    console.log('🚀 Polygon Indicators Refresh starting...');

    // Get offset from request body
    const body = await req.json().catch(() => ({}));
    const offset = body.offset || 0;
    const assetType = body.type || 'crypto'; // 'crypto' or 'stock'
    const batchLimit = 100; // Process 100 assets per run

    // Get active tickers with polygon_ticker
    const { data: tickers, error: tickerError } = await supabase
      .from('ticker_mappings')
      .select('symbol, polygon_ticker, type')
      .not('polygon_ticker', 'is', null)
      .eq('type', assetType)
      .eq('is_active', true)
      .order('symbol')
      .range(offset, offset + batchLimit - 1);

    if (tickerError) {
      throw new Error(`Failed to fetch tickers: ${tickerError.message}`);
    }

    if (!tickers || tickers.length === 0) {
      console.log(`✅ No more ${assetType} tickers to process`);
      return new Response(
        JSON.stringify({ status: 'complete', type: assetType }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`📊 Fetching indicators for ${tickers.length} ${assetType} tickers (offset: ${offset})`);

    const indicators: IndicatorResult[] = [];
    const batchSize = 10; // Smaller batches for indicator APIs
    let successCount = 0;
    let errorCount = 0;

    const now = new Date();
    const expiresAt = new Date(now.getTime() + 60 * 60 * 1000).toISOString(); // 1 hour TTL

    // Process tickers in parallel batches
    for (let i = 0; i < tickers.length; i += batchSize) {
      const batch = tickers.slice(i, i + batchSize);
      
      const promises = batch.map(async (ticker) => {
        const results: IndicatorResult[] = [];
        const polygonTicker = ticker.polygon_ticker;
        
        try {
          // Fetch RSI
          const rsiUrl = `https://api.polygon.io/v1/indicators/rsi/${polygonTicker}?timespan=day&window=14&series_type=close&limit=1&apiKey=${polygonKey}`;
          const rsiResponse = await fetch(rsiUrl);
          
          if (rsiResponse.ok) {
            const rsiData = await rsiResponse.json();
            if (rsiData.results?.values?.[0]) {
              results.push({
                ticker: polygonTicker,
                indicator_type: 'RSI',
                timeframe: 'daily',
                timestamp: rsiData.results.values[0].timestamp 
                  ? new Date(rsiData.results.values[0].timestamp).toISOString()
                  : now.toISOString(),
                value: { rsi: rsiData.results.values[0].value },
                expires_at: expiresAt,
              });
            }
          }

          // Fetch MACD
          const macdUrl = `https://api.polygon.io/v1/indicators/macd/${polygonTicker}?timespan=day&short_window=12&long_window=26&signal_window=9&series_type=close&limit=1&apiKey=${polygonKey}`;
          const macdResponse = await fetch(macdUrl);
          
          if (macdResponse.ok) {
            const macdData = await macdResponse.json();
            if (macdData.results?.values?.[0]) {
              const macdValue = macdData.results.values[0];
              results.push({
                ticker: polygonTicker,
                indicator_type: 'MACD',
                timeframe: 'daily',
                timestamp: macdValue.timestamp 
                  ? new Date(macdValue.timestamp).toISOString()
                  : now.toISOString(),
                value: {
                  macd: macdValue.value,
                  signal: macdValue.signal,
                  histogram: macdValue.histogram,
                },
                expires_at: expiresAt,
              });
            }
          }

          // Fetch SMA (20-day)
          const smaUrl = `https://api.polygon.io/v1/indicators/sma/${polygonTicker}?timespan=day&window=20&series_type=close&limit=1&apiKey=${polygonKey}`;
          const smaResponse = await fetch(smaUrl);
          
          if (smaResponse.ok) {
            const smaData = await smaResponse.json();
            if (smaData.results?.values?.[0]) {
              results.push({
                ticker: polygonTicker,
                indicator_type: 'SMA_20',
                timeframe: 'daily',
                timestamp: smaData.results.values[0].timestamp 
                  ? new Date(smaData.results.values[0].timestamp).toISOString()
                  : now.toISOString(),
                value: { sma: smaData.results.values[0].value },
                expires_at: expiresAt,
              });
            }
          }

          // Fetch EMA (20-day)
          const emaUrl = `https://api.polygon.io/v1/indicators/ema/${polygonTicker}?timespan=day&window=20&series_type=close&limit=1&apiKey=${polygonKey}`;
          const emaResponse = await fetch(emaUrl);
          
          if (emaResponse.ok) {
            const emaData = await emaResponse.json();
            if (emaData.results?.values?.[0]) {
              results.push({
                ticker: polygonTicker,
                indicator_type: 'EMA_20',
                timeframe: 'daily',
                timestamp: emaData.results.values[0].timestamp 
                  ? new Date(emaData.results.values[0].timestamp).toISOString()
                  : now.toISOString(),
                value: { ema: emaData.results.values[0].value },
                expires_at: expiresAt,
              });
            }
          }

          return results;
        } catch (error) {
          console.error(`❌ Error fetching indicators for ${ticker.symbol}:`, error);
          return [];
        }
      });

      const batchResults = await Promise.all(promises);
      
      for (const results of batchResults) {
        if (results.length > 0) {
          indicators.push(...results);
          successCount++;
        } else {
          errorCount++;
        }
      }

      // Delay between batches to avoid rate limiting
      if (i + batchSize < tickers.length) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }

    // Batch upsert to technical_indicators
    if (indicators.length > 0) {
      const { error: upsertError } = await supabase
        .from('technical_indicators')
        .upsert(indicators, { 
          onConflict: 'ticker,indicator_type,timeframe,timestamp',
          ignoreDuplicates: false 
        });

      if (upsertError) {
        console.error('❌ Upsert error:', upsertError);
      } else {
        console.log(`✅ Saved ${indicators.length} indicators for ${successCount} assets`);
      }
    }

    const duration = Date.now() - startTime;
    const nextOffset = offset + tickers.length;
    const hasMore = tickers.length === batchLimit;
    
    console.log(`🏁 Completed in ${duration}ms: ${successCount} assets, ${indicators.length} indicators`);

    return new Response(
      JSON.stringify({
        status: 'success',
        type: assetType,
        assets_processed: tickers.length,
        indicators_saved: indicators.length,
        success_count: successCount,
        error_count: errorCount,
        offset: offset,
        next_offset: hasMore ? nextOffset : null,
        has_more: hasMore,
        duration_ms: duration,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Polygon Indicators Refresh error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
