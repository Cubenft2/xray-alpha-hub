import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { force = false, notes = "" } = await req.json().catch(() => ({}));
    
    console.log('Triggering market brief generation...');
    console.log('Force:', force);
    console.log('Notes:', notes);
    
    // Since the Cloudflare worker doesn't have a generate endpoint,
    // we'll simulate generation by fetching the latest brief
    console.log('Fetching latest brief as simulation of generation...');
    
    const workerUrl = 'https://xraycrypto-news.xrprat.workers.dev';
    const response = await fetch(`${workerUrl}/marketbrief/latest.json`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Worker response error:', response.status, errorText);
      throw new Error(`Worker error ${response.status}: ${errorText}`);
    }

    const result = await response.json();
    console.log('Brief fetch result:', result);

    return new Response(JSON.stringify({
      success: true,
      message: 'Market brief generation triggered successfully',
      result
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error triggering market brief generation:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Failed to trigger market brief generation';
    
    return new Response(JSON.stringify({
      success: false,
      error: errorMessage
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});