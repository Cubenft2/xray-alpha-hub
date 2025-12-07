import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// AI Provider types
type AIProvider = 'lovable' | 'openai' | 'anthropic';

// Top cryptos to fetch general prices for
const TOP_CRYPTOS = ['BTC', 'ETH', 'SOL', 'XRP', 'ADA', 'DOGE', 'LINK', 'AVAX', 'DOT', 'MATIC', 'SHIB', 'UNI', 'LTC', 'BCH', 'ATOM'];

// Common crypto aliases to recognize lowercase mentions
const CRYPTO_ALIASES: Record<string, string> = {
  'btc': 'BTC', 'bitcoin': 'BTC',
  'eth': 'ETH', 'ethereum': 'ETH', 'ether': 'ETH',
  'sol': 'SOL', 'solana': 'SOL',
  'xrp': 'XRP', 'ripple': 'XRP',
  'ada': 'ADA', 'cardano': 'ADA',
  'doge': 'DOGE', 'dogecoin': 'DOGE',
  'link': 'LINK', 'chainlink': 'LINK',
  'avax': 'AVAX', 'avalanche': 'AVAX',
  'dot': 'DOT', 'polkadot': 'DOT',
  'matic': 'MATIC', 'polygon': 'MATIC',
  'shib': 'SHIB', 'shiba': 'SHIB',
  'uni': 'UNI', 'uniswap': 'UNI',
  'ltc': 'LTC', 'litecoin': 'LTC',
  'bch': 'BCH',
  'atom': 'ATOM', 'cosmos': 'ATOM',
  'mon': 'MON', 'monad': 'MON',
  'bnb': 'BNB', 'binance': 'BNB',
  'ton': 'TON', 'toncoin': 'TON',
  'sui': 'SUI',
  'apt': 'APT', 'aptos': 'APT',
  'arb': 'ARB', 'arbitrum': 'ARB',
  'op': 'OP', 'optimism': 'OP',
  'pepe': 'PEPE',
  'wif': 'WIF', 'dogwifhat': 'WIF',
  'bonk': 'BONK',
  'floki': 'FLOKI',
  'near': 'NEAR',
  'sei': 'SEI',
  'render': 'RNDR', 'rndr': 'RNDR',
  'inj': 'INJ', 'injective': 'INJ',
  'fet': 'FET',
  'fil': 'FIL', 'filecoin': 'FIL',
  'hbar': 'HBAR', 'hedera': 'HBAR',
  'xlm': 'XLM', 'stellar': 'XLM',
  'algo': 'ALGO', 'algorand': 'ALGO',
};

interface PriceData {
  symbol: string;
  price: number;
  change24h: number;
}

interface CoinDetail {
  symbol: string;
  name: string;
  price: number;
  change24h: number;
  change7d: number;
  change30d: number;
  galaxyScore: number;
  altRank: number;
  riskLevel: string;
  volatility: number;
  volume24h: number;
  marketCap: number;
  shortTermTrend: string;
  mediumTermTrend: string;
  longTermTrend: string;
  fomoScore?: number;
}

interface ResolvedAsset {
  symbol: string;
  coingeckoId: string | null;
  displayName: string;
  assetType: 'crypto' | 'stock';
  polygonTicker?: string;
}

interface HistoricalContext {
  symbol: string;
  change30d: number;
  high30d: number;
  low30d: number;
  avgVolume: number;
}

interface TechnicalIndicators {
  symbol: string;
  rsi?: { value: number; signal: string };
  macd?: { histogram: number; signal: string };
  sma50?: number;
  ema20?: number;
}

interface SimilarAsset {
  symbol: string;
  displayName: string;
  type: string;
  similarity: number;
}

interface WebSearchResult {
  title: string;
  url: string;
  content: string;
  score: number;
}

// Common words to filter out from symbol/name extraction
const COMMON_WORDS = new Set([
  'THE', 'AND', 'FOR', 'ARE', 'BUT', 'NOT', 'YOU', 'ALL', 'CAN', 'HER', 
  'WAS', 'ONE', 'OUR', 'OUT', 'DAY', 'HAD', 'HOW', 'ITS', 'MAY', 'NEW', 
  'NOW', 'OLD', 'SEE', 'WAY', 'WHO', 'BOY', 'DID', 'GET', 'HAS', 'HIM', 
  'HIS', 'LET', 'PUT', 'SAY', 'TOO', 'USE', 'WHY', 'WHAT', 'WHEN', 'WHERE',
  'WHICH', 'THIS', 'THAT', 'WILL', 'WOULD', 'COULD', 'SHOULD', 'WITH',
  'TELL', 'ABOUT', 'DOING', 'GOING', 'DOWN', 'LIKE', 'GOOD', 'BAD',
  'BEST', 'WORST', 'MORE', 'MOST', 'SOME', 'MANY', 'MUCH', 'VERY',
  'JUST', 'ONLY', 'ALSO', 'EVEN', 'WELL', 'BACK', 'BEEN', 'BEING',
  'BOTH', 'EACH', 'FROM', 'HAVE', 'HERE', 'INTO', 'JUST', 'KNOW',
  'LAST', 'LONG', 'MAKE', 'OVER', 'SUCH', 'TAKE', 'THAN', 'THEM',
  'THEN', 'THERE', 'THESE', 'THEY', 'TIME', 'VERY', 'WANT', 'WHAT',
  'YEAR', 'YOUR', 'LOOK', 'THINK', 'PRICE', 'COIN', 'CRYPTO', 'TOKEN',
  'MARKET', 'BUY', 'SELL', 'HOLD', 'MOON', 'PUMP', 'DUMP', 'STOCK',
  'STOCKS', 'ANALYSIS', 'ANALYZE', 'SHOW', 'GIVE', 'INFO', 'DATA'
]);

