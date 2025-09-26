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
    const { force = false, notes = "", workerUrl } = await req.json().catch(() => ({}));
    
    console.log('Triggering market brief generation...');
    console.log('Force:', force);
    console.log('Notes:', notes);
    console.log('Worker URL:', workerUrl);

    // Default worker URL - update this with your actual Cloudflare worker domain
    const defaultWorkerUrl = workerUrl || 'https://your-worker-domain.workers.dev';
    
    const response = await fetch(`${defaultWorkerUrl}/marketbrief/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        force,
        notes: notes || `Manual generation triggered at ${new Date().toISOString()}`
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Worker response error:', response.status, errorText);
      throw new Error(`Worker error ${response.status}: ${errorText}`);
    }

    const result = await response.json();
    console.log('Brief generation result:', result);

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