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
      let errorText = '';
      try {
        // Try to read error body, but don't crash if connection is closed
        errorText = await response.text();
      } catch (e) {
        errorText = `Unable to read error body: ${e.message}`;
      }
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

    console.log(`✅ SSE connection established: ${response.status}`);
    console.log(`📋 Content-Type: ${response.headers.get('content-type')}`);

    // Parse SSE stream with timeout (SSE streams are long-lived, we just need the first data event)
    console.log('📡 Reading SSE stream...');
    
    const reader = response.body?.getReader();
    if (!reader) {
      console.error('❌ No readable stream available');
      return new Response(
        JSON.stringify({ error: 'No readable stream from LunarCrush SSE endpoint' }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const decoder = new TextDecoder();
    let buffer = '';
    let lunarcrushJson: any = null;
    const timeout = 5000; // 5 second timeout
    const startTime = Date.now();

    try {
      while (Date.now() - startTime < timeout) {
        const { done, value } = await reader.read();
        
        if (done) {
          console.log('📭 Stream ended');
          break;
        }
        
        buffer += decoder.decode(value, { stream: true });
        
        // Process complete SSE events (ending with \n\n)
        const events = buffer.split('\n\n');
        buffer = events.pop() || ''; // Keep incomplete event in buffer
        
        for (const event of events) {
          const lines = event.split('\n');
          for (const line of lines) {
            console.log(`📨 SSE line: ${line.slice(0, 100)}`); // Debug: log first 100 chars
            if (line.startsWith('data: ')) {
              try {
                const jsonStr = line.substring(6);
                const parsed = JSON.parse(jsonStr);
                
                // Check if this is the data event we want (not error or metadata)
                if (parsed.data && Array.isArray(parsed.data)) {
                  lunarcrushJson = parsed;
                  console.log(`✅ Parsed SSE event with ${parsed.data.length} assets`);
                  await reader.cancel(); // Close the stream
                  break;
                }
              } catch (e) {
                // Skip invalid JSON
                console.log('⚠️ Skipping invalid JSON in SSE event');
              }
            }
          }
          if (lunarcrushJson) break;
        }
        if (lunarcrushJson) break;
      }

      // Cleanup: cancel reader if still open
      if (!lunarcrushJson) {
        await reader.cancel();
        console.error(`❌ Timeout: No valid data received within ${timeout}ms`);
        console.log(`Buffer sample: ${buffer.slice(0, 500)}`);
      }
    } catch (streamError) {
      console.error('❌ Error reading SSE stream:', streamError);
      try {
        await reader.cancel();
      } catch (e) {
        // Ignore cancel errors
      }
    }

    if (!lunarcrushJson || !lunarcrushJson.data) {
      console.error('❌ No valid data found in SSE stream');
      return new Response(
        JSON.stringify({ 
          error: 'No valid data in LunarCrush SSE stream',
          sample: buffer.slice(0, 500)
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
