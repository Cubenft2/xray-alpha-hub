// Entity Resolver: Resolve tickers, names, addresses to canonical assets
// FIX #6: Proper ambiguity handling with ranking by market cap
// FIX: Comprehensive stopword filtering to prevent common words as tickers

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

// FIX #1: Comprehensive stopword blacklist - pronouns, verbs, helpers, chat words
const STOPWORDS = new Set([
  // Pronouns / possessives
  'I', 'ME', 'MY', 'MINE', 'YOU', 'YOUR', 'YOURS', 'WE', 'US', 'OUR', 'OURS',
  'THEY', 'THEM', 'THEIR', 'THEIRS', 'IT', 'ITS', 'HE', 'HIM', 'HIS', 'SHE', 'HER', 'HERS',
  
  // Common verbs / helpers
  'IS', 'ARE', 'WAS', 'WERE', 'BE', 'BEEN', 'BEING', 'AM',
  'DO', 'DOES', 'DID', 'DONE', 'DOING',
  'HAS', 'HAD', 'HAVE', 'HAVING',
  'CAN', 'COULD', 'SHOULD', 'WOULD', 'WILL', 'WONT', 'DONT', 'NOT',
  'YES', 'NO', 'YEAH', 'NAH', 'YEP', 'NOPE', 'OK', 'OKAY',
  
  // Question words
  'WHAT', 'WHY', 'HOW', 'WHEN', 'WHERE', 'WHO', 'WHOM', 'WHICH',
  
  // Articles / prepositions / conjunctions
  'A', 'AN', 'THE', 'AND', 'OR', 'BUT', 'IF', 'THEN', 'ELSE',
  'WITH', 'WITHOUT', 'OF', 'FOR', 'TO', 'FROM', 'IN', 'ON', 'AT', 'BY',
  
  // Chat/task words that trigger false positives
  'WRITE', 'MAKE', 'CREATE', 'POST', 'TWEET', 'THREAD', 'CAPTION',
  'ANALYZE', 'ANALYSIS', 'CHECK', 'SAFE', 'SAFETY', 'NEWS',
  'PRICE', 'CHART', 'TRENDING', 'SENTIMENT', 'TODAY', 'NOW',
  'PLEASE', 'HELP', 'GIVE', 'GAVE', 'LET', 'LETS', 'TELL', 'TOLD',
  'SHOW', 'FIND', 'SEARCH', 'LOOK', 'SEE', 'WANT', 'NEED', 'ASK',
  
  // Common crypto/finance words that aren't tickers
  'CRYPTO', 'TOKEN', 'TOKENS', 'COIN', 'COINS',
  'MARKET', 'MARKETS', 'VOLUME', 'MCAP', 'LIQUIDITY',
  'DEX', 'CEX', 'WALLET', 'ADDRESS', 'CONTRACT',
  'USD', 'EUR', 'GBP', 'NFT', 'DAO', 'TVL', 'APY', 'APR', 'ATH', 'ATL',
  'BUY', 'SELL', 'HOLD', 'TRADE', 'TRADES', 'LONG', 'SHORT',
  
  // Additional common words
  'THIS', 'THAT', 'THESE', 'THOSE', 'SUCH', 'OWN',
  'REAL', 'TRUE', 'FALSE', 'HIGH', 'LOW', 'BIG', 'SMALL', 'LARGE',
  'FIRST', 'LAST', 'SAME', 'OTHER', 'ANOTHER', 'NEXT',
  'BECAUSE', 'SINCE', 'AFTER', 'BEFORE', 'DURING', 'UNTIL', 'WHILE',
  'SOME', 'MANY', 'MUCH', 'MOST', 'MORE', 'LESS', 'FEW',
  'JUST', 'ALSO', 'ONLY', 'EVEN', 'VERY', 'REALLY', 'STILL', 'YET',
  'ALL', 'GET', 'NEW', 'ONE', 'TWO', 'OUT', 'DAY', 'ANY',
  'GOOD', 'WELL', 'BEST', 'GREAT', 'NICE', 'COOL', 'BAD', 'WORST',
  'ABOUT', 'SAID', 'SAYS', 'SAY', 'THINK', 'KNOW', 'FEEL', 'BELIEVE',
  'THANKS', 'THANK', 'THX', 'LIKE', 'AWESOME',
  'COPY', 'PASTE', 'DATA', 'INFO', 'COMPLETE',
]);

