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
    // Get LunarCrush API key from environment
    const lunarCrushApiKey = Deno.env.get('LUNARCRUSH_API_KEY');
    
    if (!lunarCrushApiKey) {
      console.error('❌ LUNARCRUSH_API_KEY not configured');
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'LunarCrush API key not configured' 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const cacheKey = 'lunarcrush:universe:v1';
    const cacheTTL = 600; // 10 minutes - fresh data for users

    // Check cache (fresh)
    const { data: cachedData } = await supabase
      .from('cache_kv')
      .select('v, expires_at')
      .eq('k', cacheKey)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (cachedData?.v) {
      console.log('✅ Returning cached LunarCrush universe data');
      return new Response(JSON.stringify(cachedData.v), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Also get expired cache as fallback for rate limiting
    const { data: expiredCache } = await supabase
      .from('cache_kv')
      .select('v, expires_at')
      .eq('k', cacheKey)
      .single();

    // Fetch fresh data
    console.log('Fetching fresh LunarCrush universe data...');
    const response = await fetch('https://lunarcrush.com/api4/public/coins/list/v1', {
      headers: {
        'Authorization': `Bearer ${lunarCrushApiKey}`,
      },
    });

    if (!response.ok) {
      // If rate limited and we have expired cache, return that instead
      if (response.status === 429 && expiredCache?.v) {
        console.log('⚠️ Rate limited! Returning expired cache for universe data');
        return new Response(JSON.stringify(expiredCache.v), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      throw new Error(`LunarCrush API error: ${response.status} ${response.statusText}`);
    }

    const apiData = await response.json();
    const rawCoins = apiData.data || [];
    
    // Map API fields to our interface, including social_volume from interactions_24h
    const coins: CoinData[] = rawCoins.map((coin: any) => {
      const social_volume = coin.interactions_24h || coin.social_volume_24h || coin.social_volume || 0;
      
      // Debug: Log which field we're using for the first few coins
      if (rawCoins.indexOf(coin) < 3) {
        console.log(`📊 ${coin.symbol} social_volume mapping:`, {
          interactions_24h: coin.interactions_24h,
          social_volume_24h: coin.social_volume_24h,
          social_volume: coin.social_volume,
          final_value: social_volume
        });
      }
      
      return {
        ...coin,
        social_volume,
        sentiment: coin.sentiment || 0,
      };
    });

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
        k: cacheKey,
        v: result,
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
