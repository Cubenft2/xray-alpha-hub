import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  console.log('[bootstrap-polygon-to-token-cards] Starting...');

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Fetch all active Polygon crypto cards
    const { data: polygonCards, error: polygonError } = await supabase
      .from('polygon_crypto_cards')
      .select('canonical_symbol, name, primary_ticker, price_usd, change_24h_pct')
      .eq('is_active', true)
      .not('price_usd', 'is', null);

    if (polygonError) throw new Error(`Polygon fetch error: ${polygonError.message}`);
    
    console.log(`[bootstrap] Found ${polygonCards?.length || 0} active Polygon tokens`);

    // Update all tokens with polygon_supported = true using batch updates
    let updatedCount = 0;
    
    for (const token of polygonCards || []) {
      const { error } = await supabase
        .from('token_cards')
        .update({
          polygon_ticker: token.primary_ticker,
          polygon_supported: true,
          price_usd: token.price_usd,
          change_24h_pct: token.change_24h_pct,
          updated_at: new Date().toISOString()
        })
        .eq('canonical_symbol', token.canonical_symbol);

      if (!error) updatedCount++;
    }

    const duration = Date.now() - startTime;
    const result = {
      success: true,
      stats: { polygonTokens: polygonCards?.length || 0, updated: updatedCount, durationMs: duration }
    };

    console.log('[bootstrap] Complete:', result);
    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[bootstrap] Error:', error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
