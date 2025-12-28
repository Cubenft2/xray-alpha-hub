import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';
import { 
  transformLunarCrushCoin, 
  type LunarCrushAsset 
} from "../_shared/validation-schemas.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const lunarcrushMcpKey = Deno.env.get('LUNARCRUSH_MCP_KEY') ?? Deno.env.get('LUNARCRUSH_API_KEY');
if (!lunarcrushMcpKey) {
  console.warn('⚠️ Missing LUNARCRUSH_MCP_KEY and LUNARCRUSH_API_KEY in environment');
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

    // Key guard - return empty data instead of error
    if (!lunarcrushMcpKey) {
      console.warn('⚠️ Missing LunarCrush API key - returning empty data');
      return new Response(
        JSON.stringify({ 
          data: [],
          cached: false,
          warning: 'Missing API key'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('📡 Fetching fresh data from LunarCrush REST API v4...');

    // Use REST API v4 endpoint with timeout
    const apiUrl = 'https://lunarcrush.com/api4/public/coins/list/v1';
    
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000); // 10s timeout
    
    try {
      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${lunarcrushMcpKey}`,
          'Accept': 'application/json'
        },
        signal: controller.signal
      });
      clearTimeout(timeout);

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unable to read error');
        console.error(`❌ LunarCrush API error: ${response.status}`, errorText.slice(0, 300));
        
        // Return empty data instead of error - social data is optional
        return new Response(
          JSON.stringify({ 
            data: [],
            cached: false,
            warning: `API returned ${response.status}`,
            details: errorText.slice(0, 300)
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`✅ REST API response: ${response.status}`);
      
      const lunarcrushJson = await response.json();
      
      if (!lunarcrushJson || !lunarcrushJson.data) {
        console.error('❌ No valid crypto data in API response');
        return new Response(
          JSON.stringify({ 
            data: [],
            cached: false,
            warning: 'Invalid API response format'
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Use shared validation/transform function
      const rawCoins = lunarcrushJson.data || [];
      const assets: LunarCrushAsset[] = rawCoins
        .filter((coin: unknown) => coin && typeof coin === 'object')
        .map((coin: Record<string, unknown>) => transformLunarCrushCoin(coin));

      console.log(`✅ Validated ${assets.length} assets from LunarCrush (raw: ${rawCoins.length})`);

      // Cache for 30 minutes
      const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
      await supabase
        .from('cache_kv')
        .upsert({
          k: cacheKey,
          v: assets,
          expires_at: expiresAt
        }, { onConflict: 'k' });

      console.log('💾 Cached data for 30 minutes');

      return new Response(
        JSON.stringify({
          data: assets,
          cached: false,
          timestamp: new Date().toISOString()
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } catch (fetchError) {
      clearTimeout(timeout);
      
      if (fetchError instanceof Error && fetchError.name === 'AbortError') {
        console.warn('⚠️ LunarCrush API timeout - returning empty data');
      } else {
        console.error('❌ LunarCrush fetch error:', fetchError);
      }
      
      // Return empty data instead of error
      return new Response(
        JSON.stringify({
          data: [],
          cached: false,
          warning: 'Fetch failed or timed out'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

  } catch (error) {
    console.error('❌ Error in lunarcrush-social:', error);
    // Return empty data instead of error - social data is optional
    return new Response(
      JSON.stringify({
        data: [],
        cached: false,
        warning: 'Internal error',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
