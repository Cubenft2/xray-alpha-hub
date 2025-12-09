import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('🚀 Auto-mapping Polygon tickers for all crypto tokens...');

    // Get all active crypto tokens WITHOUT polygon_ticker
    const { data: unmappedTokens, error: fetchError } = await supabase
      .from('ticker_mappings')
      .select('id, symbol, display_name')
      .eq('type', 'crypto')
      .eq('is_active', true)
      .is('polygon_ticker', null)
      .order('symbol');

    if (fetchError) {
      throw new Error(`Failed to fetch unmapped tokens: ${fetchError.message}`);
    }

    if (!unmappedTokens || unmappedTokens.length === 0) {
      console.log('✅ All crypto tokens already have polygon_ticker mapped!');
      return new Response(
        JSON.stringify({ 
          status: 'complete', 
          message: 'All tokens already mapped',
          mapped: 0 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`📊 Found ${unmappedTokens.length} unmapped crypto tokens`);

    // Process in batches of 500 to avoid worker limits
    const BATCH_SIZE = 500;
    const MAX_PROCESS = 2000; // Process up to 2000 per run to stay within timeout
    const toProcess = unmappedTokens.slice(0, MAX_PROCESS);
    
    let mappedCount = 0;
    let errorCount = 0;

    for (let i = 0; i < toProcess.length; i += BATCH_SIZE) {
      const batch = toProcess.slice(i, i + BATCH_SIZE);
      
      // Create polygon_ticker mappings: X:{SYMBOL}USD format
      const updates = batch.map(token => ({
        id: token.id,
        polygon_ticker: `X:${token.symbol.toUpperCase()}USD`
      }));

      // Batch update
      const { error: updateError } = await supabase
        .from('ticker_mappings')
        .upsert(updates, { onConflict: 'id' });

      if (updateError) {
        console.error(`❌ Batch update error at ${i}:`, updateError);
        errorCount += batch.length;
      } else {
        mappedCount += batch.length;
        console.log(`✅ Mapped batch ${Math.floor(i / BATCH_SIZE) + 1}: ${batch.length} tokens`);
      }
    }

    const duration = Date.now() - startTime;
    const remaining = unmappedTokens.length - MAX_PROCESS;

    console.log(`🏁 Auto-mapping complete in ${duration}ms`);
    console.log(`   Mapped: ${mappedCount}`);
    console.log(`   Errors: ${errorCount}`);
    console.log(`   Remaining: ${remaining > 0 ? remaining : 0}`);

    return new Response(
      JSON.stringify({
        status: 'success',
        mapped: mappedCount,
        errors: errorCount,
        remaining: remaining > 0 ? remaining : 0,
        total_unmapped: unmappedTokens.length,
        duration_ms: duration,
        message: remaining > 0 
          ? `Mapped ${mappedCount} tokens. Run again to process ${remaining} more.`
          : `All ${mappedCount} tokens mapped successfully!`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Auto-map error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