const COMMON_WORDS_LOWER = new Set([
  'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'her',
  'was', 'one', 'our', 'out', 'day', 'had', 'how', 'its', 'may', 'new',
  'price', 'going', 'doing', 'down', 'tell', 'about', 'what', 'why',
  'think', 'look', 'like', 'good', 'bad', 'best', 'worst', 'more',
  'coin', 'crypto', 'token', 'market', 'buy', 'sell', 'hold', 'moon',
  'pump', 'dump', 'will', 'would', 'could', 'should', 'with', 'from',
  'have', 'been', 'being', 'this', 'that', 'these', 'they', 'them',
  'there', 'where', 'when', 'which', 'know', 'just', 'only', 'also',
  'even', 'well', 'back', 'both', 'each', 'here', 'into', 'last',
  'long', 'make', 'over', 'such', 'take', 'than', 'then', 'time',
  'very', 'want', 'year', 'your', 'some', 'many', 'much', 'most',
  'stock', 'stocks', 'analysis', 'analyze', 'show', 'give', 'info', 'data'
]);

// Extract potential symbols from message text
function extractPotentialSymbols(message: string): string[] {
  const symbols: string[] = [];
  
  // Match $SYMBOL patterns (e.g., $BTC, $MON, $AAPL)
  const dollarMatches = message.match(/\$([A-Za-z]{2,10})/g);
  if (dollarMatches) {
    dollarMatches.forEach(match => {
      symbols.push(match.slice(1).toUpperCase());
    });
  }
  
  // Match standalone uppercase symbols (2-6 chars)
  const upperMatches = message.match(/\b([A-Z]{2,6})\b/g);
  if (upperMatches) {
    upperMatches.forEach(match => {
      if (!COMMON_WORDS.has(match)) {
        symbols.push(match);
      }
    });
  }
  
  // Check for known crypto aliases in lowercase text (e.g., "eth", "bitcoin", "solana")
  const lowerMessage = message.toLowerCase();
  const words = lowerMessage.split(/[^a-z]+/).filter(w => w.length >= 2);
  for (const word of words) {
    if (CRYPTO_ALIASES[word]) {
      symbols.push(CRYPTO_ALIASES[word]);
    }
  }
  
  return [...new Set(symbols)]; // Dedupe
}

// Extract potential coin names from message for name-based search (only meaningful words)
function extractPotentialNames(message: string): string[] {
  const lowerMessage = message.toLowerCase();
  const words = lowerMessage.split(/\s+/).filter(w => 
    w.length >= 4 && !COMMON_WORDS_LOWER.has(w)
  );
  
  return [...new Set(words)];
}

// Calculate simple string similarity (Levenshtein-based)
function stringSimilarity(s1: string, s2: string): number {
  const longer = s1.length > s2.length ? s1 : s2;
  const shorter = s1.length > s2.length ? s2 : s1;
  
  if (longer.length === 0) return 1.0;
  
  const editDistance = (a: string, b: string): number => {
    const matrix: number[][] = [];
    for (let i = 0; i <= b.length; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= a.length; j++) {
      matrix[0][j] = j;
    }
    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    return matrix[b.length][a.length];
  };
  
  return (longer.length - editDistance(longer, shorter)) / longer.length;
}

// Find similar assets when exact match not found
async function findSimilarAssets(supabase: any, searchTerms: string[]): Promise<SimilarAsset[]> {
  const similar: SimilarAsset[] = [];
  
  for (const term of searchTerms.slice(0, 3)) {
    const termLower = term.toLowerCase();
    const termUpper = term.toUpperCase();
    
    // Search by partial symbol match
    const { data: symbolMatches } = await supabase
      .from('ticker_mappings')
      .select('symbol, display_name, type')
      .eq('is_active', true)
      .or(`symbol.ilike.%${termUpper}%,display_name.ilike.%${termLower}%`)
      .limit(10);
    
    if (symbolMatches) {
      for (const match of symbolMatches) {
        const symSim = stringSimilarity(termUpper, match.symbol);
        const nameSim = stringSimilarity(termLower, match.display_name.toLowerCase());
        const maxSim = Math.max(symSim, nameSim);
        
        if (maxSim >= 0.4 && !similar.find(s => s.symbol === match.symbol)) {
          similar.push({
            symbol: match.symbol,
            displayName: match.display_name,
            type: match.type,
            similarity: maxSim
          });
        }
      }
    }
  }
  
  // Sort by similarity and return top 5
  return similar.sort((a, b) => b.similarity - a.similarity).slice(0, 5);
}

