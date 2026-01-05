import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Exchange priority for TradingView symbols (higher = better)
// Prefer USD pairs over USDT, and reliable exchanges
const EXCHANGE_PRIORITY: Record<string, { priority: number; tvFormat: string; quoteAssets: string[] }> = {
  'coinbase': { priority: 100, tvFormat: 'COINBASE', quoteAssets: ['USD'] },
  'kraken': { priority: 90, tvFormat: 'KRAKEN', quoteAssets: ['USD'] },
  'bitstamp': { priority: 85, tvFormat: 'BITSTAMP', quoteAssets: ['USD'] },
  'gemini': { priority: 80, tvFormat: 'GEMINI', quoteAssets: ['USD'] },
  'okx': { priority: 75, tvFormat: 'OKX', quoteAssets: ['USD', 'USDT'] },
  'bybit': { priority: 70, tvFormat: 'BYBIT', quoteAssets: ['USDT'] },
  'binance': { priority: 65, tvFormat: 'BINANCE', quoteAssets: ['USDT', 'USD'] },
  'binance_us': { priority: 63, tvFormat: 'BINANCEUS', quoteAssets: ['USD', 'USDT'] },
  'kucoin': { priority: 60, tvFormat: 'KUCOIN', quoteAssets: ['USDT'] },
  'gateio': { priority: 55, tvFormat: 'GATEIO', quoteAssets: ['USDT'] },
  'htx': { priority: 50, tvFormat: 'HTX', quoteAssets: ['USDT'] },
  'mexc': { priority: 45, tvFormat: 'MEXC', quoteAssets: ['USDT'] },
  'bitget': { priority: 40, tvFormat: 'BITGET', quoteAssets: ['USDT'] },
};

// Quote asset priority (USD > USDT > USDC) - case-insensitive lookup
const QUOTE_PRIORITY: Record<string, number> = {
  'USD': 100,
  'USDT': 50,
  'USDC': 40,
  'EUR': 30,
  'BTC': 20,
};

// Valid quote assets for filtering (case-insensitive)
const VALID_QUOTE_ASSETS = ['USD', 'USDT', 'USDC'];

interface ExchangePair {
  exchange: string;
  base_asset: string;
  quote_asset: string;
  symbol: string;
  is_active: boolean;
}

interface TokenCard {
  id: string;
  canonical_symbol: string;
  exchanges: string[] | null;
  best_exchange: string | null;
  tradingview_symbol: string | null;
}

function calculatePairScore(exchange: string, quoteAsset: string): number {
  const exchangeConfig = EXCHANGE_PRIORITY[exchange.toLowerCase()];
  if (!exchangeConfig) return 0;
  
  const quotePriority = QUOTE_PRIORITY[quoteAsset.toUpperCase()] || 10;
  
  // Combine exchange priority with quote asset priority
  // Exchange is weighted more heavily (multiply by 10)
  return (exchangeConfig.priority * 10) + quotePriority;
}

