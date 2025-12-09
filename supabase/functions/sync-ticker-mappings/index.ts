import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Exchange priority for preferred exchange selection
const EXCHANGE_PRIORITY: Record<string, number> = {
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Parse request body for batch parameters
    const body = await req.json().catch(() => ({}));
    const batchSize = body.batchSize || 500;
    const offset = body.offset || 0;

    console.log(`🚀 Starting ticker mappings sync (offset: ${offset}, batch: ${batchSize})...`);

    // 1. Get existing symbols to skip (quick check)
    const { data: existingMappings } = await supabase
      .from('ticker_mappings')
      .select('symbol');

    const existingSymbols = new Set<string>();
    if (existingMappings) {
      for (const m of existingMappings) {
        existingSymbols.add(m.symbol.toUpperCase());
      }
    }
    console.log(`✅ Found ${existingSymbols.size} existing mapped symbols`);

    // 2. Get exchange pairs in batches
    const { data: exchangePairs, error: pairsError } = await supabase
      .from('exchange_pairs')
      .select('base_asset, quote_asset, exchange, symbol')
      .eq('is_active', true)
      .range(offset, offset + batchSize - 1);

    if (pairsError) throw pairsError;

    if (!exchangePairs || exchangePairs.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No more pairs to process',
          stats: { processed: 0, mapped: 0, skipped: 0, hasMore: false },
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`📥 Processing ${exchangePairs.length} pairs (offset ${offset})...`);

    // Group by base asset
    const assetMap = new Map<string, {
      exchanges: Set<string>;
      pairs: Array<{ quote: string; exchange: string; symbol: string }>;
    }>();

    for (const pair of exchangePairs) {
      const normalized = normalizeSymbol(pair.base_asset);
      if (!normalized) continue;
      
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

    // 3. Get CoinGecko lookup data (just symbols we need)
    const symbolsToLookup = Array.from(assetMap.keys()).filter(s => !existingSymbols.has(s));
    
    if (symbolsToLookup.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'All symbols in this batch already mapped',
          stats: { processed: assetMap.size, mapped: 0, skipped: assetMap.size, hasMore: exchangePairs.length === batchSize },
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch CoinGecko matches for symbols we need
    const { data: cgCoins } = await supabase
      .from('cg_master')
      .select('cg_id, symbol, name')
      .in('symbol', symbolsToLookup.map(s => s.toLowerCase()));

    const cgBySymbol = new Map<string, { cg_id: string; name: string }>();
    if (cgCoins) {
      for (const coin of cgCoins) {
        cgBySymbol.set(coin.symbol.toUpperCase(), { cg_id: coin.cg_id, name: coin.name });
      }
    }

    console.log(`💰 Found ${cgBySymbol.size} CoinGecko matches`);

    // 4. Build mappings for batch upsert
    const mappingsToUpsert: Array<{
      symbol: string;
      display_name: string;
      type: string;
      coingecko_id: string | null;
      tradingview_symbol: string;
      tradingview_supported: boolean;
      polygon_ticker: string | null;
      aliases: string[];
      is_active: boolean;
      preferred_exchange: string;
    }> = [];

    let skipped = 0;

    for (const [baseAsset, assetData] of assetMap) {
      // Skip if already exists
      if (existingSymbols.has(baseAsset)) {
        skipped++;
        continue;
      }

      const cgMatch = cgBySymbol.get(baseAsset);
      
      // Determine preferred exchange
      const sortedExchanges = Array.from(assetData.exchanges).sort(
        (a, b) => (EXCHANGE_PRIORITY[a] || 999) - (EXCHANGE_PRIORITY[b] || 999)
      );
      
      const trustedExchanges = sortedExchanges.filter(e => 
        !['binance', 'bybit', 'binance.us'].includes(e.toLowerCase())
      );
      
      const preferredExchange = trustedExchanges.length > 0 
        ? trustedExchanges[0] 
        : sortedExchanges[0];

      const hasTrustedExchange = trustedExchanges.length > 0;
      const hasMultipleExchanges = assetData.exchanges.size >= 3;
      const tradingViewSupported = hasTrustedExchange && hasMultipleExchanges;
      
      let tvSymbol: string;
      if (tradingViewSupported) {
        const tvExchange = TV_EXCHANGE_MAP[preferredExchange] || preferredExchange.toUpperCase();
        const mainPair = assetData.pairs.find(
          p => p.exchange === preferredExchange && p.quote === 'USDT'
        ) || assetData.pairs.find(
          p => p.exchange === preferredExchange && p.quote === 'USD'
        ) || assetData.pairs[0];
        tvSymbol = `${tvExchange}:${baseAsset}${mainPair.quote}`;
      } else {
        tvSymbol = `${baseAsset}USD`;
      }

      const aliases = Array.from(
        new Set(
          assetData.pairs.map(p => p.symbol).filter(s => s !== baseAsset)
        )
      ).slice(0, 10);

      // Only add if has CoinGecko match or multiple exchanges (quality signal)
      if (cgMatch || assetData.exchanges.size >= 2) {
        mappingsToUpsert.push({
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
        });
      } else {
        skipped++;
      }
    }

    console.log(`📦 Preparing to upsert ${mappingsToUpsert.length} mappings...`);

    // 5. Batch upsert with conflict handling
    let mapped = 0;
    const errors: string[] = [];

    if (mappingsToUpsert.length > 0) {
      // Use upsert with onConflict to handle duplicates gracefully
      const { error: upsertError, count } = await supabase
        .from('ticker_mappings')
        .upsert(mappingsToUpsert, { 
          onConflict: 'symbol',
          ignoreDuplicates: true 
        });

      if (upsertError) {
        console.error('❌ Upsert error:', upsertError.message);
        errors.push(upsertError.message);
      } else {
        mapped = mappingsToUpsert.length;
        console.log(`✅ Upserted ${mapped} mappings`);
      }
    }

    const hasMore = exchangePairs.length === batchSize;
    const stats = {
      processed: assetMap.size,
      mapped,
      skipped,
      errors,
      hasMore,
      nextOffset: hasMore ? offset + batchSize : null,
    };

    console.log('✅ Batch completed!', stats);

    return new Response(
      JSON.stringify({
        success: true,
        stats,
        message: `Processed ${stats.processed} assets: ${stats.mapped} mapped, ${stats.skipped} skipped`,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
