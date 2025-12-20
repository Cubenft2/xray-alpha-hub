// Entity Resolver: Resolve tickers, names, addresses to canonical assets
// Hybrid approach: Regex first, LLM fallback for ambiguous queries only

import { SessionContext } from "./context.ts";

// LLM extraction for ambiguous queries - uses OpenAI gpt-4o-mini
async function extractWithLLM(query: string): Promise<{ tickers: string[], intent?: string } | null> {
  const openAIKey = Deno.env.get('OPENAI_API_KEY');
  if (!openAIKey) {
    console.log('[resolver] No OPENAI_API_KEY, skipping LLM extraction');
    return null;
  }
  
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        max_tokens: 100,
        temperature: 0,
        messages: [
          {
            role: 'system',
            content: `Extract crypto/stock tickers from the user query. Return JSON only.
Rules:
- Convert project names to tickers (World Liberty Finance → WLFI, Nvidia → NVDA)
- Include explicit $TICKER mentions
- Max 3 tickers, ordered by relevance
- If no tickers found, return empty array
Response format: {"tickers": ["BTC", "ETH"], "intent": "price|news|analysis|general"}`
          },
          { role: 'user', content: query }
        ],
      }),
    });
    
    if (!response.ok) {
      console.log(`[resolver] LLM extraction failed: ${response.status}`);
      return null;
    }
    
    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) return null;
    
    // Parse JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    
    const parsed = JSON.parse(jsonMatch[0]);
    console.log(`[resolver] LLM extracted: ${JSON.stringify(parsed)}`);
    return {
      tickers: (parsed.tickers || []).map((t: string) => t.toUpperCase()),
      intent: parsed.intent,
    };
  } catch (err) {
    console.log(`[resolver] LLM extraction error: ${err}`);
    return null;
  }
}

// Check if query is ambiguous and needs LLM help
function isAmbiguousQuery(query: string, explicit: string[], candidates: string[]): boolean {
  // Clear cases - no LLM needed:
  // 1. Has explicit $TICKER
  if (explicit.length > 0) return false;
  
  // 2. Has clear candidates that are in TOP_CRYPTOS
  const topCryptoMatches = candidates.filter(c => TOP_CRYPTOS.has(c));
  if (topCryptoMatches.length > 0) return false;
  
  // 3. Short simple query with no candidates (probably general chat)
  if (query.length < 20 && candidates.length === 0) return false;
  
  // Ambiguous cases - LLM can help:
  // 1. Long query with potential project names
  if (query.length > 30 && candidates.length === 0) {
    // Check for potential project name patterns
    const hasProjectWords = /\b(coin|token|finance|financial|protocol|chain|network|dao)\b/i.test(query);
    if (hasProjectWords) return true;
  }
  
  // 2. Query mentions comparison/multiple assets without clear tickers
  if (/\b(vs|versus|compare|between|or)\b/i.test(query) && candidates.length < 2) {
    return true;
  }
  
  // 3. Contains company/project names without ticker symbols
  const companyPatterns = /\b(nvidia|microsoft|apple|google|amazon|coinbase|stripe|openai|tesla|meta)\b/i;
  if (companyPatterns.test(query) && !explicit.some(t => ['NVDA', 'MSFT', 'AAPL', 'GOOGL', 'AMZN', 'COIN', 'TSLA', 'META'].includes(t))) {
    return true;
  }
  
  return false;
}

export interface ResolvedAsset {
  symbol: string;
  type: 'crypto' | 'stock' | 'unknown';
  coingeckoId?: string;
  polygonTicker?: string;
  source: 'context' | 'alias' | 'database' | 'explicit';
  assumptionNote?: string;
  address?: string;
}

// Ticker aliases: common names/misspellings → canonical symbols
const TICKER_ALIASES: Record<string, string> = {
  // Crypto names
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
  // Stock names
  'APPLE': 'AAPL', 'APPL': 'AAPL',
  'NVIDIA': 'NVDA', 'NVIDI': 'NVDA', 'NVIDEA': 'NVDA',
  'TESLA': 'TSLA', 'TESLE': 'TSLA',
  'MICROSOFT': 'MSFT', 'MICRO': 'MSFT',
  'GOOGLE': 'GOOGL', 'GOGLE': 'GOOGL', 'GOOG': 'GOOGL',
  'AMAZON': 'AMZN', 'AMAZN': 'AMZN',
  'COINBASE': 'COIN', 'COINBSE': 'COIN',
  'MICROSTRATEGY': 'MSTR', 'MICROSTR': 'MSTR',
  // Project names (multi-word)
  'WORLDLIBERTYFINANCE': 'WLFI', 'WORLDLIBERTY': 'WLFI',
  'PEPECOIN': 'PEPE', 'PEPEMEME': 'PEPE',
};