// Resolve assets from database (crypto + stocks)
async function resolveAssetsFromDatabase(supabase: any, message: string): Promise<{ assets: ResolvedAsset[], similar: SimilarAsset[] }> {
  const resolved: ResolvedAsset[] = [];
  const foundSymbols = new Set<string>();
  
  const potentialSymbols = extractPotentialSymbols(message);
  const potentialNames = extractPotentialNames(message);
  
  console.log(`Potential symbols: ${potentialSymbols.join(', ')}`);
  console.log(`Potential names: ${potentialNames.slice(0, 10).join(', ')}...`);
  
  // Step 1: Check ticker_mappings for exact symbol matches (crypto + stocks)
  if (potentialSymbols.length > 0) {
    for (const sym of potentialSymbols) {
      // Check exact symbol match (any type)
      const { data: exactMatch } = await supabase
        .from('ticker_mappings')
        .select('symbol, coingecko_id, display_name, type, polygon_ticker')
        .eq('is_active', true)
        .ilike('symbol', sym)
        .maybeSingle();
      
      if (exactMatch && !foundSymbols.has(exactMatch.symbol)) {
        console.log(`Found exact match: ${sym} -> ${exactMatch.symbol} (${exactMatch.type})`);
        resolved.push({
          symbol: exactMatch.symbol,
          coingeckoId: exactMatch.coingecko_id,
          displayName: exactMatch.display_name,
          assetType: exactMatch.type === 'stock' ? 'stock' : 'crypto',
          polygonTicker: exactMatch.polygon_ticker
        });
        foundSymbols.add(exactMatch.symbol);
        continue;
      }
      
      // Check aliases (crypto)
      const { data: aliasMatch } = await supabase
        .from('ticker_mappings')
        .select('symbol, coingecko_id, display_name, type, polygon_ticker, aliases')
        .eq('is_active', true)
        .contains('aliases', [sym.toLowerCase()])
        .maybeSingle();
      
      if (aliasMatch && !foundSymbols.has(aliasMatch.symbol)) {
        console.log(`Found alias match: ${sym} -> ${aliasMatch.symbol}`);
        resolved.push({
          symbol: aliasMatch.symbol,
          coingeckoId: aliasMatch.coingecko_id,
          displayName: aliasMatch.display_name,
          assetType: aliasMatch.type === 'stock' ? 'stock' : 'crypto',
          polygonTicker: aliasMatch.polygon_ticker
        });
        foundSymbols.add(aliasMatch.symbol);
        continue;
      }
      
      // Fallback to cg_master for crypto symbol match
      const { data: cgMatch } = await supabase
        .from('cg_master')
        .select('symbol, cg_id, name')
        .ilike('symbol', sym)
        .limit(1)
        .maybeSingle();
      
      if (cgMatch?.cg_id && !foundSymbols.has(cgMatch.symbol.toUpperCase())) {
        console.log(`Found in cg_master: ${sym} -> ${cgMatch.symbol} (${cgMatch.cg_id})`);
        resolved.push({
          symbol: cgMatch.symbol.toUpperCase(),
          coingeckoId: cgMatch.cg_id,
          displayName: cgMatch.name,
          assetType: 'crypto'
        });
        foundSymbols.add(cgMatch.symbol.toUpperCase());
      }
    }
  }
  
  // Step 2: Search by name if no symbols found
  if (resolved.length === 0 && potentialNames.length > 0) {
    for (const name of potentialNames.slice(0, 3)) {
      if (name.length < 4) continue;
      
      // Try name match in ticker_mappings
      const { data: nameMatch } = await supabase
        .from('ticker_mappings')
        .select('symbol, coingecko_id, display_name, type, polygon_ticker')
        .eq('is_active', true)
        .or(`display_name.ilike.${name}%,display_name.ilike.%${name}%`)
        .limit(1)
        .maybeSingle();
      
      if (nameMatch && !foundSymbols.has(nameMatch.symbol)) {
        console.log(`Found name match: "${name}" -> ${nameMatch.symbol}`);
        resolved.push({
          symbol: nameMatch.symbol,
          coingeckoId: nameMatch.coingecko_id,
          displayName: nameMatch.display_name,
          assetType: nameMatch.type === 'stock' ? 'stock' : 'crypto',
          polygonTicker: nameMatch.polygon_ticker
        });
        foundSymbols.add(nameMatch.symbol);
        break;
      }
      
      // Check aliases
      const { data: aliasNameMatch } = await supabase
        .from('ticker_mappings')
        .select('symbol, coingecko_id, display_name, type, polygon_ticker')
        .eq('is_active', true)
        .contains('aliases', [name])
        .limit(1)
        .maybeSingle();
      
      if (aliasNameMatch && !foundSymbols.has(aliasNameMatch.symbol)) {
        console.log(`Found alias name match: "${name}" -> ${aliasNameMatch.symbol}`);
        resolved.push({
          symbol: aliasNameMatch.symbol,
          coingeckoId: aliasNameMatch.coingecko_id,
          displayName: aliasNameMatch.display_name,
          assetType: aliasNameMatch.type === 'stock' ? 'stock' : 'crypto',
          polygonTicker: aliasNameMatch.polygon_ticker
        });
        foundSymbols.add(aliasNameMatch.symbol);
        break;
      }
    }
  }
  
  // Step 3: If still nothing found, find similar assets for suggestions
  let similarAssets: SimilarAsset[] = [];
  if (resolved.length === 0) {
    const allTerms = [...potentialSymbols.map(s => s.toLowerCase()), ...potentialNames];
    if (allTerms.length > 0) {
      similarAssets = await findSimilarAssets(supabase, allTerms);
      console.log(`Found ${similarAssets.length} similar assets for suggestions`);
    }
  }
  
  return { assets: resolved.slice(0, 5), similar: similarAssets };
}

