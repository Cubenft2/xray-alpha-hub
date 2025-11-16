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

async function fetchAllRows(supabase: any, table: string, columns: string, filters?: any): Promise<any[]> {
  const BATCH_SIZE = 1000;
  let allRows: any[] = [];
  let from = 0;
  let hasMore = true;

  while (hasMore) {
    let query = supabase
      .from(table)
      .select(columns)
      .range(from, from + BATCH_SIZE - 1);

    if (filters) {
      for (const [key, value] of Object.entries(filters)) {
        query = query.eq(key, value);
      }
    }

    const { data, error } = await query;

    if (error) throw error;

    if (data && data.length > 0) {
      allRows = allRows.concat(data);
      console.log(`📥 Fetched ${allRows.length} rows from ${table}...`);
      
      if (data.length < BATCH_SIZE) {
        hasMore = false;
      } else {
        from += BATCH_SIZE;
      }
    } else {
      hasMore = false;
    }
  }

  return allRows;
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

    // 1. Get ALL exchange pairs with pagination
    console.log('📥 Fetching all exchange pairs...');
    const exchangePairs = await fetchAllRows(
      supabase,
      'exchange_pairs',
      'base_asset, quote_asset, exchange, symbol',
      { is_active: true }
    );

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

    // 2. Get ALL CoinGecko master data with pagination
    console.log('📥 Fetching all CoinGecko coins...');
    const cgCoins = await fetchAllRows(
      supabase,
      'cg_master',
      'cg_id, symbol, name'
    );

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
    console.log(`🔄 Processing ${assetMap.size} unique assets...`);
    for (const [baseAsset, assetData] of assetMap) {
      stats.processed++;

      // Log progress every 500 assets
      if (stats.processed % 500 === 0) {
        console.log(`⏳ Progress: ${stats.processed}/${assetMap.size} assets processed...`);
      }

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

      // Determine preferred exchange - STRICT RULES
      // NEVER default to Binance or Bybit as first choice
      const sortedExchanges = Array.from(assetData.exchanges).sort(
        (a, b) => (EXCHANGE_PRIORITY[a] || 999) - (EXCHANGE_PRIORITY[b] || 999)
      );
      
      // Filter out Binance and Bybit for trusted exchanges
      const trustedExchanges = sortedExchanges.filter(e => 
        !['binance', 'bybit', 'binance.us'].includes(e.toLowerCase())
      );
      
      const preferredExchange = trustedExchanges.length > 0 
        ? trustedExchanges[0] 
        : sortedExchanges[0];

      // Only set TradingView symbol if we have valid exchange:pair format
      const hasTrustedExchange = trustedExchanges.length > 0;
      const hasMultipleExchanges = assetData.exchanges.size >= 3;
      const tradingViewSupported = hasTrustedExchange && hasMultipleExchanges;
      
      let tvSymbol: string | null = null;
      if (tradingViewSupported) {
        const tvExchange = TV_EXCHANGE_MAP[preferredExchange] || preferredExchange.toUpperCase();
        
        // Prefer USD pairs, fallback to USDT
        const mainPair = assetData.pairs.find(
          p => p.exchange === preferredExchange && p.quote === 'USD'
        ) || assetData.pairs.find(
          p => p.exchange === preferredExchange && p.quote === 'USDT'
        ) || assetData.pairs[0];
        
        // Only set if we have a valid exchange prefix
        if (tvExchange && mainPair) {
          tvSymbol = `${tvExchange}:${baseAsset}${mainPair.quote}`;
        }
      }

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
        tradingview_supported: tradingViewSupported,
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
                tradingview_supported: tradingViewSupported,
                needs_manual_tv_review: !tradingViewSupported,
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
