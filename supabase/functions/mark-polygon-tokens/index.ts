import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const WORKER_URL = 'https://crypto-stream.xrprat.workers.dev/prices';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  console.log('🔄 mark-polygon-tokens: Starting...');

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch prices from Cloudflare Worker
    console.log('📡 Fetching prices from Worker...');
    const response = await fetch(WORKER_URL, {
      headers: { 'Accept': 'application/json' },
    });

    if (!response.ok) {
      throw new Error(`Worker returned ${response.status}`);
    }

    const prices = await response.json();
    console.log(`📊 Received ${Object.keys(prices).length} symbols from Worker`);

    // Extract symbols that have valid prices
    const polygonSymbols = Object.keys(prices)
      .map(s => s.toUpperCase())
      .filter(s => s && s.length > 0);

    if (polygonSymbols.length === 0) {
      console.warn('⚠️ No symbols returned from Worker');
      return new Response(JSON.stringify({
        success: true,
        marked: 0,
        unmarked: 0,
        message: 'No symbols from Worker'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`🔍 Marking ${polygonSymbols.length} tokens as in_polygon=true`);

    // First, reset all tokens to in_polygon=false (for tokens no longer in Polygon)
    const { error: resetError } = await supabase
      .from('token_cards')
      .update({ in_polygon: false })
      .eq('in_polygon', true);

    if (resetError) {
      console.warn('⚠️ Reset error:', resetError.message);
    }

    // Now mark matching tokens as in_polygon=true
    // Do in batches of 50 to avoid query size limits
    const BATCH_SIZE = 50;
    let markedCount = 0;

    for (let i = 0; i < polygonSymbols.length; i += BATCH_SIZE) {
      const batch = polygonSymbols.slice(i, i + BATCH_SIZE);
      
      const { data, error } = await supabase
        .from('token_cards')
        .update({ in_polygon: true })
        .in('canonical_symbol', batch)
        .select('canonical_symbol');

      if (error) {
        console.error(`❌ Batch ${i / BATCH_SIZE + 1} error:`, error.message);
      } else if (data) {
        markedCount += data.length;
      }
    }

    const duration = Date.now() - startTime;
    console.log(`✅ Marked ${markedCount} tokens as in_polygon=true in ${duration}ms`);

    return new Response(JSON.stringify({
      success: true,
      marked: markedCount,
      totalFromWorker: polygonSymbols.length,
      duration_ms: duration,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