function generateTradingViewSymbol(exchange: string, baseAsset: string, quoteAsset: string): string {
  const exchangeConfig = EXCHANGE_PRIORITY[exchange.toLowerCase()];
  if (!exchangeConfig) {
    // Fallback format
    return `${exchange.toUpperCase()}:${baseAsset}${quoteAsset}`;
  }
  
  return `${exchangeConfig.tvFormat}:${baseAsset}${quoteAsset}`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('Starting exchange ticker auto-mapping...');

    // Step 1: Fetch ALL exchange pairs (both active and inactive, paginated)
    // Note: We fetch all and filter in JS because quote_asset can be mixed case (e.g., 'usdt' from HTX)
    const allExchangePairs: ExchangePair[] = [];
    const PAGE_SIZE = 1000;
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      const { data: batch, error: batchError } = await supabase
        .from('exchange_pairs')
        .select('exchange, base_asset, quote_asset, symbol, is_active')
        .range(offset, offset + PAGE_SIZE - 1);

      if (batchError) {
        console.error('Error fetching exchange pairs batch:', batchError);
        throw batchError;
      }

      if (batch && batch.length > 0) {
        // Filter for valid quote assets case-insensitively
        const filtered = batch.filter(p => 
          VALID_QUOTE_ASSETS.includes(p.quote_asset.toUpperCase())
        );
        allExchangePairs.push(...filtered);
        offset += batch.length;
        hasMore = batch.length === PAGE_SIZE;
      } else {
        hasMore = false;
      }
    }

    console.log(`Fetched ${allExchangePairs.length} total exchange pairs with valid quote assets (active + inactive)`);

    // Step 2: Group pairs by base asset (symbol), separating active vs inactive
    const activePairsBySymbol = new Map<string, ExchangePair[]>();
    const inactivePairsBySymbol = new Map<string, ExchangePair[]>();
    
    for (const pair of allExchangePairs) {
      const symbol = pair.base_asset.toUpperCase();
      const targetMap = pair.is_active ? activePairsBySymbol : inactivePairsBySymbol;
      
      if (!targetMap.has(symbol)) {
        targetMap.set(symbol, []);
      }
      targetMap.get(symbol)!.push(pair);
    }

    console.log(`Found active pairs for ${activePairsBySymbol.size} symbols, inactive pairs for ${inactivePairsBySymbol.size} symbols`);

    // Step 3: Calculate best exchange and TradingView symbol for each
    // Prioritize active pairs, fall back to inactive if no active pairs exist
    const symbolMappings = new Map<string, {
      exchanges: string[];
      bestExchange: string;
      tradingviewSymbol: string;
      bestPair: ExchangePair;
      isFromInactive: boolean;
    }>();

    // Get all unique symbols from both maps
    const allSymbols = new Set([...activePairsBySymbol.keys(), ...inactivePairsBySymbol.keys()]);

    for (const symbol of allSymbols) {
      // Prefer active pairs, fall back to inactive
      const activePairs = activePairsBySymbol.get(symbol) || [];
      const inactivePairs = inactivePairsBySymbol.get(symbol) || [];
      
      const pairs = activePairs.length > 0 ? activePairs : inactivePairs;
      const isFromInactive = activePairs.length === 0 && inactivePairs.length > 0;

      if (pairs.length === 0) continue;

      // Score each pair
      const scoredPairs = pairs.map(pair => ({
        pair,
        score: calculatePairScore(pair.exchange, pair.quote_asset)
      }));

      // Sort by score (highest first)
      scoredPairs.sort((a, b) => b.score - a.score);

      if (scoredPairs.length > 0 && scoredPairs[0].score > 0) {
        const bestPair = scoredPairs[0].pair;
        const allPairsForSymbol = [...activePairs, ...inactivePairs];
        const uniqueExchanges = [...new Set(allPairsForSymbol.map(p => p.exchange.toLowerCase()))];
        
        symbolMappings.set(symbol, {
          exchanges: uniqueExchanges,
          bestExchange: bestPair.exchange.toLowerCase(),
          tradingviewSymbol: generateTradingViewSymbol(
            bestPair.exchange, 
            bestPair.base_asset, 
            bestPair.quote_asset
          ),
          bestPair,
          isFromInactive
        });
      }
    }

    const fromInactiveCount = Array.from(symbolMappings.values()).filter(m => m.isFromInactive).length;
    console.log(`Generated mappings for ${symbolMappings.size} symbols (${fromInactiveCount} from inactive pairs only)`);

    // Step 4: Fetch ALL token_cards (paginated)
    const allTokenCards: TokenCard[] = [];
    offset = 0;
    hasMore = true;

    while (hasMore) {
      const { data: batch, error: batchError } = await supabase
        .from('token_cards')
        .select('id, canonical_symbol, exchanges, best_exchange, tradingview_symbol')
        .eq('is_active', true)
        .range(offset, offset + PAGE_SIZE - 1);

      if (batchError) {
        console.error('Error fetching token cards batch:', batchError);
        throw batchError;
      }

      if (batch && batch.length > 0) {
        allTokenCards.push(...(batch as TokenCard[]));
        offset += batch.length;
        hasMore = batch.length === PAGE_SIZE;
      } else {
        hasMore = false;
      }
    }

    console.log(`Found ${allTokenCards.length} active token cards`);

    // Step 5: Prepare updates
    const updates: Array<{
      id: string;
      exchanges: string[];
      best_exchange: string;
      tradingview_symbol: string;
    }> = [];

    const clears: string[] = []; // IDs to clear exchange data

    for (const card of allTokenCards) {
      const mapping = symbolMappings.get(card.canonical_symbol);
      
      if (mapping) {
        // Token has exchange data - update it
        updates.push({
          id: card.id,
          exchanges: mapping.exchanges,
          best_exchange: mapping.bestExchange,
          tradingview_symbol: mapping.tradingviewSymbol
        });
      } else if (card.best_exchange || card.tradingview_symbol) {
        // Token had exchange data but no longer has - clear it
        clears.push(card.id);
      }
    }

    console.log(`Preparing ${updates.length} updates and ${clears.length} clears`);

    // Step 6: Batch update token_cards using parallel updates for speed
    let updatedCount = 0;
    let clearedCount = 0;

    // Process updates in parallel batches of 50 concurrent updates
    const PARALLEL_SIZE = 50;
    const BATCH_SIZE = 50;
    for (let i = 0; i < updates.length; i += PARALLEL_SIZE) {
      const batch = updates.slice(i, i + PARALLEL_SIZE);
      
      const updatePromises = batch.map(update => 
        supabase
          .from('token_cards')
          .update({
            exchanges: update.exchanges,
            best_exchange: update.best_exchange,
            tradingview_symbol: update.tradingview_symbol
          })
          .eq('id', update.id)
      );

      const results = await Promise.all(updatePromises);
      const successCount = results.filter(r => !r.error).length;
      updatedCount += successCount;
      
      // Log progress every 500 updates
      if ((i + PARALLEL_SIZE) % 500 === 0 || i + PARALLEL_SIZE >= updates.length) {
        console.log(`Progress: ${Math.min(i + PARALLEL_SIZE, updates.length)}/${updates.length} updates processed`);
      }
    }

    // Clear tokens that no longer have exchange pairs
    for (let i = 0; i < clears.length; i += BATCH_SIZE) {
      const batch = clears.slice(i, i + BATCH_SIZE);
      
      const { error: clearError } = await supabase
        .from('token_cards')
        .update({
          exchanges: [],
          best_exchange: null,
          tradingview_symbol: null
        })
        .in('id', batch);

      if (clearError) {
        console.error('Error clearing exchange data:', clearError);
      } else {
        clearedCount += batch.length;
      }
    }

    // Step 7: Also update ticker_mappings table
    let tickerMappingsUpdated = 0;
    
    for (const [symbol, mapping] of symbolMappings) {
      const { error: tmError } = await supabase
        .from('ticker_mappings')
        .update({
          tradingview_symbol: mapping.tradingviewSymbol
        })
        .eq('symbol', symbol)
        .eq('type', 'crypto');

      if (!tmError) {
        tickerMappingsUpdated++;
      }
    }

    // Log some examples
    const examples = Array.from(symbolMappings.entries()).slice(0, 10);
    console.log('Sample mappings:');
    for (const [symbol, mapping] of examples) {
      console.log(`  ${symbol}: ${mapping.tradingviewSymbol} (${mapping.exchanges.join(', ')})`);
    }

    const result = {
      success: true,
      stats: {
        exchangePairsProcessed: allExchangePairs.length,
        uniqueSymbolsWithPairs: symbolMappings.size,
        tokenCardsUpdated: updatedCount,
        tokenCardsCleared: clearedCount,
        tickerMappingsUpdated,
        totalTokenCards: allTokenCards.length
      },
      examples: examples.map(([symbol, mapping]) => ({
        symbol,
        tradingviewSymbol: mapping.tradingviewSymbol,
        bestExchange: mapping.bestExchange,
        exchanges: mapping.exchanges
      }))
    };

    console.log('Auto-mapping complete:', JSON.stringify(result.stats));

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('Error in auto-map-exchange-tickers:', error);
    const message = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: message 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
