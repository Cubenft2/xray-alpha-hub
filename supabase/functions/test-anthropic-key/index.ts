import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY');
    
    // Check 1: Is the key present?
    if (!anthropicApiKey) {
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'ANTHROPIC_API_KEY not found in environment',
          message: 'Add ANTHROPIC_API_KEY to Supabase Edge Functions secrets'
        }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('✅ ANTHROPIC_API_KEY found');
    console.log(`🔑 Key starts with: ${anthropicApiKey.substring(0, 15)}...`);

    // Check 2: Does it work?
    console.log('🧪 Testing API key with a simple request...');

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': anthropicApiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 50,
        messages: [
          {
            role: 'user',
            content: 'Say "API key works!" if you can read this.'
          }
        ]
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ API request failed:', response.status, errorText);
      
      return new Response(
        JSON.stringify({ 
          success: false,
          error: `API request failed: ${response.status}`,
          details: errorText,
          message: 'API key might be invalid or expired'
        }),
        { 
          status: response.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const data = await response.json();
    const claudeResponse = data.content[0].text;

    console.log('✅ Claude responded:', claudeResponse);

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Anthropic API key is working!',
        claudeResponse: claudeResponse,
        keyPrefix: anthropicApiKey.substring(0, 15) + '...',
        model: 'claude-sonnet-4-20250514',
        usage: data.usage
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('❌ Test failed:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false,
        error: 'Test failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
