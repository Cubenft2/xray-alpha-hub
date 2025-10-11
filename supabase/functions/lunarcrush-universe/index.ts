import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CoinData {
  id: number;
  name: string;
  symbol: string;
  price: number;
  price_btc: number;
  market_cap: number;
  percent_change_24h: number;
  percent_change_7d: number;
  percent_change_30d: number;
  volume_24h: number;
  max_supply: number | null;
  circulating_supply: number;
  close: number;
  galaxy_score: number;
  alt_rank: number;
  volatility: number;
  market_cap_rank: number;
  categories?: string[];
  social_volume?: number;
  sentiment?: number;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const cacheKey = 'lunarcrush:universe:v1';
    const cacheTTL = 21600; // 6 hours (universe data doesn't change rapidly)

    // Check cache (fresh)
    const { data: cachedData } = await supabase
      .from('cache_kv')
      .select('value, expires_at')
      .eq('key', cacheKey)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (cachedData?.value) {
      console.log('✅ Returning cached LunarCrush universe data');
      return new Response(JSON.stringify(cachedData.value), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Also get expired cache as fallback for rate limiting
    const { data: expiredCache } = await supabase
      .from('cache_kv')
      .select('value, expires_at')
      .eq('key', cacheKey)
      .single();

    // Fetch fresh data
    console.log('Fetching fresh LunarCrush universe data...');
    const response = await fetch('https://lunarcrush.com/api4/public/coins/list/v1', {
      headers: {
        'Authorization': 'Bearer faa6tt93zhhvfrrwsdbneqlsfimgjm6gwuwet02rt',
      },
    });

    if (!response.ok) {
      // If rate limited and we have expired cache, return that instead
      if (response.status === 429 && expiredCache?.value) {
        console.log('⚠️ Rate limited! Returning expired cache for universe data');
        return new Response(JSON.stringify(expiredCache.value), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      throw new Error(`LunarCrush API error: ${response.status} ${response.statusText}`);
    }

    const apiData = await response.json();
    const rawCoins = apiData.data || [];
    
    // Map API fields to our interface, including social_volume from interactions_24h
    const coins: CoinData[] = rawCoins.map((coin: any) => ({
      ...coin,
      social_volume: coin.interactions_24h || coin.social_volume || 0,
      sentiment: coin.sentiment || 0,
    }));

    console.log(`📊 Sample coin data:`, JSON.stringify(coins[0], null, 2));

    // Calculate metadata
    const metadata = {
      total_coins: coins.length,
      total_market_cap: coins.reduce((sum, c) => sum + (c.market_cap || 0), 0),
      total_volume_24h: coins.reduce((sum, c) => sum + (c.volume_24h || 0), 0),
      average_galaxy_score: coins.reduce((sum, c) => sum + (c.galaxy_score || 0), 0) / coins.length,
      last_updated: new Date().toISOString(),
    };

    const result = {
      success: true,
      data: coins,
      metadata,
    };

    // Store in cache
    const expiresAt = new Date(Date.now() + cacheTTL * 1000).toISOString();
    await supabase
      .from('cache_kv')
      .upsert({
        key: cacheKey,
        value: result,
        expires_at: expiresAt,
      });

    console.log(`✅ Fetched ${coins.length} coins from LunarCrush`);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('❌ LunarCrush Universe Error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
