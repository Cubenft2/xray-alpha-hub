import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface HistoricalDataRequest {
  ticker: string;
  timeframe: '1min' | '5min' | '1hour' | '1day';
  from: string;
  to: string;
  asset_type: 'crypto' | 'stock';
}

interface PolygonBar {
  t: number; // timestamp
  o: number; // open
  h: number; // high
  l: number; // low
  c: number; // close
  v: number; // volume
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

    const { ticker, timeframe, from, to, asset_type } = await req.json() as HistoricalDataRequest;

    if (!ticker || !timeframe || !from || !to || !asset_type) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameters' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`📊 Fetching historical data for ${ticker} (${asset_type}) - ${timeframe} from ${from} to ${to}`);

    // Check cache first
    const cacheExpiry = timeframe === '1day' || timeframe === '1hour' 
      ? new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString() // 24 hours
      : new Date(Date.now() - 5 * 60 * 1000).toISOString(); // 5 minutes

    const { data: cachedData, error: cacheError } = await supabaseClient
      .from('price_history')
      .select('*')
      .eq('ticker', ticker)
      .eq('timeframe', timeframe)
      .gte('timestamp', from)
      .lte('timestamp', to)
      .gte('created_at', cacheExpiry)
      .order('timestamp', { ascending: true });

    if (!cacheError && cachedData && cachedData.length > 0) {
      console.log(`✅ Cache hit: ${cachedData.length} bars for ${ticker}`);
      return new Response(
        JSON.stringify({
          success: true,
          ticker,
          bars: cachedData,
          cached: true,
          bars_count: cachedData.length
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`🔄 Cache miss - fetching from Polygon.io`);

    // Format ticker for Polygon.io (handle pre-formatted tickers from database)
    let polygonTicker = ticker;
    if (asset_type === 'crypto') {
      // Already properly formatted (e.g., X:BTCUSD, X:ZECUSD from ticker_mappings)
      if (ticker.startsWith('X:') && ticker.endsWith('USD')) {
        polygonTicker = ticker;
      }
      // Has X: prefix but no USD suffix
      else if (ticker.startsWith('X:')) {
        polygonTicker = `${ticker}USD`;
      }
      // Raw symbol (e.g., BTC, ZEC)
      else {
        polygonTicker = `X:${ticker}USD`;
      }
    }
    // Stock format stays as-is (e.g., AAPL)

    // Map timeframe to Polygon format
    const timeframeMap: Record<string, { multiplier: number; timespan: string }> = {
      '1min': { multiplier: 1, timespan: 'minute' },
      '5min': { multiplier: 5, timespan: 'minute' },
      '1hour': { multiplier: 1, timespan: 'hour' },
      '1day': { multiplier: 1, timespan: 'day' }
    };

    const { multiplier, timespan } = timeframeMap[timeframe];

    const polygonApiKey = Deno.env.get('POLYGON_API_KEY');
    if (!polygonApiKey) {
      throw new Error('POLYGON_API_KEY not configured');
    }

    const polygonUrl = `https://api.polygon.io/v2/aggs/ticker/${polygonTicker}/range/${multiplier}/${timespan}/${from}/${to}?adjusted=true&sort=asc&limit=50000&apiKey=${polygonApiKey}`;

    console.log(`📡 Fetching: ${polygonUrl.replace(polygonApiKey, 'API_KEY')}`);

    const polygonResponse = await fetch(polygonUrl);
    
    if (!polygonResponse.ok) {
      const errorText = await polygonResponse.text();
      console.error(`❌ Polygon API error: ${polygonResponse.status} - ${errorText}`);
      return new Response(
        JSON.stringify({ 
          error: 'Polygon API error', 
          status: polygonResponse.status,
          message: errorText
        }),
        { status: polygonResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const polygonData = await polygonResponse.json();

    if (!polygonData.results || polygonData.results.length === 0) {
      console.log(`⚠️ No data returned from Polygon for ${ticker}`);
      return new Response(
        JSON.stringify({
          success: true,
          ticker,
          bars: [],
          cached: false,
          bars_count: 0
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`✅ Received ${polygonData.results.length} bars from Polygon`);

    // Transform and store in database
    const barsToInsert = polygonData.results.map((bar: PolygonBar) => ({
      ticker,
      timestamp: new Date(bar.t).toISOString(),
      open: bar.o,
      high: bar.h,
      low: bar.l,
      close: bar.c,
      volume: bar.v,
      timeframe,
      asset_type
    }));

    // Upsert to database (on conflict update)
    const { error: insertError } = await supabaseClient
      .from('price_history')
      .upsert(barsToInsert, {
        onConflict: 'ticker,timestamp,timeframe',
        ignoreDuplicates: false
      });

    if (insertError) {
      console.error('❌ Database insert error:', insertError);
      // Still return the data even if caching fails
    } else {
      console.log(`💾 Cached ${barsToInsert.length} bars to database`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        ticker,
        bars: barsToInsert,
        cached: false,
        bars_count: barsToInsert.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Error in polygon-historical-data:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
