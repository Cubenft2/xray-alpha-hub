import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

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

    // Key guard
    if (!lunarcrushMcpKey) {
      return new Response(
        JSON.stringify({ error: 'Missing LunarCrush API key. Please set LUNARCRUSH_MCP_KEY or LUNARCRUSH_API_KEY in Supabase secrets.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('📡 Fetching fresh data from LunarCrush MCP...');

    // Multiple strategies to avoid 406 and auth issues
    const strategies = [
      {
        name: 'GET ?key=... Accept: application/json',
        request: () => fetch(`https://lunarcrush.ai/mcp?key=${encodeURIComponent(lunarcrushMcpKey!)}`, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'xraycrypto-edge/1.0'
          }
        })
      },
      {
        name: 'GET Authorization: Bearer',
        request: () => fetch('https://lunarcrush.ai/mcp', {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
            'Authorization': `Bearer ${lunarcrushMcpKey}`,
            'User-Agent': 'xraycrypto-edge/1.0'
          }
        })
      },
      {
        name: 'POST JSON body',
        request: () => fetch('https://lunarcrush.ai/mcp', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'User-Agent': 'xraycrypto-edge/1.0'
          },
          body: JSON.stringify({ key: lunarcrushMcpKey })
        })
      },
      {
        name: 'GET ?key=... Accept */*',
        request: () => fetch(`https://lunarcrush.ai/mcp?key=${encodeURIComponent(lunarcrushMcpKey!)}`, {
          method: 'GET',
          headers: {
            'Accept': '*/*',
            'User-Agent': 'xraycrypto-edge/1.0'
          }
        })
      }
    ];

    let lunarcrushJson: any = null;
    let lastError: any = null;

    for (const strat of strategies) {
      try {
        console.log(`🔄 Trying LunarCrush MCP strategy: ${strat.name}`);
        const res = await strat.request();
        const text = await res.text();
        if (!res.ok) {
          console.error(`❌ Strategy failed (${strat.name}) status=${res.status} body=${text.slice(0, 300)}`);
          lastError = { status: res.status, body: text.slice(0, 300) };
          continue;
        }
        try {
          lunarcrushJson = JSON.parse(text);
        } catch (e) {
          console.error(`❌ Strategy returned non-JSON (${strat.name}) body=${text.slice(0, 200)}`);
          lastError = { parseError: true, body: text.slice(0, 200) };
          continue;
        }
        console.log(`✅ Strategy succeeded: ${strat.name}`);
        break;
      } catch (err) {
        console.error(`❌ Strategy threw error (${strat.name}):`, err);
        lastError = err instanceof Error ? err.message : String(err);
      }
    }

    if (!lunarcrushJson) {
      return new Response(
        JSON.stringify({ error: 'Failed to fetch LunarCrush data', details: lastError }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    
    const assets: LunarCrushAsset[] = (lunarcrushJson.data || []).map((coin: any) => ({
      name: coin.name,
      symbol: coin.symbol,
      galaxy_score: coin.galaxy_score || 0,
      alt_rank: coin.alt_rank || 0,
      social_volume: coin.social_volume || 0,
      social_dominance: coin.social_dominance || 0,
      sentiment: coin.sentiment || 0,
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