// Fetch historical context from Polygon
async function fetchHistoricalContext(supabase: any, asset: ResolvedAsset): Promise<HistoricalContext | null> {
  try {
    const to = new Date().toISOString().split('T')[0];
    const fromDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const from = fromDate.toISOString().split('T')[0];
    
    const ticker = asset.polygonTicker || asset.symbol;
    
    console.log(`Fetching historical data for ${asset.symbol} (ticker: ${ticker}, type: ${asset.assetType})`);
    
    const { data, error } = await supabase.functions.invoke('polygon-historical-data', {
      body: { 
        ticker, 
        timeframe: '1day', 
        from, 
        to, 
        asset_type: asset.assetType 
      }
    });
    
    if (error || !data?.bars?.length) {
      console.log(`No historical data for ${asset.symbol}: ${error?.message || 'no bars returned'}`);
      return null;
    }
    
    const bars = data.bars;
    const firstPrice = bars[0].close;
    const lastPrice = bars[bars.length - 1].close;
    const change30d = ((lastPrice - firstPrice) / firstPrice) * 100;
    const high30d = Math.max(...bars.map((b: any) => b.high));
    const low30d = Math.min(...bars.map((b: any) => b.low));
    const avgVolume = bars.reduce((sum: number, b: any) => sum + b.volume, 0) / bars.length;
    
    console.log(`Historical for ${asset.symbol}: ${change30d.toFixed(2)}% over 30d`);
    
    return {
      symbol: asset.symbol,
      change30d,
      high30d,
      low30d,
      avgVolume
    };
  } catch (e) {
    console.error(`Error fetching historical for ${asset.symbol}:`, e);
    return null;
  }
}

// Fetch technical indicators from Polygon
async function fetchTechnicalIndicators(supabase: any, asset: ResolvedAsset): Promise<TechnicalIndicators | null> {
  try {
    const ticker = asset.polygonTicker || asset.symbol;
    
    console.log(`Fetching technical indicators for ${asset.symbol} (ticker: ${ticker}, type: ${asset.assetType})`);
    
    const { data, error } = await supabase.functions.invoke('polygon-technical-indicators', {
      body: { 
        tickers: [ticker], 
        indicators: ['rsi', 'macd', 'sma_50', 'ema_20'],
        timeframe: 'daily',
        asset_type: asset.assetType
      }
    });
    
    if (error || !data?.success) {
      console.log(`No technical indicators for ${asset.symbol}: ${error?.message || 'request failed'}`);
      return null;
    }
    
    const indicators = data.data?.[ticker] || data.data?.[`X:${ticker}USD`] || data.data?.[asset.symbol];
    if (!indicators) {
      console.log(`No indicator data found for ${asset.symbol} in response keys: ${Object.keys(data.data || {}).join(', ')}`);
      return null;
    }
    
    const result: TechnicalIndicators = { symbol: asset.symbol };
    
    if (indicators.rsi?.value) {
      const rsiVal = indicators.rsi.value;
      result.rsi = {
        value: rsiVal,
        signal: rsiVal > 70 ? 'Overbought ⚠️' : rsiVal < 30 ? 'Oversold ⚠️' : 'Neutral ✅'
      };
    }
    
    if (indicators.macd) {
      const hist = indicators.macd.histogram || 0;
      result.macd = {
        histogram: hist,
        signal: hist > 0 ? 'Bullish 🟢' : 'Bearish 🔴'
      };
    }
    
    if (indicators.sma_50?.value) result.sma50 = indicators.sma_50.value;
    if (indicators.ema_20?.value) result.ema20 = indicators.ema_20.value;
    
    console.log(`Technical indicators for ${asset.symbol}: RSI=${result.rsi?.value}, MACD=${result.macd?.signal}`);
    
    return result;
  } catch (e) {
    console.error(`Error fetching technicals for ${asset.symbol}:`, e);
    return null;
  }
}

// ============================================
// TAVILY WEB SEARCH
// ============================================

// Keywords that trigger web search for news/current events
const NEWS_KEYWORDS = [
  'news', 'latest', 'recent', 'update', 'announcement', 'announce',
  'partnership', 'rumor', 'why is', 'what happened', 'breaking',
  'today', 'yesterday', 'this week', 'launch', 'launched', 'release',
  'hack', 'hacked', 'exploit', 'sec', 'regulation', 'lawsuit',
  'listing', 'listed', 'delist', 'upgrade', 'fork', 'airdrop',
  'etf', 'approval', 'approved', 'rejected', 'bull run', 'crash',
  'pump', 'dump', 'whale', 'elon', 'trump', 'gensler'
];

