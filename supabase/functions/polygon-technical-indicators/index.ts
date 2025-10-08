import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TechnicalIndicatorsRequest {
  tickers: string[];
  indicators: string[]; // ['rsi', 'macd', 'sma_50', 'ema_20']
  timeframe?: 'daily' | 'hourly';
}

interface IndicatorResult {
  [ticker: string]: {
    [indicator: string]: any;
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { tickers, indicators, timeframe = 'daily' } = await req.json() as TechnicalIndicatorsRequest;

    if (!tickers || !indicators || tickers.length === 0 || indicators.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameters: tickers and indicators' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`📈 Fetching ${indicators.join(', ')} for ${tickers.length} tickers`);

    const result: IndicatorResult = {};
    const polygonApiKey = Deno.env.get('POLYGON_API_KEY');

    if (!polygonApiKey) {
      throw new Error('POLYGON_API_KEY not configured');
    }

    // Process each ticker
    for (const ticker of tickers) {
      result[ticker] = {};

      // Check cache first
      const cacheExpiry = new Date(Date.now() - 60 * 60 * 1000).toISOString(); // 1 hour

      const { data: cachedIndicators } = await supabaseClient
        .from('technical_indicators')
        .select('*')
        .eq('ticker', ticker)
        .eq('timeframe', timeframe)
        .in('indicator_type', indicators)
        .gte('created_at', cacheExpiry)
        .order('timestamp', { ascending: false })
        .limit(indicators.length);

      const cachedTypes = new Set(cachedIndicators?.map(i => i.indicator_type) || []);

      // Use cached data where available
      if (cachedIndicators && cachedIndicators.length > 0) {
        cachedIndicators.forEach(ind => {
          result[ticker][ind.indicator_type] = {
            ...ind.value,
            timestamp: ind.timestamp,
            cached: true
          };
        });
        console.log(`✅ Cache hit for ${ticker}: ${cachedTypes.size} indicators`);
      }

      // Fetch missing indicators from Polygon
      const missingIndicators = indicators.filter(ind => !cachedTypes.has(ind.split('_')[0]));

      if (missingIndicators.length === 0) {
        continue; // All indicators cached
      }

      console.log(`🔄 Fetching from Polygon for ${ticker}: ${missingIndicators.join(', ')}`);

      // Format ticker for Polygon (crypto needs X: prefix)
      const polygonTicker = ticker.length <= 5 && ticker === ticker.toUpperCase()
        ? `X:${ticker}USD`
        : ticker;

      const timespan = timeframe === 'daily' ? 'day' : 'hour';

      // Fetch each indicator
      for (const indicatorSpec of missingIndicators) {
        try {
          let indicatorType = indicatorSpec;
          let window = 14; // default

          // Parse indicator spec (e.g., "sma_50", "ema_20")
          if (indicatorSpec.includes('_')) {
            const parts = indicatorSpec.split('_');
            indicatorType = parts[0];
            window = parseInt(parts[1]) || 14;
          }

          let url = '';
          let params = `timespan=${timespan}&adjusted=true&apiKey=${polygonApiKey}`;

          switch (indicatorType) {
            case 'rsi':
              url = `https://api.polygon.io/v1/indicators/rsi/${polygonTicker}?${params}&window=14&series_type=close`;
              break;
            case 'macd':
              url = `https://api.polygon.io/v1/indicators/macd/${polygonTicker}?${params}&short_window=12&long_window=26&signal_window=9&series_type=close`;
              break;
            case 'sma':
              url = `https://api.polygon.io/v1/indicators/sma/${polygonTicker}?${params}&window=${window}&series_type=close`;
              break;
            case 'ema':
              url = `https://api.polygon.io/v1/indicators/ema/${polygonTicker}?${params}&window=${window}&series_type=close`;
              break;
            case 'bb':
              url = `https://api.polygon.io/v1/indicators/bbands/${polygonTicker}?${params}&window=20&series_type=close`;
              break;
            case 'atr':
              url = `https://api.polygon.io/v1/indicators/atr/${polygonTicker}?${params}&window=14`;
              break;
            case 'stoch':
              url = `https://api.polygon.io/v1/indicators/stoch/${polygonTicker}?${params}&k_window=14&d_window=3`;
              break;
            default:
              console.log(`⚠️ Unknown indicator type: ${indicatorType}`);
              continue;
          }

          const response = await fetch(url);

          if (!response.ok) {
            console.error(`❌ Polygon API error for ${ticker} ${indicatorType}: ${response.status}`);
            continue;
          }

          const data = await response.json();

          if (!data.results || !data.results.values || data.results.values.length === 0) {
            console.log(`⚠️ No data for ${ticker} ${indicatorType}`);
            continue;
          }

          // Get the most recent value
          const latest = data.results.values[data.results.values.length - 1];
          const timestamp = new Date(latest.timestamp).toISOString();

          let value: any = {};
          let signal = '';

          switch (indicatorType) {
            case 'rsi':
              value = { value: latest.value };
              signal = latest.value > 70 ? 'overbought' : latest.value < 30 ? 'oversold' : 'neutral';
              break;
            case 'macd':
              value = {
                value: latest.value,
                signal: latest.signal,
                histogram: latest.histogram
              };
              signal = latest.histogram > 0 ? 'bullish' : 'bearish';
              break;
            case 'sma':
            case 'ema':
              value = { value: latest.value };
              break;
            case 'bb':
              value = {
                upper: latest.upper,
                middle: latest.middle,
                lower: latest.lower
              };
              signal = 'bands';
              break;
            case 'atr':
              value = { value: latest.value };
              signal = 'volatility';
              break;
            case 'stoch':
              value = {
                k: latest.k,
                d: latest.d
              };
              signal = latest.k > 80 ? 'overbought' : latest.k < 20 ? 'oversold' : 'neutral';
              break;
          }

          // Store in database
          await supabaseClient
            .from('technical_indicators')
            .insert({
              ticker,
              timestamp,
              indicator_type: indicatorType,
              value: { ...value, signal },
              timeframe,
              expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString()
            });

          result[ticker][indicatorSpec] = {
            ...value,
            signal,
            timestamp,
            cached: false
          };

          console.log(`✅ Fetched ${indicatorType} for ${ticker}: ${JSON.stringify(value)}`);

        } catch (error) {
          console.error(`❌ Error fetching ${indicatorSpec} for ${ticker}:`, error);
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: result,
        tickers_processed: tickers.length,
        indicators_requested: indicators.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Error in polygon-technical-indicators:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
