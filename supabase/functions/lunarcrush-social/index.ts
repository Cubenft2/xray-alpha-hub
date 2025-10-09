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

    // Step 1: Parse initial SSE stream to get session endpoint
    console.log('📡 Reading initial SSE stream for session endpoint...');
    
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
    let sessionEndpoint: string | null = null;
    const timeout = 5000; // 5 second timeout
    const startTime = Date.now();

    try {
      while (Date.now() - startTime < timeout) {
        const { done, value } = await reader.read();
        
        if (done) {
          console.log('📭 Initial stream ended');
          break;
        }
        
        buffer += decoder.decode(value, { stream: true });
        
        // Process complete SSE events (ending with \n\n)
        const events = buffer.split('\n\n');
        buffer = events.pop() || ''; // Keep incomplete event in buffer
        
        for (const event of events) {
          const lines = event.split('\n');
          let isEndpointEvent = false;
          
          for (const line of lines) {
            console.log(`📨 SSE line: ${line.slice(0, 100)}`);
            
            // Look for endpoint event
            if (line === 'event: endpoint') {
              isEndpointEvent = true;
            }
            
            // Extract session endpoint from data line
            if (isEndpointEvent && line.startsWith('data: ')) {
              sessionEndpoint = line.substring(6).trim();
              console.log(`🎯 Found session endpoint: ${sessionEndpoint}`);
              await reader.cancel(); // Close the stream
              break;
            }
          }
          if (sessionEndpoint) break;
        }
        if (sessionEndpoint) break;
      }

      // Cleanup: cancel reader if still open
      if (!sessionEndpoint) {
        await reader.cancel();
        console.error(`❌ Timeout: No session endpoint received within ${timeout}ms`);
        console.log(`Buffer sample: ${buffer.slice(0, 500)}`);
      }
    } catch (streamError) {
      console.error('❌ Error reading initial SSE stream:', streamError);
      try {
        await reader.cancel();
      } catch (e) {
        // Ignore cancel errors
      }
    }

    if (!sessionEndpoint) {
      console.error('❌ No session endpoint found in initial SSE stream');
      return new Response(
        JSON.stringify({ 
          error: 'No session endpoint in LunarCrush SSE stream',
          sample: buffer.slice(0, 500)
        }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Step 2: Connect to session endpoint to get actual crypto data
    console.log(`📡 Connecting to session endpoint: https://lunarcrush.ai${sessionEndpoint}`);
    
    const sessionResponse = await fetch(`https://lunarcrush.ai${sessionEndpoint}`, {
      method: 'GET',
      headers: {
        'Accept': 'text/event-stream',
        'Authorization': `Bearer ${lunarcrushMcpKey}`,
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      }
    });

    if (!sessionResponse.ok) {
      let errorText = '';
      try {
        errorText = await sessionResponse.text();
      } catch (e) {
        errorText = `Unable to read error body: ${e.message}`;
      }
      console.error(`❌ Session endpoint error: ${sessionResponse.status}`, errorText.slice(0, 300));
      return new Response(
        JSON.stringify({ 
          error: 'Failed to connect to session endpoint', 
          status: sessionResponse.status,
          details: errorText.slice(0, 300)
        }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('📡 Reading crypto data from session stream...');
    
    const sessionReader = sessionResponse.body?.getReader();
    if (!sessionReader) {
      console.error('❌ No readable stream from session endpoint');
      return new Response(
        JSON.stringify({ error: 'No readable stream from session endpoint' }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let sessionBuffer = '';
    let lunarcrushJson: any = null;
    const sessionStartTime = Date.now();

    try {
      while (Date.now() - sessionStartTime < timeout) {
        const { done, value } = await sessionReader.read();
        
        if (done) {
          console.log('📭 Session stream ended');
          break;
        }
        
        sessionBuffer += decoder.decode(value, { stream: true });
        
        // Process complete SSE events
        const events = sessionBuffer.split('\n\n');
        sessionBuffer = events.pop() || '';
        
        for (const event of events) {
          const lines = event.split('\n');
          for (const line of lines) {
            console.log(`📦 Session data: ${line.slice(0, 100)}`);
            
            if (line.startsWith('data: ')) {
              try {
                const jsonStr = line.substring(6);
                const parsed = JSON.parse(jsonStr);
                
                // Check if this is crypto asset data
                if (parsed.data && Array.isArray(parsed.data)) {
                  lunarcrushJson = parsed;
                  console.log(`✅ Parsed crypto data with ${parsed.data.length} assets`);
                  await sessionReader.cancel();
                  break;
                }
              } catch (e) {
                console.log('⚠️ Skipping invalid JSON in session stream');
              }
            }
          }
          if (lunarcrushJson) break;
        }
        if (lunarcrushJson) break;
      }

      if (!lunarcrushJson) {
        await sessionReader.cancel();
        console.error(`❌ Timeout: No crypto data received within ${timeout}ms`);
        console.log(`Session buffer sample: ${sessionBuffer.slice(0, 500)}`);
      }
    } catch (streamError) {
      console.error('❌ Error reading session SSE stream:', streamError);
      try {
        await sessionReader.cancel();
      } catch (e) {
        // Ignore cancel errors
      }
    }

    if (!lunarcrushJson || !lunarcrushJson.data) {
      console.error('❌ No valid crypto data found in session stream');
      return new Response(
        JSON.stringify({ 
          error: 'No valid crypto data in session stream',
          sample: sessionBuffer.slice(0, 500)
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