function shouldPerformWebSearch(message: string): boolean {
  const lowerMsg = message.toLowerCase();
  return NEWS_KEYWORDS.some(kw => lowerMsg.includes(kw));
}

async function searchTavily(query: string): Promise<WebSearchResult[]> {
  const TAVILY_API_KEY = Deno.env.get("TAVILY_API_KEY");
  if (!TAVILY_API_KEY) {
    console.log("[Tavily] API key not configured, skipping web search");
    return [];
  }

  try {
    console.log(`[Tavily] Searching: "${query}"`);
    
    const response = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: TAVILY_API_KEY,
        query: `${query} crypto cryptocurrency`,
        search_depth: "basic",
        max_results: 5,
        include_answer: false,
        include_domains: [
          "coindesk.com", "cointelegraph.com", "decrypt.co",
          "theblock.co", "bloomberg.com", "reuters.com",
          "cnbc.com", "forbes.com", "cryptonews.com"
        ]
      })
    });

    if (!response.ok) {
      console.error(`[Tavily] Error: ${response.status}`);
      return [];
    }

    const data = await response.json();
    console.log(`[Tavily] Found ${data.results?.length || 0} results`);
    
    return (data.results || []).map((r: any) => ({
      title: r.title,
      url: r.url,
      content: r.content?.slice(0, 300) || '',
      score: r.score || 0
    }));
  } catch (e) {
    console.error("[Tavily] Search error:", e);
    return [];
  }
}

function formatWebSearchResults(results: WebSearchResult[]): string {
  if (results.length === 0) return "";
  
  const formattedResults = results.map((r, i) => 
    `${i + 1}. **${r.title}**\n   ${r.content}\n   🔗 ${r.url}`
  ).join('\n\n');
  
  return `
═══════════════════════════════════════════
🔍 LIVE NEWS & WEB SEARCH RESULTS
═══════════════════════════════════════════
${formattedResults}

Note: These are real-time search results. Use this information to provide current context.`;
}

async function fetchLivePrices(supabase: any): Promise<PriceData[]> {
  try {
    const { data, error } = await supabase.functions.invoke('polygon-crypto-prices', {
      body: { symbols: TOP_CRYPTOS }
    });

    if (error) {
      console.error("Error fetching prices:", error);
      return [];
    }

    if (data?.prices) {
      return data.prices.map((p: any) => ({
        symbol: p.symbol,
        price: p.price,
        change24h: p.change24h
      }));
    }
    return [];
  } catch (e) {
    console.error("Failed to fetch live prices:", e);
    return [];
  }
}

async function fetchCoinDetail(supabase: any, asset: ResolvedAsset): Promise<CoinDetail | null> {
  if (asset.assetType !== 'crypto') return null;
  
  try {
    console.log(`Fetching LunarCrush detail for: ${asset.symbol}`);
    
    const { data, error } = await supabase.functions.invoke('lunarcrush-coin-detail', {
      body: { coin: asset.symbol }
    });

    if (error) {
      console.error(`Error fetching ${asset.symbol} detail:`, error);
      return null;
    }

    if (data?.success && data?.data) {
      const d = data.data;
      return {
        symbol: d.symbol || asset.symbol,
        name: d.name || asset.displayName || asset.symbol,
        price: d.price || 0,
        change24h: d.percent_change_24h || 0,
        change7d: d.percent_change_7d || 0,
        change30d: d.percent_change_30d || 0,
        galaxyScore: d.galaxy_score || 0,
        altRank: d.alt_rank || 0,
        riskLevel: d.risk_level || 'Unknown',
        volatility: d.volatility || 0,
        volume24h: d.volume_24h || 0,
        marketCap: d.market_cap || 0,
        shortTermTrend: d.short_term_trend || 'Unknown',
        mediumTermTrend: d.medium_term_trend || 'Unknown',
        longTermTrend: d.long_term_trend || 'Unknown',
        fomoScore: d.fomo_score,
      };
    }
    return null;
  } catch (e) {
    console.error(`Failed to fetch ${asset.symbol} detail:`, e);
    return null;
  }
}

