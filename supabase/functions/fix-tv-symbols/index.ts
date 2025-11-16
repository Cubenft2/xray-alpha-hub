import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Exchange priority for USD pairs (trusted exchanges first)
const USD_EXCHANGES = ['coinbase', 'kraken', 'bitstamp'];

// Exchange priority for USDT pairs (high liquidity venues)
const USDT_EXCHANGES = ['binance', 'okx', 'bybit', 'kucoin', 'mexc', 'gate.io'];

// TradingView exchange mapping
const TV_EXCHANGE_MAP: Record<string, string> = {
  'kraken': 'KRAKEN',
  'kucoin': 'KUCOIN',
  'gate.io': 'GATEIO',
  'coinbase': 'COINBASE',
  'binance': 'BINANCE',
  'bybit': 'BYBIT',
  'okx': 'OKX',
  'bitget': 'BITGET',
  'htx': 'HUOBI',
  'mexc': 'MEXC',
  'binance.us': 'BINANCEUS',
  'bitstamp': 'BITSTAMP',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('🔧 Starting TradingView symbol cleanup...');

    // Find mappings with invalid or missing tradingview_symbol
    const { data: invalidMappings, error: fetchError } = await supabase
      .from('ticker_mappings')
      .select('id, symbol, tradingview_symbol, type')
      .eq('is_active', true)
      .or('tradingview_symbol.is.null,tradingview_symbol.not.like.%:%');

    if (fetchError) throw fetchError;

    console.log(`📋 Found ${invalidMappings?.length || 0} mappings to fix`);

    const stats = {
      fixed: 0,
      failed: 0,
      errors: [] as string[],
    };

    // Fetch ALL exchange pairs once for efficiency
    const { data: allPairs, error: pairsError } = await supabase
      .from('exchange_pairs')
      .select('symbol, base_asset, quote_asset, exchange')
      .eq('is_active', true);

    if (pairsError) throw pairsError;

    console.log(`📥 Fetched ${allPairs?.length || 0} exchange pairs`);

    for (const mapping of invalidMappings || []) {
      try {
        const baseSymbol = mapping.symbol.toUpperCase();
        
        // Find pairs for this symbol
        const symbolPairs = allPairs?.filter(p => 
          p.base_asset.toUpperCase() === baseSymbol
        ) || [];

        if (symbolPairs.length === 0) {
          console.warn(`⚠️ No exchange pairs found for ${baseSymbol}`);
          stats.errors.push(`${baseSymbol}: No exchange pairs`);
          stats.failed++;
          continue;
        }

        // Try to find best pair: USD on trusted exchanges first
        let bestPair = null;
        let bestExchange = null;

        // Try USD on trusted exchanges
        for (const exchange of USD_EXCHANGES) {
          const pair = symbolPairs.find(p => 
            p.exchange.toLowerCase() === exchange && 
            p.quote_asset.toUpperCase() === 'USD'
          );
          if (pair) {
            bestPair = pair;
            bestExchange = TV_EXCHANGE_MAP[exchange.toLowerCase()];
            break;
          }
        }

        // Fallback to USDT on major exchanges
        if (!bestPair) {
          for (const exchange of USDT_EXCHANGES) {
            const pair = symbolPairs.find(p => 
              p.exchange.toLowerCase() === exchange && 
              p.quote_asset.toUpperCase() === 'USDT'
            );
            if (pair) {
              bestPair = pair;
              bestExchange = TV_EXCHANGE_MAP[exchange.toLowerCase()];
              break;
            }
          }
        }

        // Fallback: Try any USD pair
        if (!bestPair) {
          const usdPair = symbolPairs.find(p => p.quote_asset.toUpperCase() === 'USD');
          if (usdPair) {
            bestPair = usdPair;
            bestExchange = TV_EXCHANGE_MAP[usdPair.exchange.toLowerCase()] || usdPair.exchange.toUpperCase();
          }
        }

        // Last resort: Try any USDT pair
        if (!bestPair) {
          const usdtPair = symbolPairs.find(p => p.quote_asset.toUpperCase() === 'USDT');
          if (usdtPair) {
            bestPair = usdtPair;
            bestExchange = TV_EXCHANGE_MAP[usdtPair.exchange.toLowerCase()] || usdtPair.exchange.toUpperCase();
          }
        }

        if (!bestPair || !bestExchange) {
          console.warn(`⚠️ No suitable pair found for ${baseSymbol}`);
          stats.errors.push(`${baseSymbol}: No suitable pairs`);
          stats.failed++;
          continue;
        }

        const tvSymbol = `${bestExchange}:${bestPair.base_asset.toUpperCase()}${bestPair.quote_asset.toUpperCase()}`;

        // Update the mapping
        const { error: updateError } = await supabase
          .from('ticker_mappings')
          .update({
            tradingview_symbol: tvSymbol,
            tradingview_supported: true,
            updated_at: new Date().toISOString(),
          })
          .eq('id', mapping.id);

        if (updateError) {
          console.error(`❌ Failed to update ${baseSymbol}:`, updateError);
          stats.errors.push(`${baseSymbol}: ${updateError.message}`);
          stats.failed++;
        } else {
          console.log(`✅ Fixed ${baseSymbol} → ${tvSymbol}`);
          stats.fixed++;
        }

      } catch (err: any) {
        console.error(`❌ Error processing ${mapping.symbol}:`, err);
        stats.errors.push(`${mapping.symbol}: ${err.message}`);
        stats.failed++;
      }
    }

    console.log('🎉 Cleanup complete:', stats);

    return new Response(JSON.stringify({
      success: true,
      stats,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('❌ Function error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
