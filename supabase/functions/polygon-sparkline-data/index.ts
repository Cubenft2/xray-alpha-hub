import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const POLYGON_API_KEY = Deno.env.get('POLYGON_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const ticker = url.searchParams.get('ticker'); // e.g., X:BTCUSD

    if (!ticker) {
      return new Response(
        JSON.stringify({ error: 'Missing ticker parameter' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!POLYGON_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'Polygon API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase for caching
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check cache first (5 minute TTL)
    const cacheKey = `polygon_sparkline_${ticker}`;
    const { data: cached } = await supabase
      .from('cache_kv')
      .select('v, expires_at')
      .eq('k', cacheKey)
      .maybeSingle();

    if (cached && new Date(cached.expires_at) > new Date()) {
      return new Response(
        JSON.stringify(cached.v),
        { 
          status: 200, 
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json',
            'X-Cache': 'HIT'
          } 
        }
      );
    }

    // Calculate time range: last 24 hours
    const now = Date.now();
    const from = now - 24 * 60 * 60 * 1000; // 24 hours ago
    
    // Fetch 15-minute bars from Polygon (96 bars per 24h)
    const polygonUrl = `https://api.polygon.io/v2/aggs/ticker/${encodeURIComponent(ticker)}/range/15/minute/${from}/${now}?adjusted=true&sort=asc&limit=96&apiKey=${POLYGON_API_KEY}`;
    
    console.log(`Fetching sparkline data for ${ticker}`);
    const response = await fetch(polygonUrl);

    if (!response.ok) {
      console.error(`Polygon API error for ${ticker}: ${response.status}`);
      return new Response(
        JSON.stringify({ error: `Polygon API error: ${response.status}`, prices: [] }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    
    // Transform to simple [{time, price}] format
    const prices = (data.results || []).map((bar: any) => ({
      time: bar.t,
      price: bar.c // closing price
    }));

    const result = { prices, ticker, count: prices.length };

    // Cache for 5 minutes
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
    await supabase
      .from('cache_kv')
      .upsert({
        k: cacheKey,
        v: result,
        expires_at: expiresAt,
      });

    return new Response(
      JSON.stringify(result),
      { 
        status: 200, 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json',
          'X-Cache': 'MISS'
        } 
      }
    );
  } catch (error) {
    console.error('Sparkline error:', error);
    return new Response(
      JSON.stringify({ error: error.message, prices: [] }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