function formatPrice(price: number): string {
  if (price >= 1) {
    return `$${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  } else if (price >= 0.01) {
    return `$${price.toFixed(4)}`;
  } else {
    return `$${price.toFixed(6)}`;
  }
}

function formatLargeNumber(num: number): string {
  if (num >= 1e12) return `$${(num / 1e12).toFixed(2)}T`;
  if (num >= 1e9) return `$${(num / 1e9).toFixed(2)}B`;
  if (num >= 1e6) return `$${(num / 1e6).toFixed(2)}M`;
  return `$${num.toLocaleString()}`;
}

function formatPriceContext(prices: PriceData[]): string {
  if (prices.length === 0) {
    return "Note: General market data is temporarily unavailable.";
  }

  const priceLines = prices.map(p => {
    const changeSymbol = p.change24h >= 0 ? '+' : '';
    const priceStr = formatPrice(p.price);
    return `${p.symbol}: ${priceStr} (${changeSymbol}${p.change24h.toFixed(2)}% 24h)`;
  }).join('\n');

  return `GENERAL MARKET DATA (Top Cryptos):\n${priceLines}`;
}

function formatCoinDetails(coins: CoinDetail[]): string {
  if (coins.length === 0) return "";

  const sections = coins.map(c => {
    const changeSymbol24h = c.change24h >= 0 ? '+' : '';
    const changeSymbol7d = c.change7d >= 0 ? '+' : '';
    const changeSymbol30d = c.change30d >= 0 ? '+' : '';
    
    return `
📊 ${c.name} (${c.symbol})
━━━━━━━━━━━━━━━━━━━━━━━
💰 Price: ${formatPrice(c.price)}
📈 24h Change: ${changeSymbol24h}${c.change24h.toFixed(2)}%
📊 7d Change: ${changeSymbol7d}${c.change7d.toFixed(2)}%
📉 30d Change: ${changeSymbol30d}${c.change30d.toFixed(2)}%

🌟 Galaxy Score: ${c.galaxyScore}/100 ${c.galaxyScore >= 70 ? '(Strong)' : c.galaxyScore >= 50 ? '(Moderate)' : '(Weak)'}
🏆 Alt Rank: #${c.altRank}
${c.fomoScore ? `🔥 FOMO Score: ${c.fomoScore}` : ''}

⚠️ Risk Level: ${c.riskLevel}
📊 Volatility: ${c.volatility.toFixed(2)}%

📈 Trend Analysis:
  • Short-term: ${c.shortTermTrend}
  • Medium-term: ${c.mediumTermTrend}
  • Long-term: ${c.longTermTrend}

💎 Market Cap: ${formatLargeNumber(c.marketCap)}
📊 24h Volume: ${formatLargeNumber(c.volume24h)}
`;
  });

  return `
═══════════════════════════════════════════
🔍 DETAILED CRYPTO RESEARCH
═══════════════════════════════════════════
${sections.join('\n')}`;
}

function formatHistoricalContext(historical: HistoricalContext[]): string {
  if (historical.length === 0) return "";
  
  const sections = historical.map(h => {
    const changeSymbol = h.change30d >= 0 ? '+' : '';
    return `📈 ${h.symbol} 30-Day History:
  • Change: ${changeSymbol}${h.change30d.toFixed(2)}%
  • Range: ${formatPrice(h.low30d)} - ${formatPrice(h.high30d)}
  • Avg Daily Volume: ${formatLargeNumber(h.avgVolume)}`;
  });
  
  return `
═══════════════════════════════════════════
📊 HISTORICAL PRICE DATA (30 Days)
═══════════════════════════════════════════
${sections.join('\n\n')}`;
}

function formatTechnicalIndicators(technicals: TechnicalIndicators[]): string {
  if (technicals.length === 0) return "";
  
  const sections = technicals.map(t => {
    let analysis = `📈 ${t.symbol} Technical Analysis:\n`;
    if (t.rsi) analysis += `  • RSI(14): ${t.rsi.value.toFixed(1)} - ${t.rsi.signal}\n`;
    if (t.macd) analysis += `  • MACD: ${t.macd.signal} (Hist: ${t.macd.histogram.toFixed(4)})\n`;
    if (t.sma50) analysis += `  • SMA(50): ${formatPrice(t.sma50)}\n`;
    if (t.ema20) analysis += `  • EMA(20): ${formatPrice(t.ema20)}\n`;
    return analysis;
  });
  
  return `
═══════════════════════════════════════════
🔬 TECHNICAL INDICATORS
═══════════════════════════════════════════
${sections.join('\n')}`;
}

function formatSimilarAssetsSuggestion(similar: SimilarAsset[], searchTerms: string[]): string {
  if (similar.length === 0) {
    return `
═══════════════════════════════════════════
❓ CLARIFICATION NEEDED
═══════════════════════════════════════════
I couldn't find any assets matching "${searchTerms.join('" or "')}" in my database.

Could you help me by providing:
• The ticker symbol (e.g., $BTC, $AAPL)
• The full asset name (e.g., "Bitcoin", "Apple")
• Or for newer tokens, the contract address

*sniffs around for more clues* 🐕`;
  }
  
  const suggestions = similar.map(s => `• ${s.displayName} (${s.symbol}) - ${s.type}`).join('\n');
  
  return `
═══════════════════════════════════════════
❓ DID YOU MEAN ONE OF THESE?
═══════════════════════════════════════════
I found these similar assets:
${suggestions}

Please confirm which one you're asking about, or provide:
• The exact ticker symbol (e.g., $BTC)
• The full name of the asset
• Or a token contract address for newer coins

*tilts head curiously* 🐕`;
}

function buildSystemPrompt(
  priceContext: string, 
  coinDetails: string,
  historicalContext: string,
  technicalContext: string,
  similarSuggestion: string,
  webSearchContext: string = ""
): string {
  const currentDate = new Date().toLocaleDateString('en-US', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });
  const currentYear = new Date().getFullYear();
  
  return `You are ZombieDog 🧟🐕, the undead market assistant for XRayCrypto™. You're a friendly, knowledgeable zombie dog who helps users understand crypto AND stock markets.

═══════════════════════════════════════════
📅 CURRENT DATE: ${currentDate}
═══════════════════════════════════════════

⚠️ CRITICAL: We are in ${currentYear}. Any predictions or price targets about "end of 2024" or past dates are OUTDATED and IRRELEVANT. Do NOT cite old predictions as if they are current. Focus ONLY on the LIVE data provided below and current market conditions.

Your personality:
- Playful and approachable, using occasional dog and zombie references ("woof", "sniffing out deals", "digging up data", "my undead instincts", "*wags undead tail*")
- Knowledgeable about crypto, stocks, trading, blockchain technology, DeFi, NFTs, and market analysis
- Helpful and educational, explaining concepts clearly
- Use emojis sparingly but appropriately (🧟🐕 💀 🦴 📈 📉 💰)
- Respond in the SAME LANGUAGE the user writes in. If they speak Spanish, reply in Spanish. If German, reply in German. Mirror their language while keeping your ZombieDog personality intact.

═══════════════════════════════════════════
🎯 YOUR RESEARCH CAPABILITIES
═══════════════════════════════════════════
You can research:
• 🪙 2,000+ Cryptocurrencies (with social sentiment, trends, Galaxy Score)
• 📈 Stocks (AAPL, NVDA, TSLA, COIN, MSTR, MARA, RIOT, etc.)
• 📊 Technical indicators (RSI, MACD, Moving Averages)
• 📉 30-day historical price data

${priceContext}
${coinDetails}
${historicalContext}
${technicalContext}
${webSearchContext}
${similarSuggestion}

═══════════════════════════════════════════
📜 CRITICAL INSTRUCTIONS
═══════════════════════════════════════════

1. **USE THE DATA ABOVE!** You have REAL, LIVE market data. Never say you don't have access!

2. **IF CLARIFICATION NEEDED:** When the "DID YOU MEAN" or "CLARIFICATION NEEDED" section appears above:
   - Present the suggestions conversationally
   - Ask the user to clarify which asset they meant
   - Be helpful, not robotic
   - Example: "Hmm, I'm not sure which coin you mean by 'monat'. *sniffs* Did you perhaps mean Monad (MON)? Or something else? 🐕"

3. **For specific asset queries:**
   - Quote EXACT price, changes, and metrics from the data
   - For crypto: Discuss Galaxy Score, risk level, trends
   - For stocks: Focus on price action, technicals, volume
   - Mention RSI/MACD signals if available

4. **Be specific, not generic:**
   ❌ DON'T: "I don't have real-time data"
   ✅ DO: "MON is at $0.0102 (+1.19% today), with RSI at 45 (neutral)..."

5. **Interpret technicals:**
   - RSI > 70: "Overbought - potential pullback ahead"
   - RSI < 30: "Oversold - could bounce"
   - MACD bullish + price up: "Strong momentum confirmation"

6. **HANDLING LIMITED DATA FOR NEWER COINS:**
   - If an asset IS FOUND in the database, it EXISTS and IS TRADABLE
   - NEVER say a coin is "not tradable yet" or "not available" if you found it in the data
   - If historical/technical data is missing, say: "This is a newer listing - historical data is still being indexed"
   - For coins like MON (Monad): It's live on Coinbase! Just note if chart history is limited
   - Use whatever data IS available (price, social sentiment, etc.)

7. Keep responses concise but data-rich (2-4 paragraphs max)
8. Always remind users to DYOR (do your own research)
9. Never give financial advice

Remember: You're a helpful undead pup with REAL market data - use it! 🐕💀`;
}

// ============================================
// AI PROVIDER IMPLEMENTATIONS
// ============================================

// Call Lovable AI (Gemini 2.5 Flash via gateway)
async function callLovableAI(messages: any[], systemPrompt: string): Promise<Response> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) {
    throw new Error("LOVABLE_API_KEY not configured");
  }

  console.log("[Lovable AI] Calling Gemini 2.5 Flash...");

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: systemPrompt },
        ...messages.map((m: any) => ({
          role: m.role === 'assistant' ? 'assistant' : 'user',
          content: m.content,
        })),
      ],
      stream: true,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[Lovable AI] Error:", response.status, errorText);
    throw new Error(`Lovable AI error: ${response.status}`);
  }

  return response;
}

