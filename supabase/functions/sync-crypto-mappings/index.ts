import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Exchange priority for TradingView symbols (lower = better)
const EXCHANGE_PRIORITY: Record<string, { priority: number; format: string }> = {
  'coinbase': { priority: 1, format: 'COINBASE' },
  'kraken': { priority: 2, format: 'KRAKEN' },
  'kucoin': { priority: 3, format: 'KUCOIN' },
  'binance': { priority: 4, format: 'BINANCE' },
  'okx': { priority: 5, format: 'OKX' },
  'bybit': { priority: 6, format: 'BYBIT' },
  'mexc': { priority: 7, format: 'MEXC' },
  'gate': { priority: 8, format: 'GATEIO' },
  'huobi': { priority: 9, format: 'HUOBI' },
  'bitfinex': { priority: 10, format: 'BITFINEX' },
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('🚀 Starting comprehensive crypto sync from cg_master...');

    // Step 1: Get existing symbols in ticker_mappings to avoid duplicates
    const { data: existingMappings, error: existingError } = await supabase
      .from('ticker_mappings')
      .select('symbol, coingecko_id')
      .eq('type', 'crypto');

    if (existingError) {
      throw new Error(`Failed to fetch existing mappings: ${existingError.message}`);
    }

    const existingSymbols = new Set(existingMappings?.map(m => m.symbol.toUpperCase()) || []);
    const existingCgIds = new Set(existingMappings?.map(m => m.coingecko_id).filter(Boolean) || []);
    console.log(`📊 Found ${existingSymbols.size} existing crypto symbols in ticker_mappings`);

    // Step 2: Fetch all exchange pairs for TradingView symbol generation
    const { data: exchangePairs, error: pairsError } = await supabase
      .from('exchange_pairs')
      .select('base_asset, exchange, quote_asset')
      .eq('is_active', true);

    if (pairsError) {
      throw new Error(`Failed to fetch exchange pairs: ${pairsError.message}`);
    }

    // Build a map of symbol -> best exchange pair
    const symbolToExchange: Record<string, { exchange: string; quoteAsset: string; priority: number }> = {};
    
    for (const pair of exchangePairs || []) {
      const symbol = pair.base_asset.toUpperCase();
      const exchangeKey = pair.exchange.toLowerCase();
      const exchangeInfo = EXCHANGE_PRIORITY[exchangeKey];
      
      if (!exchangeInfo) continue;
      
      const existing = symbolToExchange[symbol];
      if (!existing || exchangeInfo.priority < existing.priority) {
        symbolToExchange[symbol] = {
          exchange: exchangeInfo.format,
          quoteAsset: pair.quote_asset.toUpperCase(),
          priority: exchangeInfo.priority,
        };
      }
    }

    console.log(`📈 Built exchange map for ${Object.keys(symbolToExchange).length} symbols`);

    // Step 3: Fetch ALL coins from cg_master in batches
    const BATCH_SIZE = 1000;
    let offset = 0;
    let allCoins: any[] = [];
    let hasMore = true;

    while (hasMore) {
      const { data: coins, error: coinsError } = await supabase
        .from('cg_master')
        .select('cg_id, symbol, name, platforms')
        .range(offset, offset + BATCH_SIZE - 1);

      if (coinsError) {
        throw new Error(`Failed to fetch cg_master batch at offset ${offset}: ${coinsError.message}`);
      }

      if (!coins || coins.length === 0) {
        hasMore = false;
      } else {
        allCoins = allCoins.concat(coins);
        offset += BATCH_SIZE;
        console.log(`📥 Fetched ${allCoins.length} coins from cg_master...`);
        
        if (coins.length < BATCH_SIZE) {
          hasMore = false;
        }
      }
    }

    console.log(`✅ Total coins in cg_master: ${allCoins.length}`);

    // Step 4: Filter and prepare new mappings
    const newMappings: any[] = [];
    let skippedExisting = 0;
    let skippedDuplicate = 0;
    const seenSymbols = new Set<string>();

    for (const coin of allCoins) {
      const symbol = coin.symbol.toUpperCase();
      
      // Skip if already in ticker_mappings (by symbol or coingecko_id)
      if (existingSymbols.has(symbol) || existingCgIds.has(coin.cg_id)) {
        skippedExisting++;
        continue;
      }

      // Skip duplicate symbols within this batch (keep first occurrence)
      if (seenSymbols.has(symbol)) {
        skippedDuplicate++;
        continue;
      }
      seenSymbols.add(symbol);

      // Determine TradingView symbol
      const exchangeInfo = symbolToExchange[symbol];
      let tradingviewSymbol: string;
      let tradingviewSupported = false;

      if (exchangeInfo) {
        // Has exchange pair - use proper format
        tradingviewSymbol = `${exchangeInfo.exchange}:${symbol}${exchangeInfo.quoteAsset}`;
        tradingviewSupported = true;
      } else {
        // No exchange pair - use placeholder
        tradingviewSymbol = `${symbol}USD`;
        tradingviewSupported = false;
      }

      // Extract DEX platforms/contract addresses
      const platforms = coin.platforms || {};
      const dexPlatforms = Object.keys(platforms).length > 0 ? platforms : null;

      newMappings.push({
        symbol,
        display_name: coin.name,
        type: 'crypto',
        coingecko_id: coin.cg_id,
        tradingview_symbol: tradingviewSymbol,
        tradingview_supported: tradingviewSupported,
        dex_platforms: dexPlatforms,
        is_active: true,
        price_supported: true, // CoinGecko can provide prices
      });
    }

    console.log(`📝 Prepared ${newMappings.length} new mappings to insert`);
    console.log(`⏭️ Skipped ${skippedExisting} already existing, ${skippedDuplicate} duplicates`);

    // Step 5: Batch insert new mappings
    const INSERT_BATCH_SIZE = 500;
    let totalInserted = 0;
    let totalErrors = 0;
    const errors: string[] = [];

    for (let i = 0; i < newMappings.length; i += INSERT_BATCH_SIZE) {
      const batch = newMappings.slice(i, i + INSERT_BATCH_SIZE);
      
      const { error: insertError, count } = await supabase
        .from('ticker_mappings')
        .insert(batch)
        .select();

      if (insertError) {
        console.error(`❌ Insert error at batch ${i}: ${insertError.message}`);
        errors.push(insertError.message);
        totalErrors += batch.length;
      } else {
        totalInserted += batch.length;
        console.log(`✅ Inserted batch ${i}-${i + batch.length} (${totalInserted} total)`);
      }
    }

    const result = {
      success: true,
      totalCgMaster: allCoins.length,
      existingMappings: existingSymbols.size,
      newMappingsInserted: totalInserted,
      skippedExisting,
      skippedDuplicates: skippedDuplicate,
      errors: totalErrors,
      errorMessages: errors.slice(0, 5), // First 5 errors only
      tradingviewSupported: newMappings.filter(m => m.tradingview_supported).length,
      tradingviewUnsupported: newMappings.filter(m => !m.tradingview_supported).length,
    };

    console.log('🎉 Crypto sync complete:', result);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ Sync error:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
