// Entity Resolver: Resolve tickers, names, addresses to canonical assets
// NO CLARIFICATION - always pick best match

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
  
  // Try database lookup
  const { data: tickerMapping } = await supabase
    .from('ticker_mappings')
    .select('symbol, type, coingecko_id, polygon_ticker')
    .or(`symbol.eq.${normalized},aliases.cs.{${normalized}}`)
    .maybeSingle();
  
  if (tickerMapping) {
    return {
      symbol: tickerMapping.symbol,
      type: tickerMapping.type === 'stock' ? 'stock' : 'crypto',
      coingeckoId: tickerMapping.coingecko_id,
      polygonTicker: tickerMapping.polygon_ticker,
      source: 'database',
    };
  }
  
  // Try crypto_snapshot
  const { data: cryptoSnapshot } = await supabase
    .from('crypto_snapshot')
    .select('symbol, coingecko_id')
    .ilike('symbol', normalized)
    .maybeSingle();
  
  if (cryptoSnapshot) {
    return {
      symbol: cryptoSnapshot.symbol,
      type: 'crypto',
      coingeckoId: cryptoSnapshot.coingecko_id,
      source: 'database',
    };
  }
  
  // Try stock_snapshot
  const { data: stockSnapshot } = await supabase
    .from('stock_snapshot')
    .select('symbol')
    .ilike('symbol', normalized)
    .maybeSingle();
  
  if (stockSnapshot) {
    return {
      symbol: stockSnapshot.symbol,
      type: 'stock',
      polygonTicker: stockSnapshot.symbol,
      source: 'database',
    };
  }
  
  // Best guess based on popularity
  if (TOP_CRYPTOS.includes(normalized)) {
    return {
      symbol: normalized,
      type: 'crypto',
      source: 'guess',
    };
  }
  
  // Unknown but valid ticker format
  if (/^[A-Z]{2,6}$/.test(normalized)) {
    // Guess type based on length and context
    const isCryptoContext = context.recentAssets.some(a => TOP_CRYPTOS.includes(a));
    return {
      symbol: normalized,
      type: isCryptoContext ? 'crypto' : 'unknown',
      source: 'guess',
      assumptionNote: `Assuming ${normalized} is ${isCryptoContext ? 'crypto' : 'an asset'} — say "switch to X" if different.`,
    };
  }
  
  return null;
}