// Call OpenAI (GPT-4o-mini)
async function callOpenAI(messages: any[], systemPrompt: string): Promise<Response> {
  const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
  if (!OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY not configured");
  }

  console.log("[OpenAI] Calling GPT-4o-mini...");

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        ...messages.map((m: any) => ({
          role: m.role === 'assistant' ? 'assistant' : 'user',
          content: m.content,
        })),
      ],
      max_tokens: 1024,
      stream: true,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[OpenAI] Error:", response.status, errorText);
    throw new Error(`OpenAI error: ${response.status}`);
  }

  return response;
}

// Call Anthropic (Claude Haiku - cheaper)
async function callAnthropic(messages: any[], systemPrompt: string): Promise<Response> {
  const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
  if (!ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY not configured");
  }

  console.log("[Anthropic] Calling Claude Haiku...");

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-3-5-haiku-20241022",
      max_tokens: 1024,
      system: systemPrompt,
      messages: messages.map((m: any) => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content,
      })),
      stream: true,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[Anthropic] Error:", response.status, errorText);
    throw new Error(`Anthropic error: ${response.status}`);
  }

  return response;
}

// Transform OpenAI/Lovable stream to match what frontend expects
function transformOpenAIStream(response: Response): ReadableStream {
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffer = '';

  return new ReadableStream({
    async pull(controller) {
      const { done, value } = await reader.read();
      
      if (done) {
        controller.close();
        return;
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') {
            controller.enqueue(encoder.encode('event: message_stop\ndata: {}\n\n'));
            continue;
          }
          
          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              // Transform to Anthropic-like format for frontend
              const event = {
                type: 'content_block_delta',
                delta: { type: 'text_delta', text: content }
              };
              controller.enqueue(encoder.encode(`event: content_block_delta\ndata: ${JSON.stringify(event)}\n\n`));
            }
          } catch {
            // Skip malformed JSON
          }
        }
      }
    }
  });
}