// Top cryptos by market cap - these are trusted even without DB lookup
const TOP_CRYPTOS = new Set([
  'BTC', 'ETH', 'USDT', 'BNB', 'SOL', 'XRP', 'USDC', 'ADA', 'DOGE', 'AVAX',
  'TRX', 'LINK', 'DOT', 'MATIC', 'SHIB', 'LTC', 'BCH', 'UNI', 'ATOM', 'XLM',
  'NEAR', 'APT', 'ARB', 'OP', 'FIL', 'INJ', 'AAVE', 'MKR', 'RENDER', 'FET',
  'SUI', 'PEPE', 'WIF', 'BONK', 'FLOKI', 'MEME', 'TAO', 'KAS', 'HBAR', 'VET',
]);

// Minimal stopwords - only for blocking explicit $TICKER that shouldn't be tickers
// Most filtering happens via DB validation now
const EXPLICIT_STOPWORDS = new Set([
  // These could be typed as $USD, $EUR etc but aren't tokens
  'USD', 'EUR', 'GBP', 'JPY', 'CNY', 'CAD', 'AUD',
  // Finance terms that might get $ prefix
  'ATH', 'ATL', 'TVL', 'APY', 'APR', 'ROI', 'PNL',
]);

interface ExtractedTickers {
  explicit: string[];   // User typed $TICKER - trusted
  candidates: string[]; // No $ prefix - needs DB validation
}

/**
 * Extract potential tickers from query
 * - Explicit ($TICKER): Trusted, user intentionally marked
 * - Candidates: Need DB validation before treating as ticker
 */
function extractTickers(query: string): ExtractedTickers {
  const explicit: string[] = [];
  const candidates: string[] = [];
  const seen = new Set<string>();
  
  // First, check for multi-word project names
  const queryUpper = query.toUpperCase().replace(/[^A-Z\s]/g, ' ');
  for (const [phrase, ticker] of Object.entries(TICKER_ALIASES)) {
    // Check if phrase (as words) appears in query
    const phraseWords = phrase.replace(/([A-Z])/g, ' $1').trim(); // "WORLDLIBERTY" -> "W O R L D..."
    if (queryUpper.includes(phrase) || queryUpper.includes(phrase.replace(/([a-z])([A-Z])/g, '$1 $2'))) {
      if (!seen.has(ticker)) {
        seen.add(ticker);
        explicit.push(ticker); // Project name match = trusted
      }
    }
  }
  
  // Check for "World Liberty Finance" style multi-word matches
  const multiWordPatterns = [
    { pattern: /world\s+liberty\s*(finance|financial)?/i, ticker: 'WLFI' },
    { pattern: /pepe\s+coin/i, ticker: 'PEPE' },
    { pattern: /shiba\s+inu/i, ticker: 'SHIB' },
    { pattern: /doge\s*coin/i, ticker: 'DOGE' },
  ];
  
  for (const { pattern, ticker } of multiWordPatterns) {
    if (pattern.test(query) && !seen.has(ticker)) {
      seen.add(ticker);
      explicit.push(ticker);
    }
  }
  
  // Extract individual tokens
  const matches = query.match(/\$?[A-Za-z]{2,10}\b/g) || [];
  
  for (const m of matches) {
    const hadDollar = m.startsWith('$');
    const cleaned = m.replace('$', '').toUpperCase();
    
    // Apply alias
    const aliased = TICKER_ALIASES[cleaned] || cleaned;
    
    // Skip if already found
    if (seen.has(aliased)) continue;
    
    // Validate format: 2-10 alphanumeric chars
    if (!/^[A-Z0-9]{2,10}$/.test(aliased)) continue;
    
    if (hadDollar) {
      // User explicitly marked with $ - trust it (unless blocked)
      if (!EXPLICIT_STOPWORDS.has(aliased)) {
        seen.add(aliased);
        explicit.push(aliased);
      }
    } else {
      // No $ prefix - candidate that needs DB validation
      // Only consider short, ticker-like strings (2-6 chars)
      if (aliased.length >= 2 && aliased.length <= 6) {
        seen.add(aliased);
        candidates.push(aliased);
      }
    }
  }
  
  return { explicit, candidates };
}

// For content intent, only extract $TICKER (not candidates)
function extractTickersOnlyWithDollar(query: string): string[] {
  const { explicit } = extractTickers(query);
  return explicit;
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
  const { explicit, candidates } = extractTickers(query);
  return pronounPattern.test(query) && explicit.length === 0 && candidates.length === 0;
}

