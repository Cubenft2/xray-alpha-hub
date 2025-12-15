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
  console.log('[bootstrap-polygon-to-token-cards] Starting bootstrap...');

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Fetch all active Polygon crypto cards
    const { data: polygonCards, error: polygonError } = await supabase
      .from('polygon_crypto_cards')
      .select('canonical_symbol, name, primary_ticker, price_usd, change_24h_pct, volume_24h, high_24h, low_24h, open_24h, rsi_14, macd, macd_signal, sma_20, sma_50, sma_200, ema_12, ema_26, price_updated_at, technicals_updated_at')
      .eq('is_active', true)
      .not('price_usd', 'is', null);

    if (polygonError) {
      throw new Error(`Failed to fetch polygon_crypto_cards: ${polygonError.message}`);
    }

    console.log(`[bootstrap-polygon-to-token-cards] Found ${polygonCards?.length || 0} active Polygon tokens`);

    if (!polygonCards || polygonCards.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        message: 'No active Polygon tokens found',
        stats: { inserted: 0, updated: 0, skipped: 0 }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Fetch existing token_cards to check what exists
    const { data: existingCards, error: existingError } = await supabase
      .from('token_cards')
      .select('canonical_symbol, polygon_ticker, polygon_supported');

    if (existingError) {
      throw new Error(`Failed to fetch token_cards: ${existingError.message}`);
    }

    // Create lookup maps
    const existingBySymbol = new Map<string, { polygon_ticker: string | null; polygon_supported: boolean | null }>();
    for (const card of existingCards || []) {
      existingBySymbol.set(card.canonical_symbol, { 
        polygon_ticker: card.polygon_ticker,
        polygon_supported: card.polygon_supported
      });
    }

    const toInsert: any[] = [];
    const toUpdate: any[] = [];
    let skipped = 0;

    for (const polygon of polygonCards) {
      const symbol = polygon.canonical_symbol;
      const existing = existingBySymbol.get(symbol);

      if (!existing) {
        // Token doesn't exist in token_cards - INSERT (minimal fields)
        toInsert.push({
          canonical_symbol: symbol,
          name: polygon.name || symbol,
          polygon_ticker: polygon.primary_ticker,
          polygon_supported: true,
          is_active: true,
          tier: 4,
          tier_reason: 'polygon_only',
          price_usd: polygon.price_usd,
          change_24h_pct: polygon.change_24h_pct,
          updated_at: new Date().toISOString()
        });
      } else if (!existing.polygon_ticker || existing.polygon_supported !== true) {
        // Token exists but needs polygon_supported flag - UPDATE
        toUpdate.push({
          canonical_symbol: symbol,
          polygon_ticker: polygon.primary_ticker,
          polygon_supported: true,
          updated_at: new Date().toISOString()
        });
      } else {
        skipped++;
      }
    }

    console.log(`[bootstrap-polygon-to-token-cards] To insert: ${toInsert.length}, To update: ${toUpdate.length}, Skipped: ${skipped}`);

    // Batch insert new tokens
    let insertedCount = 0;
    if (toInsert.length > 0) {
      const batchSize = 100;
      for (let i = 0; i < toInsert.length; i += batchSize) {
        const batch = toInsert.slice(i, i + batchSize);
        const { error: insertError } = await supabase
          .from('token_cards')
          .insert(batch);

        if (insertError) {
          console.error(`[bootstrap-polygon-to-token-cards] Insert batch error:`, insertError);
        } else {
          insertedCount += batch.length;
        }
      }
      console.log(`[bootstrap-polygon-to-token-cards] Inserted ${insertedCount} new tokens`);
    }

    // Batch update existing tokens
    let updatedCount = 0;
    if (toUpdate.length > 0) {
      for (const update of toUpdate) {
        const { canonical_symbol, ...updateData } = update;
        const { error: updateError } = await supabase
          .from('token_cards')
          .update(updateData)
          .eq('canonical_symbol', canonical_symbol);

        if (updateError) {
          console.error(`[bootstrap-polygon-to-token-cards] Update error for ${canonical_symbol}:`, updateError);
        } else {
          updatedCount++;
        }
      }
      console.log(`[bootstrap-polygon-to-token-cards] Updated ${updatedCount} existing tokens`);
    }

    const duration = Date.now() - startTime;
    const result = {
      success: true,
      stats: {
        polygonTokens: polygonCards.length,
        inserted: insertedCount,
        updated: updatedCount,
        skipped,
        durationMs: duration
      }
    };

    console.log(`[bootstrap-polygon-to-token-cards] Complete:`, result);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[bootstrap-polygon-to-token-cards] Error:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
