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

    // Filter out invalid IDs and batch requests
    const validIds = coingecko_ids.filter(id => id && typeof id === 'string' && id.length > 0);
    console.log(`Processing ${validIds.length} CoinGecko IDs`);
    
    // CoinGecko API can handle up to 250 IDs, but we'll batch at 50 for safety
    const BATCH_SIZE = 50;
    const logoMap: Record<string, string> = {};
    
    for (let i = 0; i < validIds.length; i += BATCH_SIZE) {
      const batch = validIds.slice(i, i + BATCH_SIZE);
      console.log(`Fetching batch ${Math.floor(i / BATCH_SIZE) + 1} (${batch.length} IDs)`);
      
      const params = new URLSearchParams({
        ids: batch.join(','),
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
        const errorText = await response.text();
        console.error(`CoinGecko API error for batch: ${response.status} ${response.statusText}`, errorText);
        // Continue with next batch instead of failing completely
        continue;
      }

      const coins = await response.json();
      console.log(`Received ${coins.length} coins in batch`);
      
      // Map coingecko_id to logo URL
      coins.forEach((coin: any) => {
        if (coin.id && coin.image) {
          logoMap[coin.id] = coin.image;
        }
      });
      
      // Add a small delay between batches to respect rate limits
      if (i + BATCH_SIZE < validIds.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    console.log(`Successfully fetched logos for ${Object.keys(logoMap).length} coins`);

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