export async function resolveEntities(
  supabase: any,
  userQuery: string,
  context: SessionContext,
  intent?: string
): Promise<ResolvedAsset[]> {
  const resolved: ResolvedAsset[] = [];
  const seen = new Set<string>();
  
  // For content intent, only extract $TICKER
  let { explicit, candidates } = (intent === 'content')
    ? { explicit: extractTickersOnlyWithDollar(userQuery), candidates: [] as string[] }
    : extractTickers(userQuery);
  
  console.log(`[resolver] Regex extracted - explicit: [${explicit.join(',')}], candidates: [${candidates.join(',')}]`);
  
  // Hybrid: Use LLM only for ambiguous queries
  if (isAmbiguousQuery(userQuery, explicit, candidates)) {
    console.log('[resolver] Query is ambiguous, trying LLM extraction...');
    const llmResult = await extractWithLLM(userQuery);
    if (llmResult && llmResult.tickers.length > 0) {
      // LLM found tickers - treat them as explicit (trusted)
      for (const ticker of llmResult.tickers) {
        if (!seen.has(ticker)) {
          seen.add(ticker);
          explicit.push(ticker);
        }
      }
      console.log(`[resolver] LLM added tickers: [${llmResult.tickers.join(',')}]`);
    }
  }
  
  // Extract addresses from query
  const queryAddress = extractAddress(userQuery);
  
  // Handle pronouns ("it", "this") - use lastResolvedAsset first
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
  
  // Process explicit tickers first (they're trusted)
  for (const ticker of explicit) {
    if (seen.has(ticker)) continue;
    
    // For explicit tickers, check if in TOP_CRYPTOS or resolve via DB
    if (TOP_CRYPTOS.has(ticker)) {
      seen.add(ticker);
      resolved.push({
        symbol: ticker,
        type: 'crypto',
        source: 'explicit',
      });
    } else {
      // Validate via DB
      const asset = await resolveSingleTicker(supabase, ticker, context, true);
      if (asset) {
        seen.add(asset.symbol);
        resolved.push(asset);
      } else {
        // Explicit ticker not in DB - still include but mark as explicit
        // User intentionally typed $SOMETHING
        seen.add(ticker);
        resolved.push({
          symbol: ticker,
          type: 'unknown',
          source: 'explicit',
          assumptionNote: `Note: ${ticker} was not found in our database.`,
        });
      }
    }
  }
  
  // Process candidates - ONLY include if validated in DB
  for (const ticker of candidates) {
    if (seen.has(ticker)) continue;
    
    // Quick check: is it a known top crypto?
    if (TOP_CRYPTOS.has(ticker)) {
      seen.add(ticker);
      resolved.push({
        symbol: ticker,
        type: 'crypto',
        source: 'database',
      });
      continue;
    }
    
    // Must exist in database to be treated as ticker
    const asset = await resolveSingleTicker(supabase, ticker, context, false);
    if (asset) {
      seen.add(asset.symbol);
      resolved.push(asset);
    }
    // If not in DB, silently ignore - it's probably just a regular word
  }
  
  // If no assets found but context has assets, use lastResolvedAsset
  // SKIP for market_overview intent - orchestrator will fetch top 25
  if (resolved.length === 0 && intent !== 'market_overview') {
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
  
  console.log(`[resolver] Resolved ${resolved.length} assets: [${resolved.map(a => a.symbol).join(',')}]`);
  
  return resolved.slice(0, 5); // Max 5 assets
}

/**
 * Resolve a single ticker against database
 * @param isExplicit - If true, user typed $TICKER so we're more trusting
 */
async function resolveSingleTicker(
  supabase: any,
  ticker: string,
  context: SessionContext,
  isExplicit: boolean
): Promise<ResolvedAsset | null> {
  const normalized = ticker.toUpperCase();
  
  // Check alias first
  const aliased = TICKER_ALIASES[normalized];
  if (aliased && aliased !== normalized) {
    // If aliased to a known crypto, accept it
    if (TOP_CRYPTOS.has(aliased)) {
      return {
        symbol: aliased,
        type: 'crypto',
        source: 'alias',
      };
    }
  }
  
  // Query DB for matches
  const candidates: Array<{
    symbol: string;
    type: 'crypto' | 'stock';
    coingeckoId?: string;
    polygonTicker?: string;
    marketCap?: number;
    matchType: 'exact' | 'alias';
  }> = [];
  
  // Try ticker_mappings
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
  
  // Query token_cards (master source)
  const { data: cryptoData } = await supabase
    .from('token_cards')
    .select('canonical_symbol, market_cap, coingecko_id, name')
    .ilike('canonical_symbol', normalized)
    .limit(5);

  if (cryptoData) {
    for (const c of cryptoData) {
      const existing = candidates.find(x => x.symbol === c.canonical_symbol);
      if (existing) {
        existing.marketCap = c.market_cap;
        existing.coingeckoId = existing.coingeckoId || c.coingecko_id;
      } else {
        candidates.push({
          symbol: c.canonical_symbol,
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

  // Try matching by name in token_cards
  if (candidates.length === 0) {
    const { data: cryptoNameData } = await supabase
      .from('token_cards')
      .select('canonical_symbol, market_cap, coingecko_id, name')
      .ilike('name', `%${normalized}%`)
      .order('market_cap', { ascending: false, nullsFirst: false })
      .limit(5);

    if (cryptoNameData) {
      for (const c of cryptoNameData) {
        candidates.push({
          symbol: c.canonical_symbol,
          type: 'crypto',
          coingeckoId: c.coingecko_id,
          marketCap: c.market_cap,
          matchType: 'alias',
        });
      }
    }
  }
  
  // No DB matches - return null (word is not a known ticker)
  if (candidates.length === 0) {
    return null;
  }
  
  // Rank candidates
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
