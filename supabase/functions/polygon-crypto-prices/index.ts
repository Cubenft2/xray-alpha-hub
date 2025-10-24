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

    const { symbols } = await req.json();
    const symbolList = symbols || ['BTC', 'ETH'];
    const polygonApiKey = Deno.env.get('POLYGON_API_KEY');

    if (!polygonApiKey) {
      throw new Error('POLYGON_API_KEY not configured');
    }

    const cacheKey = 'polygon:prices:' + symbolList.join(',');
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

    const pricePromises = symbolList.map(async (symbol) => {
      try {
        // Fetch current price
        const priceResponse = await fetch(
          'https://api.polygon.io/v2/last/trade/X:' + symbol + 'USD?apiKey=' + polygonApiKey
        );
        
        if (!priceResponse.ok) return null;
        const priceData = await priceResponse.json();
        const currentPrice = priceData.results?.p;
        
        if (!currentPrice) return null;
        
        // Fetch previous day's close for 24h change calculation
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const dateStr = yesterday.toISOString().split('T')[0];
        
        const aggResponse = await fetch(
          `https://api.polygon.io/v2/aggs/ticker/X:${symbol}USD/prev?adjusted=true&apiKey=${polygonApiKey}`
        );
        
        let change24h = 0;
        if (aggResponse.ok) {
          const aggData = await aggResponse.json();
          const prevClose = aggData.results?.[0]?.c;
          if (prevClose) {
            change24h = ((currentPrice - prevClose) / prevClose) * 100;
          }
        }
        
        return {
          symbol,
          price: currentPrice,
          change24h: change24h,
          timestamp: priceData.results?.t || Date.now(),
          exchange: priceData.results?.x || 'POLYGON',
          size: priceData.results?.s || null
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