// Top cryptos by market cap for popularity ranking and validation
const TOP_CRYPTOS = ['BTC', 'ETH', 'USDT', 'BNB', 'SOL', 'XRP', 'USDC', 'ADA', 'DOGE', 'AVAX',
  'TRX', 'LINK', 'DOT', 'MATIC', 'SHIB', 'LTC', 'BCH', 'UNI', 'ATOM', 'XLM',
  'NEAR', 'APT', 'ARB', 'OP', 'FIL', 'INJ', 'AAVE', 'MKR', 'RENDER', 'FET',
  'SUI', 'PEPE', 'WIF', 'BONK', 'FLOKI', 'MEME', 'TAO', 'KAS', 'HBAR', 'VET'];

// FIX #1: Check if token looks like a valid ticker
function looksLikeTicker(token: string, hadDollar: boolean): boolean {
  // If user typed $ETH, treat it as intentional
  if (hadDollar) return /^[A-Z0-9]{2,10}$/.test(token);

  // Without $, be stricter: 2-6 chars, mostly letters, avoid pure words
  if (!/^[A-Z0-9]{2,6}$/.test(token)) return false;
  if (STOPWORDS.has(token)) return false;

  // Block super-common English two-letter words (extra defense)
  if (token.length === 2 && ['IN', 'ON', 'AT', 'TO', 'OF', 'IT', 'IS', 'AS', 'OR', 'AN', 'UP', 'SO', 'GO', 'NO', 'IF', 'BY', 'BE', 'AM', 'WE', 'US', 'ME', 'MY', 'HE'].includes(token)) {
    return false;
  }

  return true;
}

// FIX #1: Updated extractTickers with comprehensive filtering
function extractTickers(query: string): string[] {
  const out: string[] = [];
  const matches = query.match(/\$?[A-Za-z0-9]{2,10}\b/g) || [];

  for (const m of matches) {
    const hadDollar = m.startsWith('$');
    const cleanedRaw = m.replace('$', '');
    const cleaned = cleanedRaw.toUpperCase();

    const aliased = TICKER_ALIASES[cleaned] || cleaned;

    if (!looksLikeTicker(aliased, hadDollar)) continue;

    if (!out.includes(aliased)) out.push(aliased);
  }

  return out;
}

// FIX #3: For content intent, only extract tickers with $ prefix
function extractTickersOnlyWithDollar(query: string): string[] {
  const out: string[] = [];
  const matches = query.match(/\$[A-Za-z0-9]{2,10}\b/g) || [];
  
  for (const m of matches) {
    const cleaned = m.replace('$', '').toUpperCase();
    const aliased = TICKER_ALIASES[cleaned] || cleaned;
    if (!/^[A-Z0-9]{2,10}$/.test(aliased)) continue;
    if (!out.includes(aliased)) out.push(aliased);
  }
  
  return out;
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
  const tickers = extractTickers(query);
  return pronounPattern.test(query) && tickers.length === 0;
}

