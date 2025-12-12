// Entity Resolver: Resolve tickers, names, addresses to canonical assets
// FIX #6: Proper ambiguity handling with ranking by market cap

import { SessionContext } from "./context.ts";

export interface ResolvedAsset {
  symbol: string;
  type: 'crypto' | 'stock' | 'unknown';
  coingeckoId?: string;
  polygonTicker?: string;
  source: 'context' | 'alias' | 'database' | 'guess';
  assumptionNote?: string;
  address?: string;
}

const TICKER_ALIASES: Record<string, string> = {
  'ETHE': 'ETH', 'ETHER': 'ETH', 'ETHEREUM': 'ETH', 'ETHERIUM': 'ETH',
  'BITC': 'BTC', 'BITCOIN': 'BTC', 'BITCOINS': 'BTC',
  'SOLA': 'SOL', 'SOLANA': 'SOL',
  'DOGECOIN': 'DOGE', 'DOGEE': 'DOGE',
  'CARDAN': 'ADA', 'CARDANO': 'ADA',
  'RIPPLE': 'XRP', 'RIPL': 'XRP',
  'CHAINLINK': 'LINK', 'CHAINLIN': 'LINK',
  'AVALANCH': 'AVAX', 'AVALANCHE': 'AVAX',
  'POLKADOT': 'DOT', 'POLKA': 'DOT',
  'POLYGON': 'MATIC', 'POLYG': 'MATIC', 'POL': 'MATIC',
  'LITECOIN': 'LTC', 'LITC': 'LTC',
  'UNISWAP': 'UNI', 'UNIS': 'UNI',
  'SHIBA': 'SHIB', 'SHIBAINU': 'SHIB',
  'COSM': 'ATOM', 'COSMOS': 'ATOM',
  'BINANCE': 'BNB', 'BINACE': 'BNB',
  'TETHER': 'USDT', 'STABLECOIN': 'USDT',
  'APPLE': 'AAPL', 'APPL': 'AAPL',
  'NVIDIA': 'NVDA', 'NVIDI': 'NVDA', 'NVIDEA': 'NVDA',
  'TESLA': 'TSLA', 'TESLE': 'TSLA',
  'MICROSOFT': 'MSFT', 'MICRO': 'MSFT',
  'GOOGLE': 'GOOGL', 'GOGLE': 'GOOGL', 'GOOG': 'GOOGL',
  'AMAZON': 'AMZN', 'AMAZN': 'AMZN',
  'COINBASE': 'COIN', 'COINBSE': 'COIN',
  'MICROSTRATEGY': 'MSTR', 'MICROSTR': 'MSTR',
};

const FILTER_WORDS = new Set([
  'THE', 'AND', 'FOR', 'NOT', 'YOU', 'ARE', 'BUT', 'CAN', 'NOW', 'HOW', 'WHY', 'WHO',
  'DEX', 'CEX', 'API', 'USD', 'EUR', 'GBP', 'NFT', 'DAO', 'TVL', 'APY', 'APR', 'ATH', 'ATL',
  'THIS', 'THAT', 'WITH', 'FROM', 'YOUR', 'MAKE', 'POST', 'ABOUT', 'WHAT', 'SAFE', 'ADDRESS',
  'TOKEN', 'TOKENS', 'COIN', 'COINS', 'CRYPTO', 'PRICE', 'PRICES', 'DATA', 'INFO', 'CHART',
  'MARKET', 'MARKETS', 'TRADE', 'TRADES', 'BUY', 'SELL', 'HOLD', 'TODAY', 'NEWS', 'CHECK',
]);

// Top cryptos by market cap for popularity ranking
const TOP_CRYPTOS = ['BTC', 'ETH', 'USDT', 'BNB', 'SOL', 'XRP', 'USDC', 'ADA', 'DOGE', 'AVAX',
  'TRX', 'LINK', 'DOT', 'MATIC', 'SHIB', 'LTC', 'BCH', 'UNI', 'ATOM', 'XLM'];