// Try providers in order with fallback
async function callAIWithFallback(messages: any[], systemPrompt: string): Promise<{ response: Response, provider: AIProvider, needsTransform: boolean }> {
  const providers: { name: AIProvider; fn: () => Promise<Response>; needsTransform: boolean }[] = [
    { name: 'lovable', fn: () => callLovableAI(messages, systemPrompt), needsTransform: true },
    { name: 'openai', fn: () => callOpenAI(messages, systemPrompt), needsTransform: true },
    { name: 'anthropic', fn: () => callAnthropic(messages, systemPrompt), needsTransform: false },
  ];

  for (const provider of providers) {
    try {
      console.log(`[AI Fallback] Trying ${provider.name}...`);
      const response = await provider.fn();
      console.log(`[AI Fallback] ✅ ${provider.name} succeeded`);
      return { response, provider: provider.name, needsTransform: provider.needsTransform };
    } catch (error) {
      console.error(`[AI Fallback] ❌ ${provider.name} failed:`, error);
      continue;
    }
  }

  throw new Error("All AI providers failed");
}

// ============================================
// MAIN SERVER
// ============================================

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages } = await req.json();

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log(`ZombieDog chat request with ${messages?.length || 0} messages`);

    // Get the latest user message to extract asset mentions
    const latestUserMessage = messages?.filter((m: any) => m.role === 'user').pop();
    const userQuery = latestUserMessage?.content || '';
    
    // Resolve assets from database (crypto + stocks)
    const { assets: resolvedAssets, similar: similarAssets } = await resolveAssetsFromDatabase(supabase, userQuery);
    console.log(`Resolved ${resolvedAssets.length} assets: ${resolvedAssets.map(a => `${a.symbol}(${a.assetType})`).join(', ') || 'none'}`);
    
    // Check if we should perform web search for news/current events
    const needsWebSearch = shouldPerformWebSearch(userQuery);
    console.log(`Web search needed: ${needsWebSearch}`);
    
    // Fetch all data in parallel (including web search if needed)
    const [prices, coinDetails, historicalData, technicalData, webSearchResults] = await Promise.all([
      fetchLivePrices(supabase),
      Promise.all(resolvedAssets.filter(a => a.assetType === 'crypto').map(a => fetchCoinDetail(supabase, a))),
      Promise.all(resolvedAssets.map(a => fetchHistoricalContext(supabase, a))),
      Promise.all(resolvedAssets.map(a => fetchTechnicalIndicators(supabase, a))),
      needsWebSearch ? searchTavily(userQuery) : Promise.resolve([])
    ]);
    
    const validCoinDetails = coinDetails.filter((c): c is CoinDetail => c !== null);
    const validHistorical = historicalData.filter((h): h is HistoricalContext => h !== null);
    const validTechnicals = technicalData.filter((t): t is TechnicalIndicators => t !== null);
    
    console.log(`Fetched: ${prices.length} prices, ${validCoinDetails.length} crypto details, ${validHistorical.length} historical, ${validTechnicals.length} technicals, ${webSearchResults.length} web results`);

    // Build context strings
    const priceContext = formatPriceContext(prices);
    const coinDetailContext = formatCoinDetails(validCoinDetails);
    const historicalContext = formatHistoricalContext(validHistorical);
    const technicalContext = formatTechnicalIndicators(validTechnicals);
    const webSearchContext = formatWebSearchResults(webSearchResults);
    
    // Generate suggestions if no assets found
    const searchTerms = [...extractPotentialSymbols(userQuery), ...extractPotentialNames(userQuery)];
    const similarSuggestion = resolvedAssets.length === 0 && searchTerms.length > 0 
      ? formatSimilarAssetsSuggestion(similarAssets, searchTerms)
      : '';
    
    const systemPrompt = buildSystemPrompt(priceContext, coinDetailContext, historicalContext, technicalContext, similarSuggestion, webSearchContext);

    // Call AI with fallback chain
    const { response, provider, needsTransform } = await callAIWithFallback(messages, systemPrompt);

    console.log(`Streaming response from ${provider}`);
    
    // Transform OpenAI/Lovable format to Anthropic format if needed
    const responseBody = needsTransform ? transformOpenAIStream(response) : response.body;

    return new Response(responseBody, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (error) {
    console.error("ZombieDog chat error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