export async function resolveEntities(
  supabase: any,
  userQuery: string,
  context: SessionContext,
  intent?: string
): Promise<ResolvedAsset[]> {
  const resolved: ResolvedAsset[] = [];
  const seen = new Set<string>();
  
  // FIX #3: For content intent, only extract $TICKER or use context
  const queryTickers = (intent === 'content')
    ? extractTickersOnlyWithDollar(userQuery)
    : extractTickers(userQuery);
  
  // Extract addresses from query
  const queryAddress = extractAddress(userQuery);
  
  // FIX #2: Handle pronouns ("it", "this") - use lastResolvedAsset first
  if (isPronouns(userQuery)) {
    const ref = context.lastResolvedAsset || context.recentAssets[0];
    if (ref && !seen.has(ref)) {
      seen.add(ref);
      resolved.push({
        symbol: ref,
        type: 'crypto',
        source: 'context',
      });
    }
  }
  
  // Resolve each extracted ticker with DB validation
  for (const ticker of queryTickers) {
    if (seen.has(ticker)) continue;
    
    const asset = await resolveSingleTicker(supabase, ticker, context);
    if (asset) {
      seen.add(asset.symbol);
      resolved.push(asset);
    }
  }
  
  // FIX #2: If no assets found but context has assets, use lastResolvedAsset
  if (resolved.length === 0) {
    const ref = context.lastResolvedAsset || context.recentAssets[0];
    if (ref) {
      resolved.push({
        symbol: ref,
        type: 'crypto',
        source: 'context',
      });
    }
  }
  
  // Attach address if found
  if (queryAddress && resolved.length > 0) {
    resolved[0].address = queryAddress;
  }
  
  return resolved.slice(0, 5); // Max 5 assets
}

// FIX #4 & #6: Proper ambiguity handling with ranking + no guessing for unknown
async function resolveSingleTicker(
  supabase: any,
  ticker: string,
  context: SessionContext
): Promise<ResolvedAsset | null> {
  const normalized = ticker.toUpperCase();
  
  // Check alias first
  if (TICKER_ALIASES[normalized] && TICKER_ALIASES[normalized] !== normalized) {
    const aliasedSymbol = TICKER_ALIASES[normalized];
    // Verify aliased symbol exists in DB or TOP_CRYPTOS
    if (TOP_CRYPTOS.includes(aliasedSymbol)) {
      return {
        symbol: aliasedSymbol,
        type: 'crypto',
        source: 'alias',
      };
    }
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
    .select('symbol, market_cap, coingecko_id, name')
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

  // 4. Try matching by display_name in ticker_mappings (for name-based queries like "memecore")
  if (candidates.length === 0) {
    const { data: nameMatches } = await supabase
      .from('ticker_mappings')
      .select('symbol, type, coingecko_id, polygon_ticker, display_name')
      .ilike('display_name', `%${normalized}%`)
      .eq('is_active', true)
      .limit(5);

    if (nameMatches) {
      for (const nm of nameMatches) {
        candidates.push({
          symbol: nm.symbol,
          type: nm.type === 'stock' ? 'stock' : 'crypto',
          coingeckoId: nm.coingecko_id,
          polygonTicker: nm.polygon_ticker,
          matchType: 'alias',
        });
      }
    }
  }

  // 5. Try matching by name in crypto_snapshot (for LunarCrush data)
  if (candidates.length === 0) {
    const { data: cryptoNameData } = await supabase
      .from('crypto_snapshot')
      .select('symbol, market_cap, coingecko_id, name')
      .ilike('name', `%${normalized}%`)
      .order('market_cap', { ascending: false, nullsFirst: false })
      .limit(5);

    if (cryptoNameData) {
      for (const c of cryptoNameData) {
        candidates.push({
          symbol: c.symbol,
          type: 'crypto',
          coingeckoId: c.coingecko_id,
          marketCap: c.market_cap,
          matchType: 'alias',
        });
      }
    }
  }
  
  // FIX #4: If no DB matches, only allow if it's a known top crypto
  if (candidates.length === 0) {
    if (TOP_CRYPTOS.includes(normalized)) {
      return {
        symbol: normalized,
        type: 'crypto',
        source: 'guess',
      };
    }
    
    // FIX #4: Do NOT guess for unknown tickers - return null
    // This prevents random uppercase words from becoming fake assets
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
