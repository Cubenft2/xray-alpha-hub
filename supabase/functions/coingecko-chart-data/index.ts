import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const COINGECKO_API_KEY = Deno.env.get('COINGECKO_API_KEY');

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
    const coinId = url.searchParams.get('coinId');
    const days = url.searchParams.get('days') || '7';
    const vsCurrency = url.searchParams.get('vs_currency') || 'usd';

    if (!coinId) {
      return new Response(
        JSON.stringify({ error: 'coinId parameter is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase for caching
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check cache first (5 minute TTL for chart data)
    const cacheKey = `cg_chart_${coinId}_${days}_${vsCurrency}`;
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

    // Build CoinGecko API URL with authentication
    const cgUrl = new URL(`https://api.coingecko.com/api/v3/coins/${coinId}/market_chart`);
    cgUrl.searchParams.set('vs_currency', vsCurrency);
    cgUrl.searchParams.set('days', days);

    const headers: Record<string, string> = {
      'accept': 'application/json',
    };

    // Add API key if available (use pro endpoint if we have a key)
    if (COINGECKO_API_KEY) {
      headers['x-cg-pro-api-key'] = COINGECKO_API_KEY;
    }

    console.log(`Fetching CoinGecko chart data for ${coinId}, ${days} days`);
    
    const response = await fetch(cgUrl.toString(), { headers });

    if (!response.ok) {
      // Handle rate limiting gracefully
      if (response.status === 429) {
        console.warn(`CoinGecko rate limited for ${coinId}`);
        return new Response(
          JSON.stringify({ error: 'Rate limited', prices: [] }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      console.error(`CoinGecko API error: ${response.status} ${response.statusText}`);
      return new Response(
        JSON.stringify({ error: `CoinGecko API error: ${response.status}` }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();

    // Cache the result for 5 minutes
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
    await supabase
      .from('cache_kv')
      .upsert({
        k: cacheKey,
        v: data,
        expires_at: expiresAt,
      });

    return new Response(
      JSON.stringify(data),
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
    console.error('Error fetching CoinGecko chart data:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});