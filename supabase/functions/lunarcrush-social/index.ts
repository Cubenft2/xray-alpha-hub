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

    console.log('📡 Fetching fresh data from LunarCrush SSE endpoint...');

    // LunarCrush MCP uses Server-Sent Events (SSE)
    const sseUrl = 'https://lunarcrush.ai/sse';
    
    const response = await fetch(sseUrl, {
      method: 'GET',
      headers: {
        'Accept': 'text/event-stream',
        'Authorization': `Bearer ${lunarcrushMcpKey}`,
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ LunarCrush MCP error: ${response.status}`, errorText.slice(0, 300));
      return new Response(
        JSON.stringify({ 
          error: 'Failed to fetch LunarCrush data', 
          status: response.status,
          details: errorText.slice(0, 300)
        }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse SSE stream
    const responseText = await response.text();
    console.log(`📦 Received SSE data (${responseText.length} bytes)`);

    // SSE format: "data: {json}\n\n"
    // Extract JSON from SSE events
    const lines = responseText.split('\n');
    let lunarcrushJson: any = null;

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        try {
          const jsonStr = line.substring(6); // Remove "data: " prefix
          const parsed = JSON.parse(jsonStr);
          
          // Check if this is the data event we want (not error or metadata)
          if (parsed.data && Array.isArray(parsed.data)) {
            lunarcrushJson = parsed;
            console.log(`✅ Parsed SSE event with ${parsed.data.length} assets`);
            break;
          }
        } catch (e) {
          // Skip non-JSON lines or metadata events
          continue;
        }
      }
    }

    if (!lunarcrushJson || !lunarcrushJson.data) {
      console.error('❌ No valid data found in SSE stream');
      return new Response(
        JSON.stringify({ 
          error: 'No valid data in LunarCrush SSE stream',
          sample: responseText.slice(0, 500)
        }),
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
