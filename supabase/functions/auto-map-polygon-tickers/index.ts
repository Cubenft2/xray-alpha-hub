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
      .order('symbol')
      .limit(2000);

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

    // Process individually to avoid batch issues
    let mappedCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    for (const token of unmappedTokens) {
      const polygonTicker = `X:${token.symbol.toUpperCase()}USD`;
      
      const { error: updateError } = await supabase
        .from('ticker_mappings')
        .update({ polygon_ticker: polygonTicker })
        .eq('id', token.id);

      if (updateError) {
        errorCount++;
        if (errors.length < 5) {
          errors.push(`${token.symbol}: ${updateError.message}`);
        }
      } else {
        mappedCount++;
      }
      
      // Log progress every 500
      if ((mappedCount + errorCount) % 500 === 0) {
        console.log(`⏳ Progress: ${mappedCount + errorCount}/${unmappedTokens.length}`);
      }
    }

    const duration = Date.now() - startTime;

    // Check how many remain
    const { count: remainingCount } = await supabase
      .from('ticker_mappings')
      .select('*', { count: 'exact', head: true })
      .eq('type', 'crypto')
      .eq('is_active', true)
      .is('polygon_ticker', null);

    console.log(`🏁 Auto-mapping complete in ${duration}ms`);
    console.log(`   Mapped: ${mappedCount}`);
    console.log(`   Errors: ${errorCount}`);
    console.log(`   Remaining: ${remainingCount || 0}`);

    return new Response(
      JSON.stringify({
        status: 'success',
        mapped: mappedCount,
        errors: errorCount,
        error_samples: errors,
        remaining: remainingCount || 0,
        duration_ms: duration,
        message: remainingCount && remainingCount > 0
          ? `Mapped ${mappedCount} tokens. Run again to process ${remainingCount} more.`
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
