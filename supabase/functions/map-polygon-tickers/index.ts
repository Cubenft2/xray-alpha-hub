import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Symbol normalization helpers
function normalizeSymbol(symbol: string): string {
  return symbol.toUpperCase().trim()
    .replace(/[-_\s]/g, '')
    .replace(/USD$|USDT$/, ''); // Strip common suffixes
}

function getSymbolVariants(symbol: string): string[] {
  const normalized = normalizeSymbol(symbol);
  const variants = [symbol, normalized];
  
  // Common wrapped token variants
  if (normalized.startsWith('W')) {
    variants.push(normalized.slice(1)); // WBTC → BTC
  }
  
  return [...new Set(variants)];
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get all unmapped cryptos from ticker_mappings
    const { data: unmappedCryptos, error: fetchError } = await supabase
      .from('ticker_mappings')
      .select('id, symbol, aliases')
      .eq('type', 'crypto')
      .eq('is_active', true)
      .is('polygon_ticker', null)
      .order('symbol');

    if (fetchError) throw fetchError;

    console.log(`🎯 Found ${unmappedCryptos?.length || 0} unmapped cryptos. Starting intelligent mapping...`);

    let mappedCount = 0;
    let skippedCount = 0;
    let notFoundCount = 0;
    const results = [];
    const notFoundSymbols = [];

    // Process in batches to avoid timeouts
    const BATCH_SIZE = 100;
    const totalBatches = Math.ceil((unmappedCryptos?.length || 0) / BATCH_SIZE);

    for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
      const batchStart = batchIndex * BATCH_SIZE;
      const batchEnd = Math.min(batchStart + BATCH_SIZE, unmappedCryptos?.length || 0);
      const batch = unmappedCryptos?.slice(batchStart, batchEnd) || [];

      console.log(`📦 Processing batch ${batchIndex + 1}/${totalBatches} (${batch.length} symbols)...`);

      for (const mapping of batch) {
        const symbol = mapping.symbol;
        const variants = getSymbolVariants(symbol);

        // Try to find Polygon ticker using symbol variants
        let polygonTicker = null;

        for (const variant of variants) {
          // Prefer USD, then USDT
          const { data: usdTicker } = await supabase
            .from('poly_tickers')
            .select('ticker, base_currency_symbol')
            .eq('market', 'crypto')
            .eq('base_currency_symbol', variant)
            .ilike('currency_name', 'United States dollar')
            .eq('active', true)
            .limit(1)
            .maybeSingle();

          if (usdTicker) {
            polygonTicker = usdTicker.ticker;
            console.log(`✅ Found USD pair: ${symbol} → ${polygonTicker} (via ${variant})`);
            break;
          }

          const { data: usdtTicker } = await supabase
            .from('poly_tickers')
            .select('ticker, base_currency_symbol')
            .eq('market', 'crypto')
            .eq('base_currency_symbol', variant)
            .eq('currency_name', 'Tether USD')
            .eq('active', true)
            .limit(1)
            .maybeSingle();

          if (usdtTicker) {
            polygonTicker = usdtTicker.ticker;
            console.log(`✅ Found USDT pair: ${symbol} → ${polygonTicker} (via ${variant})`);
            break;
          }
        }

        if (!polygonTicker) {
          notFoundCount++;
          notFoundSymbols.push(symbol);
          continue;
        }

        // Update the mapping
        const { error } = await supabase
          .from('ticker_mappings')
          .update({ polygon_ticker: polygonTicker })
          .eq('id', mapping.id);

        if (error) {
          console.error(`❌ Error updating ${symbol}:`, error);
          results.push({ symbol, status: 'error', error: error.message });
        } else {
          mappedCount++;
          results.push({ symbol, polygonTicker, status: 'mapped' });
        }
      }

      // Progress update
      console.log(`✨ Batch ${batchIndex + 1} complete: ${mappedCount} mapped, ${notFoundCount} not found`);
    }

    console.log(`\n🎉 Mapping complete!`);
    console.log(`   Mapped: ${mappedCount}`);
    console.log(`   Not Found: ${notFoundCount}`);
    console.log(`   Total Processed: ${unmappedCryptos?.length || 0}`);

    if (notFoundSymbols.length > 0 && notFoundSymbols.length <= 50) {
      console.log(`\n⚠️ Symbols without Polygon tickers (sample):`, notFoundSymbols.slice(0, 20));
    }

    return new Response(
      JSON.stringify({
        success: true,
        mapped: mappedCount,
        notFound: notFoundCount,
        total: unmappedCryptos?.length || 0,
        batchSize: BATCH_SIZE,
        notFoundSymbols: notFoundSymbols.slice(0, 100), // Return first 100 not found
        sampleResults: results.slice(0, 20) // Return first 20 mapped
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
