import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const lunarcrushApiKey = Deno.env.get('LUNARCRUSH_API_KEY')!;

interface LunarCrushAsset {
  name: string;
  symbol: string;
  galaxy_score: number;
  alt_rank: number;
  social_volume: number;
  social_dominance: number;
  sentiment: number;
  fomo_score: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('🌙 Checking cache for LunarCrush data...');

    // Check cache (15-minute TTL)
    const cacheKey = 'lunarcrush_social_data';
    const { data: cachedData } = await supabase
      .from('cache_kv')
      .select('v, created_at')
      .eq('k', cacheKey)
      .gte('expires_at', new Date().toISOString())
      .single();

    if (cachedData) {
      const age = Math.floor((Date.now() - new Date(cachedData.created_at).getTime()) / 1000);
      console.log(`✅ Cache hit (${age}s old)`);
      return new Response(
        JSON.stringify({
          data: cachedData.v,
          cached: true,
          age_seconds: age
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('📡 Fetching fresh data from LunarCrush...');

    // Fetch top 50 coins from LunarCrush
    const response = await fetch(
      'https://lunarcrush.com/api4/public/coins/list/v2?limit=50&sort=galaxy_score',
      {
        headers: {
          'Authorization': `Bearer ${lunarcrushApiKey}`,
          'accept': 'application/json'
        }
      }
    );

    if (!response.ok) {
      console.error(`❌ LunarCrush API error: ${response.status}`);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch LunarCrush data' }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const lunarcrushJson = await response.json();
    const assets: LunarCrushAsset[] = lunarcrushJson.data.slice(0, 50).map((coin: any) => ({
      name: coin.name,
      symbol: coin.symbol,
      galaxy_score: coin.galaxy_score,
      alt_rank: coin.alt_rank,
      social_volume: coin.social_volume,
      social_dominance: coin.social_dominance,
      sentiment: coin.sentiment,
      fomo_score: coin.fomo_score || 0
    }));

    console.log(`✅ Fetched ${assets.length} assets from LunarCrush`);

    // Cache for 15 minutes
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    await supabase
      .from('cache_kv')
      .upsert({
        k: cacheKey,
        v: assets,
        expires_at: expiresAt
      }, { onConflict: 'k' });

    console.log('💾 Cached data for 15 minutes');

    return new Response(
      JSON.stringify({
        data: assets,
        cached: false,
        timestamp: new Date().toISOString()
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Error in lunarcrush-social:', error);
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
