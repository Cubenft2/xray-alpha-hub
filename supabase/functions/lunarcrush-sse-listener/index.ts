import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const LUNARCRUSH_SSE_URL = 'https://lunarcrush.ai/sse';

Deno.serve(async (req) => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const lunarcrushKey = Deno.env.get('LUNARCRUSH_API_KEY')!;

  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log('🎧 Starting LunarCrush SSE listener...');

  // Track reconnection attempts
  let reconnectAttempts = 0;
  const maxReconnectAttempts = 10;
  
  async function connectToSSE() {
    try {
      const response = await fetch(`${LUNARCRUSH_SSE_URL}?key=${lunarcrushKey}`, {
        headers: {
          'Accept': 'text/event-stream',
        },
      });

      if (!response.ok) {
        throw new Error(`SSE connection failed: ${response.status} ${response.statusText}`);
      }

      console.log('✅ Connected to LunarCrush SSE stream');
      reconnectAttempts = 0; // Reset on successful connection

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('No response body reader available');
      }

      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          console.log('📡 SSE stream ended, reconnecting...');
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim();
            
            if (data === '[DONE]' || !data) continue;

            try {
              const parsedData = JSON.parse(data);
              console.log('📥 Received SSE data:', { 
                timestamp: new Date().toISOString(),
                assetCount: parsedData?.data?.length || 0 
              });

              await updateCache(parsedData);
            } catch (parseError) {
              console.error('❌ Error parsing SSE data:', parseError);
            }
          }
        }
      }

      // Stream ended, attempt reconnect
      await reconnectWithBackoff();

    } catch (error) {
      console.error('❌ SSE connection error:', error);
      await reconnectWithBackoff();
    }
  }

  async function reconnectWithBackoff() {
    if (reconnectAttempts >= maxReconnectAttempts) {
      console.error('❌ Max reconnection attempts reached. Stopping listener.');
      return;
    }

    reconnectAttempts++;
    const backoffTime = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);
    console.log(`⏳ Reconnecting in ${backoffTime}ms (attempt ${reconnectAttempts}/${maxReconnectAttempts})...`);
    
    await new Promise(resolve => setTimeout(resolve, backoffTime));
    await connectToSSE();
  }

  async function updateCache(parsedData: any) {
    try {
      // Deactivate old cache entries
      await supabase
        .from('social_sentiment_cache')
        .update({ is_active: false })
        .eq('is_active', true);

      // Insert new data
      const { error: insertError } = await supabase
        .from('social_sentiment_cache')
        .insert({
          data: parsedData.data || [],
          generated_at: parsedData.timestamp || new Date().toISOString(),
          is_active: true,
        });

      if (insertError) {
        console.error('❌ Error updating cache:', insertError);
      } else {
        console.log('✅ Cache updated successfully at', new Date().toISOString());
      }
    } catch (error) {
      console.error('❌ Error in updateCache:', error);
    }
  }

  // Start the connection in the background
  EdgeRuntime.waitUntil(connectToSSE());

  // Return immediate response
  return new Response(
    JSON.stringify({ 
      status: 'streaming',
      message: 'LunarCrush SSE listener started',
      endpoint: LUNARCRUSH_SSE_URL
    }),
    {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    }
  );
});
