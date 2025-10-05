import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SyncStats {
  processed: number;
  mapped: number;
  pending: number;
  skipped: number;
  errors: string[];
}

// Exchange priority for preferred exchange selection
const EXCHANGE_PRIORITY = {
  'kraken': 1,
  'kucoin': 2,
  'gate.io': 3,
  'coinbase': 4,
  'okx': 5,
  'bitget': 6,
  'htx': 7,
  'bybit': 8,
  'mexc': 9,
  'binance.us': 10,
  'binance': 11,
};

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
};

function normalizeSymbol(symbol: string): string {
  return symbol
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .replace(/USD[CT]?$/, '')
    .replace(/BTC$/, '')
    .replace(/ETH$/, '');
}

function calculateSimilarity(s1: string, s2: string): number {
  const longer = s1.length > s2.length ? s1 : s2;
  const shorter = s1.length > s2.length ? s2 : s1;
  
  if (longer.length === 0) return 1.0;
  
  const editDistance = levenshteinDistance(longer, shorter);
  return (longer.length - editDistance) / longer.length;
}

function levenshteinDistance(s1: string, s2: string): number {
  const costs: number[] = [];
  for (let i = 0; i <= s1.length; i++) {
    let lastValue = i;
    for (let j = 0; j <= s2.length; j++) {
      if (i === 0) {
        costs[j] = j;
      } else if (j > 0) {
        let newValue = costs[j - 1];
        if (s1.charAt(i - 1) !== s2.charAt(j - 1)) {
          newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
        }
        costs[j - 1] = lastValue;
        lastValue = newValue;
      }
    }
    if (i > 0) costs[s2.length] = lastValue;
  }
  return costs[s2.length];
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('🚀 Starting ticker mappings sync...');

    const stats: SyncStats = {
      processed: 0,
      mapped: 0,
      pending: 0,
      skipped: 0,
      errors: [],
    };

    // 1. Get unique base assets from exchange_pairs with their exchanges
    const { data: exchangePairs, error: pairsError } = await supabase
      .from('exchange_pairs')
      .select('base_asset, quote_asset, exchange, symbol')
      .eq('is_active', true);

    if (pairsError) throw pairsError;

    console.log(`📊 Found ${exchangePairs.length} active exchange pairs`);

    // Group by base asset
    const assetMap = new Map<string, {
      exchanges: Set<string>;
      pairs: Array<{ quote: string; exchange: string; symbol: string }>;
    }>();

    for (const pair of exchangePairs) {
      const normalized = normalizeSymbol(pair.base_asset);
      if (!assetMap.has(normalized)) {
        assetMap.set(normalized, { exchanges: new Set(), pairs: [] });
      }
      const asset = assetMap.get(normalized)!;
      asset.exchanges.add(pair.exchange);
      asset.pairs.push({
        quote: pair.quote_asset,
        exchange: pair.exchange,
        symbol: pair.symbol,
      });
    }

    console.log(`🔍 Identified ${assetMap.size} unique base assets`);

    // 2. Get CoinGecko master data for matching
    const { data: cgCoins, error: cgError } = await supabase
      .from('cg_master')
      .select('cg_id, symbol, name');

    if (cgError) throw cgError;

    console.log(`💰 Loaded ${cgCoins.length} CoinGecko coins for matching`);

    // Create CoinGecko lookup maps
    const cgBySymbol = new Map<string, typeof cgCoins[0]>();
    const cgByName = new Map<string, typeof cgCoins[0]>();
    
    for (const coin of cgCoins) {
      cgBySymbol.set(coin.symbol.toUpperCase(), coin);
      cgByName.set(coin.name.toLowerCase(), coin);
    }

    // 3. Get existing ticker_mappings to avoid duplicates
    const { data: existingMappings } = await supabase
      .from('ticker_mappings')
      .select('symbol, aliases');

    const existingSymbols = new Set<string>();
    if (existingMappings) {
      for (const mapping of existingMappings) {
        existingSymbols.add(mapping.symbol.toUpperCase());
        if (mapping.aliases) {
          for (const alias of mapping.aliases) {
            existingSymbols.add(alias.toUpperCase());
          }
        }
      }
    }

    console.log(`✅ Found ${existingSymbols.size} existing mapped symbols`);

    // 4. Process each unique asset
    for (const [baseAsset, assetData] of assetMap) {
      stats.processed++;

      // Skip if already mapped
      if (existingSymbols.has(baseAsset)) {
        stats.skipped++;
        continue;
      }

      // Find CoinGecko match
      let cgMatch = cgBySymbol.get(baseAsset);
      let matchType = 'exact_symbol';
      let confidence = 0.0;

      if (!cgMatch) {
        // Try fuzzy name matching
        let bestMatch: typeof cgCoins[0] | null = null;
        let bestSimilarity = 0;

        for (const coin of cgCoins) {
          const similarity = calculateSimilarity(
            baseAsset,
            coin.symbol.toUpperCase()
          );
          if (similarity > bestSimilarity && similarity >= 0.8) {
            bestSimilarity = similarity;
            bestMatch = coin;
          }
        }

        if (bestMatch) {
          cgMatch = bestMatch;
          matchType = 'fuzzy_symbol';
          confidence = bestSimilarity * 0.7; // Lower confidence for fuzzy
        }
      } else {
        confidence = 0.9; // High confidence for exact match
      }

      // Determine preferred exchange based on priority
      const sortedExchanges = Array.from(assetData.exchanges).sort(
        (a, b) => (EXCHANGE_PRIORITY[a] || 999) - (EXCHANGE_PRIORITY[b] || 999)
      );
      const preferredExchange = sortedExchanges[0];

      // Build TradingView symbol
      const tvExchange = TV_EXCHANGE_MAP[preferredExchange] || 'KRAKEN';
      const mainPair = assetData.pairs.find(
        p => p.exchange === preferredExchange && p.quote === 'USDT'
      ) || assetData.pairs.find(
        p => p.exchange === preferredExchange && p.quote === 'USD'
      ) || assetData.pairs[0];

      const tvSymbol = `${tvExchange}:${baseAsset}${mainPair.quote}`;

      // Generate aliases from all pair variations
      const aliases = Array.from(
        new Set(
          assetData.pairs.map(p => p.symbol).filter(s => s !== baseAsset)
        )
      ).slice(0, 10); // Limit to 10 aliases

      // Boost confidence based on multi-exchange presence
      if (assetData.exchanges.size >= 3) {
        confidence += 0.1;
      }

      confidence = Math.min(confidence, 1.0);

      const mappingData = {
        symbol: baseAsset,
        display_name: cgMatch?.name || baseAsset,
        type: 'crypto',
        coingecko_id: cgMatch?.cg_id || null,
        tradingview_symbol: tvSymbol,
        polygon_ticker: null,
        aliases: aliases,
        is_active: true,
        preferred_exchange: preferredExchange,
      };

      try {
        if (confidence >= 0.80) {
          // High confidence: insert directly into ticker_mappings
          const { error: insertError } = await supabase
            .from('ticker_mappings')
            .insert(mappingData);

          if (insertError) {
            console.error(`❌ Failed to insert ${baseAsset}:`, insertError.message);
            stats.errors.push(`${baseAsset}: ${insertError.message}`);
          } else {
            stats.mapped++;
            if (stats.mapped % 100 === 0) {
              console.log(`✅ Mapped ${stats.mapped} symbols...`);
            }
          }
        } else if (confidence >= 0.50) {
          // Medium confidence: add to pending queue
          const { error: pendingError } = await supabase
            .from('pending_ticker_mappings')
            .insert({
              symbol: baseAsset,
              normalized_symbol: baseAsset,
              display_name: cgMatch?.name || null,
              coingecko_id: cgMatch?.cg_id || null,
              tradingview_symbol: tvSymbol,
              match_type: matchType,
              confidence_score: confidence,
              context: {
                exchanges: sortedExchanges,
                pair_count: assetData.pairs.length,
                preferred_exchange: preferredExchange,
              },
              status: 'pending',
            });

          if (pendingError) {
            console.error(`⚠️ Failed to add ${baseAsset} to pending:`, pendingError.message);
          } else {
            stats.pending++;
          }
        } else {
          stats.skipped++;
        }
      } catch (err) {
        console.error(`❌ Error processing ${baseAsset}:`, err);
        stats.errors.push(`${baseAsset}: ${err.message}`);
      }
    }

    console.log('✅ Sync completed!');
    console.log(`📊 Stats:`, stats);

    return new Response(
      JSON.stringify({
        success: true,
        stats,
        message: `Processed ${stats.processed} assets: ${stats.mapped} mapped, ${stats.pending} pending review, ${stats.skipped} skipped`,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('❌ Sync failed:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
