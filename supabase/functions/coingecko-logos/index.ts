import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { coingecko_ids } = await req.json();
    
    if (!coingecko_ids || !Array.isArray(coingecko_ids)) {
      throw new Error('coingecko_ids array is required');
    }

    const apiKey = Deno.env.get('COINGECKO_API_KEY');
    if (!apiKey) {
      throw new Error('CoinGecko API key not configured');
    }

    // Fetch coin data from CoinGecko API
    const params = new URLSearchParams({
      ids: coingecko_ids.join(','),
      vs_currency: 'usd',
      per_page: '250',
    });

    const response = await fetch(
      `https://api.coingecko.com/api/v3/coins/markets?${params}`,
      {
        headers: {
          'x-cg-demo-api-key': apiKey,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`CoinGecko API error: ${response.statusText}`);
    }

    const coins = await response.json();
    
    // Map coingecko_id to logo URL
    const logoMap: Record<string, string> = {};
    coins.forEach((coin: any) => {
      if (coin.id && coin.image) {
        logoMap[coin.id] = coin.image;
      }
    });

    return new Response(
      JSON.stringify({ logos: logoMap }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error fetching logos:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
