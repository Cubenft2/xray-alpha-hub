import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const url = new URL(req.url);
    const symbols = url.searchParams.get('symbols')?.split(',') || ['BTC', 'ETH'];
    const polygonApiKey = Deno.env.get('POLYGON_API_KEY');

    if (!polygonApiKey) {
      throw new Error('POLYGON_API_KEY not configured');
    }

    const cacheKey = 'polygon:prices:' + symbols.join(',');
    const { data: cached } = await supabaseClient
      .from('cache_kv')
      .select('v, expires_at')
      .eq('k', cacheKey)
      .single();

    if (cached && new Date(cached.expires_at) > new Date()) {
      return new Response(
        JSON.stringify(cached.v),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const pricePromises = symbols.map(async (symbol) => {
      try {
        const response = await fetch(
          'https://api.polygon.io/v2/last/trade/X:' + symbol + 'USD?apiKey=' + polygonApiKey
        );
        
        if (!response.ok) return null;
        const data = await response.json();
        
        return {
          symbol,
          price: data.results?.p || null,
          timestamp: data.results?.t || Date.now(),
          exchange: data.results?.x || 'POLYGON',
          size: data.results?.s || null
        };
      } catch (error) {
        return null;
      }
    });

    const prices = (await Promise.all(pricePromises)).filter(p => p !== null);

    const result = {
      success: true,
      prices,
      timestamp: new Date().toISOString(),
      source: 'polygon.io'
    };

    const expiresAt = new Date(Date.now() + 10000);
    await supabaseClient
      .from('cache_kv')
      .upsert({
        k: cacheKey,
        v: result,
        expires_at: expiresAt.toISOString()
      });

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