export async function resolveEntities(
  supabase: any,
  userQuery: string,
  context: SessionContext
): Promise<ResolvedAsset[]> {
  const resolved: ResolvedAsset[] = [];
  const seen = new Set<string>();
  
  // Extract potential tickers from query
  const queryTickers = extractTickers(userQuery);
  
  // Extract addresses from query
  const queryAddress = extractAddress(userQuery);
  
  // Handle pronouns ("it", "this") - use context
  if (isPronouns(userQuery) && context.recentAssets.length > 0) {
    const contextAsset = context.recentAssets[0];
    if (!seen.has(contextAsset)) {
      seen.add(contextAsset);
      resolved.push({
        symbol: contextAsset,
        type: 'crypto',
        source: 'context',
      });
    }
  }
  
  // Resolve each extracted ticker
  for (const ticker of queryTickers) {
    if (seen.has(ticker)) continue;
    
    const asset = await resolveSingleTicker(supabase, ticker, context);
    if (asset) {
      seen.add(asset.symbol);
      resolved.push(asset);
    }
  }
  
  // If no assets found but context has assets, use first context asset
  if (resolved.length === 0 && context.recentAssets.length > 0) {
    const contextAsset = context.recentAssets[0];
    resolved.push({
      symbol: contextAsset,
      type: 'crypto',
      source: 'context',
    });
  }
  
  // Attach address if found
  if (queryAddress && resolved.length > 0) {
    resolved[0].address = queryAddress;
  }
  
  return resolved.slice(0, 5); // Max 5 assets
}

function extractTickers(query: string): string[] {
  const tickers: string[] = [];
  const matches = query.match(/\$?[A-Za-z]{2,10}\b/g) || [];
  
  for (const m of matches) {
    const cleaned = m.replace('$', '').toUpperCase();
    const resolved = TICKER_ALIASES[cleaned] || cleaned;
    
    if (!FILTER_WORDS.has(resolved) && resolved.length >= 2 && resolved.length <= 10) {
      if (!tickers.includes(resolved)) {
        tickers.push(resolved);
      }
    }
  }
  
  return tickers;
}

function extractAddress(query: string): string | null {
  // EVM address
  const evmMatch = query.match(/\b(0x[a-fA-F0-9]{40})\b/);
  if (evmMatch) return evmMatch[1].toLowerCase();
  
  // Solana address
  const solMatch = query.match(/\b([1-9A-HJ-NP-Za-km-z]{32,44})\b/);
  if (solMatch && /[A-Z]/.test(solMatch[1]) && /[a-z]/.test(solMatch[1]) && /[0-9]/.test(solMatch[1])) {
    return solMatch[1];
  }
  
  return null;
}

function isPronouns(query: string): boolean {
  const pronounPattern = /\b(it|this|that|the same|this one|that one)\b/i;
  return pronounPattern.test(query) && !extractTickers(query).length;
}

