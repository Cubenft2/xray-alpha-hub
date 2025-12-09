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

    // Step 4: Group coins by symbol and select best candidate for each
    const coinsBySymbol = new Map<string, any[]>();
    
    for (const coin of allCoins) {
      const symbol = coin.symbol.toUpperCase();
      if (!coinsBySymbol.has(symbol)) {
        coinsBySymbol.set(symbol, []);
      }
      coinsBySymbol.get(symbol)!.push(coin);
    }

    console.log(`🔍 Found ${coinsBySymbol.size} unique symbols from ${allCoins.length} total coins`);

    // Step 5: For each unique symbol, pick the best coin candidate
    const newMappings: any[] = [];
    let skippedExisting = 0;
    let skippedDuplicates = 0;

    for (const [symbol, coins] of coinsBySymbol) {
      // Skip if already in ticker_mappings
      if (existingSymbols.has(symbol)) {
        skippedExisting++;
        continue;
      }

      // Sort coins to find the best candidate:
      // 1. Prefer coins with exchange pairs (TradingView support)
      // 2. Prefer coins with more platforms (widely adopted)
      // 3. Prefer coins where name closely matches symbol
      const sortedCoins = coins.sort((a, b) => {
        const aHasExchange = symbolToExchange[symbol] ? 1 : 0;
        const bHasExchange = symbolToExchange[symbol] ? 1 : 0;
        
        const aPlatforms = Object.keys(a.platforms || {}).length;
        const bPlatforms = Object.keys(b.platforms || {}).length;
        
        // Name similarity to symbol (rough heuristic)
        const aNameMatch = a.name.toUpperCase().includes(symbol) ? 1 : 0;
        const bNameMatch = b.name.toUpperCase().includes(symbol) ? 1 : 0;
        
        // Score: exchange support (10) + platforms (1 each) + name match (5)
        const aScore = (aHasExchange * 10) + aPlatforms + (aNameMatch * 5);
        const bScore = (bHasExchange * 10) + bPlatforms + (bNameMatch * 5);
        
        return bScore - aScore; // Higher score first
      });

      const bestCoin = sortedCoins[0];
      skippedDuplicates += coins.length - 1; // Count skipped duplicates

      // Skip if this coingecko_id already exists
      if (existingCgIds.has(bestCoin.cg_id)) {
        skippedExisting++;
        continue;
      }

      // Determine TradingView symbol
      const exchangeInfo = symbolToExchange[symbol];
      let tradingviewSymbol: string;
      let tradingviewSupported = false;

      if (exchangeInfo) {
        tradingviewSymbol = `${exchangeInfo.exchange}:${symbol}${exchangeInfo.quoteAsset}`;
        tradingviewSupported = true;
      } else {
        tradingviewSymbol = `${symbol}USD`;
        tradingviewSupported = false;
      }

      // Extract DEX platforms/contract addresses
      const platforms = bestCoin.platforms || {};
      const dexPlatforms = Object.keys(platforms).length > 0 ? platforms : null;

      newMappings.push({
        symbol,
        display_name: bestCoin.name,
        type: 'crypto',
        coingecko_id: bestCoin.cg_id,
        tradingview_symbol: tradingviewSymbol,
        tradingview_supported: tradingviewSupported,
        dex_platforms: dexPlatforms,
        is_active: true,
        price_supported: true,
      });
    }

    console.log(`📝 Prepared ${newMappings.length} new unique mappings to insert`);
    console.log(`⏭️ Skipped ${skippedExisting} already existing, ${skippedDuplicates} duplicate coins`);

    // Step 6: Batch upsert with ON CONFLICT DO NOTHING
    const INSERT_BATCH_SIZE = 100; // Smaller batches for safer inserts
    let totalInserted = 0;
    let totalSkipped = 0;
    const errors: string[] = [];

    for (let i = 0; i < newMappings.length; i += INSERT_BATCH_SIZE) {
      const batch = newMappings.slice(i, i + INSERT_BATCH_SIZE);
      
      // Use upsert with ignoreDuplicates to handle any remaining conflicts
      const { data: inserted, error: insertError } = await supabase
        .from('ticker_mappings')
        .upsert(batch, { 
          onConflict: 'symbol',
          ignoreDuplicates: true 
        })
        .select('symbol');

      if (insertError) {
        console.error(`❌ Insert error at batch ${i}: ${insertError.message}`);
        errors.push(insertError.message);
      } else {
        const insertedCount = inserted?.length || 0;
        totalInserted += insertedCount;
        totalSkipped += batch.length - insertedCount;
        
        if ((i + INSERT_BATCH_SIZE) % 1000 === 0 || i + INSERT_BATCH_SIZE >= newMappings.length) {
          console.log(`✅ Progress: ${i + batch.length}/${newMappings.length} processed (${totalInserted} inserted)`);
        }
      }
    }

    const result = {
      success: true,
      totalCgMaster: allCoins.length,
      uniqueSymbols: coinsBySymbol.size,
      existingMappings: existingSymbols.size,
      newMappingsInserted: totalInserted,
      skippedExisting,
      skippedDuplicateCoins: skippedDuplicates,
      skippedConflicts: totalSkipped,
      errors: errors.length,
      errorMessages: errors.slice(0, 5),
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
