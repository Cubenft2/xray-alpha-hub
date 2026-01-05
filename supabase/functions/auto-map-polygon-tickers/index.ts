import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Validation regex: Only uppercase letters and numbers, 2-10 characters
const VALID_SYMBOL_REGEX = /^[A-Z0-9]{2,10}$/;

// Characters that indicate an invalid symbol
const INVALID_PATTERNS = [
  /\$/, // Dollar sign prefix
  /\s/, // Spaces
  /[^\x00-\x7F]/, // Non-ASCII (emojis, special chars)
  /^[0-9]+$/, // Numbers only
  /[a-z]/, // Lowercase letters (symbols should be uppercase)
];

function isValidSymbol(symbol: string): boolean {
  // Check against valid pattern
  if (!VALID_SYMBOL_REGEX.test(symbol.toUpperCase())) {
    return false;
  }
  
  // Check for any invalid patterns
  for (const pattern of INVALID_PATTERNS) {
    if (pattern.test(symbol)) {
      return false;
    }
  }
  
  return true;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('🚀 Auto-mapping Polygon tickers for crypto tokens with validation...');

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
          mapped: 0,
          skipped: 0
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`📊 Found ${unmappedTokens.length} unmapped crypto tokens`);

    let mappedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    const errors: string[] = [];
    const skippedSamples: string[] = [];

    for (const token of unmappedTokens) {
      // Validate symbol before mapping
      if (!isValidSymbol(token.symbol)) {
        skippedCount++;
        if (skippedSamples.length < 10) {
          skippedSamples.push(`${token.symbol} (${token.display_name})`);
        }
        continue;
      }

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
      if ((mappedCount + errorCount + skippedCount) % 500 === 0) {
        console.log(`⏳ Progress: ${mappedCount + errorCount + skippedCount}/${unmappedTokens.length}`);
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
    console.log(`   Skipped (invalid): ${skippedCount}`);
    console.log(`   Errors: ${errorCount}`);
    console.log(`   Remaining: ${remainingCount || 0}`);
    if (skippedSamples.length > 0) {
      console.log(`   Skipped samples: ${skippedSamples.join(', ')}`);
    }

    return new Response(
      JSON.stringify({
        status: 'success',
        mapped: mappedCount,
        skipped: skippedCount,
        skipped_samples: skippedSamples,
        errors: errorCount,
        error_samples: errors,
        remaining: remainingCount || 0,
        duration_ms: duration,
        message: remainingCount && remainingCount > 0
          ? `Mapped ${mappedCount} tokens, skipped ${skippedCount} invalid. Run again to process more.`
          : `All valid tokens mapped! ${skippedCount} invalid symbols skipped.`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Auto-map error:', error);
    const message = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