// FIX #6: Proper ambiguity handling with ranking
async function resolveSingleTicker(
  supabase: any,
  ticker: string,
  context: SessionContext
): Promise<ResolvedAsset | null> {
  const normalized = ticker.toUpperCase();
  
  // Check alias first
  if (TICKER_ALIASES[normalized]) {
    return {
      symbol: TICKER_ALIASES[normalized],
      type: 'crypto',
      source: 'alias',
    };
  }
  
  // FIX #6: Query ALL matches and rank them
  const candidates: Array<{
    symbol: string;
    type: 'crypto' | 'stock';
    coingeckoId?: string;
    polygonTicker?: string;
    marketCap?: number;
    matchType: 'exact' | 'alias';
  }> = [];
  
  // Try ticker_mappings - get all matches
  const { data: tickerMappings } = await supabase
    .from('ticker_mappings')
    .select('symbol, type, coingecko_id, polygon_ticker, aliases')
    .or(`symbol.eq.${normalized},aliases.cs.{${normalized}}`)
    .limit(10);
  
  if (tickerMappings) {
    for (const tm of tickerMappings) {
      candidates.push({
        symbol: tm.symbol,
        type: tm.type === 'stock' ? 'stock' : 'crypto',
        coingeckoId: tm.coingecko_id,
        polygonTicker: tm.polygon_ticker,
        matchType: tm.symbol === normalized ? 'exact' : 'alias',
      });
    }
  }
  
  // Also try crypto_snapshot for market cap data
  const { data: cryptoData } = await supabase
    .from('crypto_snapshot')
    .select('symbol, market_cap, coingecko_id')
    .ilike('symbol', normalized)
    .limit(5);
  
  if (cryptoData) {
    for (const c of cryptoData) {
      // Update or add with market cap
      const existing = candidates.find(x => x.symbol === c.symbol);
      if (existing) {
        existing.marketCap = c.market_cap;
        existing.coingeckoId = existing.coingeckoId || c.coingecko_id;
      } else {
        candidates.push({
          symbol: c.symbol,
          type: 'crypto',
          coingeckoId: c.coingecko_id,
          marketCap: c.market_cap,
          matchType: 'exact',
        });
      }
    }
  }
  
  // Try stock_snapshot
  const { data: stockData } = await supabase
    .from('stock_snapshot')
    .select('symbol, market_cap')
    .ilike('symbol', normalized)
    .limit(5);
  
  if (stockData) {
    for (const s of stockData) {
      const existing = candidates.find(x => x.symbol === s.symbol);
      if (existing) {
        existing.marketCap = s.market_cap;
      } else {
        candidates.push({
          symbol: s.symbol,
          type: 'stock',
          polygonTicker: s.symbol,
          marketCap: s.market_cap,
          matchType: 'exact',
        });
      }
    }
  }
  
  // If no candidates, make a best guess
  if (candidates.length === 0) {
    // Check if it's a top crypto
    if (TOP_CRYPTOS.includes(normalized)) {
      return {
        symbol: normalized,
        type: 'crypto',
        source: 'guess',
      };
    }
    
    // Check context for type inference
    const isCryptoContext = context.recentAssets.some(a => TOP_CRYPTOS.includes(a));
    
    if (/^[A-Z]{2,6}$/.test(normalized)) {
      return {
        symbol: normalized,
        type: isCryptoContext ? 'crypto' : 'unknown',
        source: 'guess',
        assumptionNote: `Assuming ${normalized} is ${isCryptoContext ? 'crypto' : 'an asset'} — say "switch to X" if different.`,
      };
    }
    
    return null;
  }
  
  // FIX #6: Rank candidates
  // 1. Context match (if in recent assets)
  // 2. Exact symbol match > alias match
  // 3. Higher market cap
  candidates.sort((a, b) => {
    // Context match priority
    const aInContext = context.recentAssets.includes(a.symbol) ? 1 : 0;
    const bInContext = context.recentAssets.includes(b.symbol) ? 1 : 0;
    if (aInContext !== bInContext) return bInContext - aInContext;
    
    // Exact match priority
    const aExact = a.matchType === 'exact' ? 1 : 0;
    const bExact = b.matchType === 'exact' ? 1 : 0;
    if (aExact !== bExact) return bExact - aExact;
    
    // Market cap priority
    const aMcap = a.marketCap || 0;
    const bMcap = b.marketCap || 0;
    return bMcap - aMcap;
  });
  
  const best = candidates[0];
  const hasAmbiguity = candidates.length > 1 && 
    candidates[0].symbol !== candidates[1].symbol;
  
  return {
    symbol: best.symbol,
    type: best.type,
    coingeckoId: best.coingeckoId,
    polygonTicker: best.polygonTicker,
    source: 'database',
    assumptionNote: hasAmbiguity 
      ? `Assuming you meant ${best.symbol} — say "switch to ${candidates[1].symbol}" if different.`
      : undefined,
  };
}
