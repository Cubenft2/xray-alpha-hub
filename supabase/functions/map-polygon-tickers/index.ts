import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Target cryptos to map
const TARGET_CRYPTOS = [
  'BTC', 'ETH', 'BNB', 'SOL', 'XRP', 'ADA', 'AVAX', 'DOGE', 'DOT', 'MATIC',
  'LTC', 'LINK', 'UNI', 'ATOM', 'XLM', 'ALGO', 'FIL', 'ICP', 'APT', 'ARB',
  'OP', 'NEAR', 'SUI', 'TON', 'TRX', 'HBAR', 'VET', 'SAND', 'MANA', 'AXS',
  'GALA', 'ENJ', 'CHZ', 'FLOW', 'EOS', 'AAVE', 'MKR', 'SNX', 'CRV', 'COMP',
  'YFI', 'SUSHI', 'BAL', 'ZRX', '1INCH', 'RUNE', 'FTM', 'ONE', 'CELO', 'ZIL',
  'EGLD', 'KSM', 'WAVES', 'DASH', 'ZEC', 'XTZ', 'ETC', 'NEO', 'IOTA', 'THETA',
  'FET', 'RNDR', 'GRT', 'IMX', 'LDO', 'PEPE', 'BONK', 'WIF', 'PENGU', 'HYPE', 'ONDO'
];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log(`🎯 Mapping ${TARGET_CRYPTOS.length} target cryptos to Polygon tickers...`);

    let mappedCount = 0;
    let skippedCount = 0;
    const results = [];

    for (const symbol of TARGET_CRYPTOS) {
      // Get the ticker mapping
      const { data: mapping } = await supabase
        .from('ticker_mappings')
        .select('id, symbol, polygon_ticker')
        .or(`symbol.eq.${symbol},aliases.cs.{${symbol}}`)
        .eq('type', 'crypto')
        .eq('is_active', true)
        .limit(1)
        .maybeSingle();

      if (!mapping) {
        console.log(`⚠️ No mapping found for ${symbol}`);
        skippedCount++;
        continue;
      }

      if (mapping.polygon_ticker) {
        console.log(`✅ ${symbol} already mapped to ${mapping.polygon_ticker}`);
        skippedCount++;
        continue;
      }

      // Try to find Polygon ticker (prefer USD, fallback USDT)
      const { data: usdTicker } = await supabase
        .from('poly_tickers')
        .select('ticker')
        .eq('market', 'crypto')
        .eq('base_currency_symbol', symbol)
        .eq('currency_name', 'United States Dollar')
        .eq('active', true)
        .limit(1)
        .maybeSingle();

      const { data: usdtTicker } = await supabase
        .from('poly_tickers')
        .select('ticker')
        .eq('market', 'crypto')
        .eq('base_currency_symbol', symbol)
        .eq('currency_name', 'Tether USD')
        .eq('active', true)
        .limit(1)
        .maybeSingle();

      const polygonTicker = usdTicker?.ticker || usdtTicker?.ticker;

      if (!polygonTicker) {
        console.log(`❌ No Polygon ticker found for ${symbol}`);
        results.push({ symbol, status: 'not_found' });
        continue;
      }

      // Update the mapping
      const { error } = await supabase
        .from('ticker_mappings')
        .update({ polygon_ticker: polygonTicker })
        .eq('id', mapping.id);

      if (error) {
        console.error(`Error updating ${symbol}:`, error);
        results.push({ symbol, status: 'error', error: error.message });
      } else {
        console.log(`✅ Mapped ${symbol} → ${polygonTicker}`);
        mappedCount++;
        results.push({ symbol, polygonTicker, status: 'mapped' });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        mapped: mappedCount,
        skipped: skippedCount,
        total: TARGET_CRYPTOS.length,
        results
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
