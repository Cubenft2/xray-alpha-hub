// Tool Orchestrator: Cache-first execution with TTL, budgets, and timeouts
// Supports thousands of concurrent users without per-request API spam
// Uses canonical market presets for deterministic market queries
// REFACTORED: Queries centralized Mastercards (token_cards, stock_cards, forex_cards)

import { RouteConfig, Intent } from "./router.ts";
import { ResolvedAsset } from "./resolver.ts";
import { MarketPreset } from "./presets.ts";

const TOOL_TIMEOUT_MS = 5000;

// TTL Configuration (in seconds) - aligned with Mastercard sync schedules
const TTL_SEC = {
  token_cards: 180,     // 3 min (Polygon prices every 1 min, LunarCrush every 2 min)
  stock_cards: 300,     // 5 min (stock snapshot every 5 min)
  forex_cards: 180,     // 3 min (forex sync every 1 min)
  technicals: 900,      // 15 min (technicals sync every 15 min)
  derivs: 300,          // 5 min
  news: 1800,           // 30 min
  security: 86400,      // 24h (mostly static)
};

// Per-request API budget (limits external calls)
interface BudgetState {
  coinglass: number;
  tavily: number;
  goplus: number;
  dexscreener: number;
  assetDetails: number; // CoinGecko details call budget
}

const DEFAULT_BUDGET: BudgetState = {
  coinglass: 1,   // Max 1 CoinGlass call per request
  tavily: 1,      // Max 1 Tavily search per request
  goplus: 1,      // Max 1 GoPlus call per request
  dexscreener: 1, // Max 1 DexScreener call per request
  assetDetails: 1, // Max 1 asset-details call per request
};

// GoPlus supported chain IDs
const GOPLUS_CHAINS: Record<string, string> = {
  'ethereum': '1',
  'eth': '1',
  'bsc': '56',
  'polygon': '137',
  'arbitrum': '42161',
  'base': '8453',
  'avalanche': '43114',
  'solana': 'solana',
};

export interface MarketSummary {
  total: number;
  greenCount: number;
  redCount: number;
  breadthPct: number;
  leaders: { symbol: string; change: number }[];
  laggards: { symbol: string; change: number }[];
  avgGalaxyScore?: number;
  topSentiment?: { symbol: string; score: number }[];
}

export interface PresetExecutionResult {
  data: any[];
  preset: MarketPreset;
  rowCount: number;
  executionTime: number;
}

export interface ToolResults {
  prices?: PriceData[];
  social?: SocialData[];
  derivs?: DerivsData[];
  security?: SecurityData;
  news?: NewsItem[];
  charts?: ChartData;
  details?: AssetDetails; // Asset fundamentals
  marketSummary?: MarketSummary; // Pre-computed for market_overview
  presetResult?: PresetExecutionResult; // Canonical preset execution result
  timestamps: Record<string, string>;
  cacheStats: {
    hits: string[];
    misses: string[];
    apiCalls: string[];
    ages: Record<string, number>; // seconds since last update
  };
}

export interface PriceData {
  symbol: string;
  price: number;
  change24h: number;
  marketCap?: number;
  volume24h?: number;
  source: string;
  updatedAt?: string;
}

export interface SocialData {
  symbol: string;
  galaxyScore?: number;
  altRank?: number;
  sentiment?: number;
  socialVolume?: number;
  updatedAt?: string;
}

export interface DerivsData {
  symbol: string;
  fundingRate: number;
  liquidations24h: { long: number; short: number; total: number };
  updatedAt?: string;
}

export interface SecurityData {
  riskLevel: 'Low' | 'Medium' | 'High' | 'Unknown';
  flags: string[];
  isHoneypot?: boolean;
  liquidity?: { dex: number; cex: string[] };
  contractInfo?: { verified: boolean; mintable: boolean };
  chain?: string;
}

export interface NewsItem {
  title: string;
  source: string;
  date: string;
  summary?: string;
  url?: string;
}

// Enhanced ChartData interface with all available technicals from Mastercards
export interface ChartData {
  rsi?: number;
  macd?: { value: number; signal: number; histogram: number };
  sma20?: number;
  sma50?: number;
  sma200?: number;
  ema12?: number;
  ema26?: number;
  technicalScore?: number;
  technicalSignal?: string;
  updatedAt?: string;
}

export interface AssetDetails {
  symbol: string;
  type: "stock" | "crypto";
  name?: string | null;
  description?: string | null;
  categories?: string[];
  links?: any;
  image?: any;
  market?: { market_cap?: number | null; fdv?: number | null };
  supply?: { circulating?: number | null; total?: number | null; max?: number | null };
  social?: {
    galaxy_score?: number | null;
    alt_rank?: number | null;
    sentiment?: number | null;
    social_volume_24h?: number | null;
  };
  as_of?: string | null;
  age_seconds?: number | null;
  stale?: boolean;
  swr?: boolean;
  notes?: string;
}

// Helper: Calculate age in seconds
function ageSec(ts?: string | null): number {
  if (!ts) return Infinity;
  return (Date.now() - new Date(ts).getTime()) / 1000;
}

// Helper: Check if data is fresh
function isFresh(ts: string | null | undefined, ttl: number): boolean {
  return ageSec(ts) <= ttl;
}

// Proper timeout with AbortController
async function fetchWithTimeout<T>(
  fetchFn: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number
): Promise<T | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  
  try {
    const result = await fetchFn(controller.signal);
    clearTimeout(timeoutId);
    return result;
  } catch (e) {
    clearTimeout(timeoutId);
    if (e instanceof Error && e.name === 'AbortError') {
      console.warn('[Tool] Request aborted due to timeout');
    }
    return null;
  }
}

/**
 * Execute a canonical market preset via lunarcrush-universe edge function
 * This is the ONLY way ZombieDog should query market lists - NO free-form queries
 */
async function executePreset(supabase: any, preset: MarketPreset): Promise<any[]> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  
  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/lunarcrush-universe`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({
        limit: preset.query.limit,
        offset: 0,
        sortBy: preset.query.sortBy,
        sortDir: preset.query.sortDir,
        changeFilter: preset.query.changeFilter,
        category: preset.query.categoryFilter,
        minVolume: preset.query.minVolume,
        minGalaxyScore: preset.query.minGalaxyScore,
        minMarketCap: preset.query.minMarketCap,
      }),
    });
    
    if (!res.ok) {
      console.error(`[Preset] lunarcrush-universe error: ${res.status} ${res.statusText}`);
      return [];
    }
    
    const data = await res.json();
    
    if (!data.success) {
      console.error(`[Preset] lunarcrush-universe failed: ${data.error}`);
      return [];
    }
    
    return data.data || [];
  } catch (e) {
    console.error(`[Preset] executePreset error:`, e);
    return [];
  }
}

export async function executeTools(
  supabase: any,
  config: RouteConfig,
  assets: ResolvedAsset[]
): Promise<ToolResults> {
  const results: ToolResults = {
    timestamps: {},
    cacheStats: {
      hits: [],
      misses: [],
      apiCalls: [],
      ages: {},
    },
  };
  
  // Initialize per-request budget
  const budget: BudgetState = { ...DEFAULT_BUDGET };
  
  const symbols = assets.map(a => a.symbol);
  
  console.log(`[Orchestrator] Intent: ${config.intent}, assets: [${symbols.join(', ')}], count: ${symbols.length}`);
  
  // CANONICAL PRESET EXECUTION - deterministic, no guessing
  if (config.intent === 'market_preset' && config.preset) {
    const preset = config.preset;
    const startTime = Date.now();
    
    console.log(`MARKET_PRESET_EXECUTING preset=${preset.id}`);
    
    const presetData = await executePreset(supabase, preset);
    
    const executionTime = Date.now() - startTime;
    
    if (presetData.length === 0) {
      console.log(`MARKET_PRESET_EMPTY preset=${preset.id} rows=0 latency_ms=${executionTime}`);
      results.cacheStats.misses.push(`preset:${preset.id}:empty`);
    } else {
      console.log(`MARKET_PRESET_EXECUTED preset=${preset.id} rows=${presetData.length} latency_ms=${executionTime}`);
      results.cacheStats.hits.push(`preset:${preset.id}`);
    }
    
    results.presetResult = {
      data: presetData,
      preset,
      rowCount: presetData.length,
      executionTime,
    };
    results.timestamps.preset = new Date().toISOString();
    
    // Also populate prices/social for LLM context from preset data
    if (presetData.length > 0) {
      results.prices = presetData.map((c: any) => ({
        symbol: c.symbol,
        price: c.price,
        change24h: c.percent_change_24h || c.change_percent || 0,
        marketCap: c.market_cap,
        volume24h: c.volume_24h,
        source: 'preset:' + preset.id,
        updatedAt: c.updated_at,
      }));
      results.social = presetData.map((c: any) => ({
        symbol: c.symbol,
        galaxyScore: c.galaxy_score,
        altRank: c.alt_rank,
        sentiment: c.sentiment,
        socialVolume: c.social_volume,
        updatedAt: c.updated_at,
      }));
      results.timestamps.prices = new Date().toISOString();
      results.timestamps.social = new Date().toISOString();
    }
    
    return results; // Early return - preset handles everything
  }
  
  // For market_overview: fetch top 25 by market cap from token_cards (MASTERCARD)
  if (config.intent === 'market_overview' && symbols.length === 0) {
    console.log('[Orchestrator] Market overview: fetching top 25 cryptos from token_cards');
    
    const { data: topCoins } = await supabase
      .from('token_cards')
      .select('canonical_symbol, name, price_usd, change_24h_pct, market_cap, market_cap_rank, galaxy_score, sentiment, volume_24h_usd, price_updated_at, social_updated_at')
      .gt('market_cap_rank', 0)
      .order('market_cap_rank', { ascending: true })
      .limit(25);
    
    if (topCoins && topCoins.length > 0) {
      // Populate prices directly
      results.prices = topCoins.map((c: any) => ({
        symbol: c.canonical_symbol,
        price: c.price_usd,
        change24h: c.change_24h_pct || 0,
        marketCap: c.market_cap,
        volume24h: c.volume_24h_usd,
        source: 'token_cards',
        updatedAt: c.price_updated_at,
      }));
      results.timestamps.prices = new Date().toISOString();
      results.cacheStats.hits.push('market_overview:top25:token_cards');
      
      // Populate social directly
      results.social = topCoins.map((c: any) => ({
        symbol: c.canonical_symbol,
        galaxyScore: c.galaxy_score,
        sentiment: c.sentiment,
        updatedAt: c.social_updated_at,
      }));
      results.timestamps.social = new Date().toISOString();
      
      // Compute market summary for easy synthesis
      const prices = results.prices;
      const greenCount = prices.filter(p => p.change24h > 0).length;
      const redCount = prices.filter(p => p.change24h < 0).length;
      const sorted = [...prices].sort((a, b) => b.change24h - a.change24h);
      
      const socialWithScores = results.social.filter(s => s.galaxyScore);
      const avgGalaxyScore = socialWithScores.length > 0
        ? Math.round(socialWithScores.reduce((sum, s) => sum + (s.galaxyScore || 0), 0) / socialWithScores.length)
        : undefined;
      
      results.marketSummary = {
        total: prices.length,
        greenCount,
        redCount,
        breadthPct: Math.round((greenCount / prices.length) * 100),
        leaders: sorted.slice(0, 3).map(p => ({ symbol: p.symbol, change: p.change24h })),
        laggards: sorted.slice(-3).reverse().map(p => ({ symbol: p.symbol, change: p.change24h })),
        avgGalaxyScore,
        topSentiment: results.social
          .filter(s => s.sentiment)
          .sort((a, b) => (b.sentiment || 0) - (a.sentiment || 0))
          .slice(0, 3)
          .map(s => ({ symbol: s.symbol, score: s.sentiment || 0 })),
      };
      results.timestamps.marketSummary = new Date().toISOString();
      
      console.log(`[Orchestrator] Market overview: ${greenCount} green, ${redCount} red, ${results.marketSummary.breadthPct}% breadth`);
      return results; // Early return - we have everything for market_overview
    }
  }
  
  // For other general queries, default to top 10
  if (symbols.length === 0) {
    const generalMarketIntents: Intent[] = ['analysis', 'general', 'sentiment', 'news'];
    if (generalMarketIntents.includes(config.intent)) {
      symbols.push('BTC', 'ETH', 'SOL', 'XRP', 'DOGE', 'ADA', 'AVAX', 'LINK', 'DOT', 'POL');
      console.log('[Orchestrator] No assets resolved, defaulting to top 10 cryptos for', config.intent);
    } else {
      return results;
    }
  }
  
  // Determine asset types for routing queries
  const assetTypes = new Map<string, 'crypto' | 'stock' | 'forex'>();
  for (const asset of assets) {
    assetTypes.set(asset.symbol, asset.type as 'crypto' | 'stock' | 'forex' || 'crypto');
  }
  // Default untyped symbols to crypto
  for (const sym of symbols) {
    if (!assetTypes.has(sym)) {
      assetTypes.set(sym, 'crypto');
    }
  }
  
  const tasks: Promise<void>[] = [];
  
  // Price fetching from Mastercards (token_cards for crypto, stock_cards for stocks)
  if (config.fetchPrices) {
    tasks.push(
      fetchWithTimeout(
        (signal) => fetchPrices(supabase, symbols, assetTypes, signal, results.cacheStats),
        TOOL_TIMEOUT_MS
      ).then(data => {
        if (data) {
          results.prices = data;
          results.timestamps.prices = new Date().toISOString();
        }
      }).catch(e => console.error('[Tool] Prices error:', e))
    );
  }
  
  // Social data from token_cards (MASTERCARD)
  if (config.fetchSocial) {
    tasks.push(
      fetchWithTimeout(
        (signal) => fetchSocial(supabase, symbols, signal, results.cacheStats),
        TOOL_TIMEOUT_MS
      ).then(data => {
        if (data) {
          results.social = data;
          results.timestamps.social = new Date().toISOString();
        }
      }).catch(e => console.error('[Tool] Social error:', e))
    );
  }
  
  // Derivatives (cache-first with budget)
  if (config.fetchDerivs) {
    tasks.push(
      fetchWithTimeout(
        (signal) => fetchDerivatives(supabase, symbols, signal, budget, results.cacheStats),
        TOOL_TIMEOUT_MS
      ).then(data => {
        if (data) {
          results.derivs = data;
          results.timestamps.derivs = new Date().toISOString();
        }
      }).catch(e => console.error('[Tool] Derivs error:', e))
    );
  }
  
  // Security check with proper chain detection (cache-first)
  if (config.fetchSecurity && assets[0]?.address) {
    const chain = await detectChain(supabase, assets[0]);
    tasks.push(
      fetchWithTimeout(
        (signal) => fetchSecurity(assets[0].address!, chain, signal, budget, results.cacheStats, supabase),
        TOOL_TIMEOUT_MS
      ).then(data => {
        if (data) {
          results.security = data;
          results.timestamps.security = new Date().toISOString();
        }
      }).catch(e => console.error('[Tool] Security error:', e))
    );
  }
  
  // News from Mastercards FIRST, then cache/API fallback
  if (config.fetchNews) {
    const primarySymbol = symbols[0];
    const primaryType = assetTypes.get(primarySymbol) || 'crypto';
    tasks.push(
      fetchWithTimeout(
        (signal) => fetchNews(supabase, primarySymbol, primaryType, signal, budget, results.cacheStats),
        TOOL_TIMEOUT_MS
      ).then(data => {
        if (data) {
          results.news = data;
          results.timestamps.news = new Date().toISOString();
        }
      }).catch(e => console.error('[Tool] News error:', e))
    );
  }
  
  // Charts/technicals from Mastercards (token_cards for crypto, stock_cards for stocks)
  if (config.fetchCharts) {
    const primarySymbol = symbols[0];
    const primaryType = assetTypes.get(primarySymbol) || 'crypto';
    tasks.push(
      fetchWithTimeout(
        (signal) => fetchCharts(supabase, symbols, assetTypes, signal, results.cacheStats),
        TOOL_TIMEOUT_MS
      ).then(data => {
        if (data) {
          results.charts = data;
          results.timestamps.charts = new Date().toISOString();
        }
      }).catch(e => console.error('[Tool] Charts error:', e))
    );
  }
  
  // Asset details (fundamentals via asset-details edge function)
  if (config.fetchDetails && symbols.length > 0) {
    const primary = symbols[0];
    const typeHint = assets[0]?.type === 'stock' ? 'stock' : assets[0]?.type === 'crypto' ? 'crypto' : 'auto';
    
    tasks.push(
      fetchWithTimeout(
        (signal) => fetchAssetDetails(primary, typeHint, signal, budget, results.cacheStats),
        TOOL_TIMEOUT_MS
      ).then(data => {
        if (data) {
          results.details = data;
          results.timestamps.details = new Date().toISOString();
        }
      }).catch(e => console.error('[Tool] Details error:', e))
    );
  }
  
  await Promise.allSettled(tasks);
  
  console.log(`[Tool] Cache stats: ${results.cacheStats.hits.length} hits, ${results.cacheStats.misses.length} misses, ${results.cacheStats.apiCalls.length} API calls`);
  
  return results;
}

// Fetch asset details via edge function (budget-limited)
async function fetchAssetDetails(
  symbol: string,
  typeHint: 'stock' | 'crypto' | 'auto',
  signal: AbortSignal,
  budget: BudgetState,
  cacheStats: ToolResults['cacheStats']
): Promise<AssetDetails | null> {
  if (signal.aborted) return null;
  if (budget.assetDetails <= 0) {
    cacheStats.misses.push(`details:${symbol}:budget_exceeded`);
    console.log(`[Tool] Details: budget exceeded for ${symbol}`);
    return null;
  }
  
  budget.assetDetails--;
  cacheStats.apiCalls.push('asset-details');
  
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  
  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/asset-details`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({ symbol, type: typeHint === 'auto' ? '' : typeHint }),
      signal,
    });
    
    if (!res.ok) {
      console.error(`[Tool] Details: ${res.status} ${res.statusText}`);
      cacheStats.misses.push(`details:${symbol}:error`);
      return null;
    }
    
    const data = await res.json();
    cacheStats.hits.push(`details:${symbol}`);
    if (typeof data.age_seconds === 'number') {
      cacheStats.ages.details = data.age_seconds;
    }
    
    console.log(`[Tool] Details: fetched ${symbol} (${data.type}), age ${data.age_seconds}s`);
    return data as AssetDetails;
  } catch (e) {
    console.error(`[Tool] Details fetch error:`, e);
    cacheStats.misses.push(`details:${symbol}:exception`);
    return null;
  }
}

// Detect chain from asset or token_contracts
async function detectChain(supabase: any, asset: ResolvedAsset): Promise<string> {
  if (asset.address) {
    try {
      const { data } = await supabase
        .from('token_contracts')
        .select('chain')
        .eq('contract_address', asset.address.toLowerCase())
        .maybeSingle();
      
      if (data?.chain) {
        return data.chain;
      }
    } catch {
      // Ignore errors
    }
    
    if (asset.address.startsWith('0x')) {
      return 'ethereum';
    }
  }
  
  return 'unknown';
}

// --- TOOL IMPLEMENTATIONS (REFACTORED TO USE MASTERCARDS) ---

/**
 * REFACTORED: Fetch prices from Mastercards
 * - Crypto: token_cards
 * - Stocks: stock_cards
 * - Forex: forex_cards
 */
async function fetchPrices(
  supabase: any, 
  symbols: string[], 
  assetTypes: Map<string, 'crypto' | 'stock' | 'forex'>,
  signal: AbortSignal,
  cacheStats: ToolResults['cacheStats']
): Promise<PriceData[]> {
  if (signal.aborted) return [];
  
  const results: PriceData[] = [];
  const foundSymbols = new Set<string>();
  let stalestAge = 0;
  let newestAge = Infinity;
  
  // Split symbols by type
  const cryptoSymbols = symbols.filter(s => assetTypes.get(s) === 'crypto');
  const stockSymbols = symbols.filter(s => assetTypes.get(s) === 'stock');
  const forexSymbols = symbols.filter(s => assetTypes.get(s) === 'forex');
  
  // 1. Query token_cards for crypto (MASTERCARD)
  if (cryptoSymbols.length > 0) {
    const { data: cryptoData } = await supabase
      .from('token_cards')
      .select('canonical_symbol, name, price_usd, change_24h_pct, market_cap, volume_24h_usd, price_updated_at, price_source')
      .in('canonical_symbol', cryptoSymbols);
    
    if (cryptoData) {
      for (const c of cryptoData) {
        const age = ageSec(c.price_updated_at);
        const fresh = isFresh(c.price_updated_at, TTL_SEC.token_cards);
        
        results.push({
          symbol: c.canonical_symbol,
          price: c.price_usd,
          change24h: c.change_24h_pct || 0,
          marketCap: c.market_cap,
          volume24h: c.volume_24h_usd,
          source: fresh ? `token_cards:${c.price_source || 'unknown'}` : `token_cards:stale`,
          updatedAt: c.price_updated_at,
        });
        foundSymbols.add(c.canonical_symbol);
        cacheStats.hits.push(`price:${c.canonical_symbol}:token_cards`);
        if (age > stalestAge) stalestAge = age;
        if (age < newestAge) newestAge = age;
      }
    }
  }
  
  // 2. Query stock_cards for stocks (MASTERCARD)
  if (stockSymbols.length > 0) {
    const { data: stockData } = await supabase
      .from('stock_cards')
      .select('symbol, name, price_usd, change_pct, market_cap, volume, price_updated_at')
      .in('symbol', stockSymbols);
    
    if (stockData) {
      for (const s of stockData) {
        const age = ageSec(s.price_updated_at);
        const fresh = isFresh(s.price_updated_at, TTL_SEC.stock_cards);
        
        results.push({
          symbol: s.symbol,
          price: s.price_usd,
          change24h: s.change_pct || 0,
          marketCap: s.market_cap,
          volume24h: s.volume,
          source: fresh ? 'stock_cards' : 'stock_cards:stale',
          updatedAt: s.price_updated_at,
        });
        foundSymbols.add(s.symbol);
        cacheStats.hits.push(`price:${s.symbol}:stock_cards`);
        if (age > stalestAge) stalestAge = age;
        if (age < newestAge) newestAge = age;
      }
    }
  }
  
  // 3. Query forex_cards for forex (MASTERCARD)
  if (forexSymbols.length > 0) {
    const { data: forexData } = await supabase
      .from('forex_cards')
      .select('pair, display_name, rate, change_24h_pct, price_updated_at')
      .in('pair', forexSymbols);
    
    if (forexData) {
      for (const f of forexData) {
        const age = ageSec(f.price_updated_at);
        const fresh = isFresh(f.price_updated_at, TTL_SEC.forex_cards);
        
        results.push({
          symbol: f.pair,
          price: f.rate,
          change24h: f.change_24h_pct || 0,
          source: fresh ? 'forex_cards' : 'forex_cards:stale',
          updatedAt: f.price_updated_at,
        });
        foundSymbols.add(f.pair);
        cacheStats.hits.push(`price:${f.pair}:forex_cards`);
        if (age > stalestAge) stalestAge = age;
        if (age < newestAge) newestAge = age;
      }
    }
  }
  
  // Log misses
  const stillMissing = symbols.filter(s => !foundSymbols.has(s));
  for (const sym of stillMissing) {
    cacheStats.misses.push(`price:${sym}`);
  }
  
  // Record ages
  if (results.length > 0) {
    cacheStats.ages.prices = Math.round(stalestAge);
    cacheStats.ages.prices_newest = Math.round(newestAge);
  }
  
  console.log(`[Tool] Prices: ${results.length}/${symbols.length} from Mastercards, stalest ${Math.round(stalestAge)}s, freshest ${Math.round(newestAge)}s`);
  
  return results;
}

/**
 * REFACTORED: Social data from token_cards (MASTERCARD)
 */
async function fetchSocial(
  supabase: any, 
  symbols: string[], 
  signal: AbortSignal,
  cacheStats: ToolResults['cacheStats']
): Promise<SocialData[]> {
  if (signal.aborted) return [];
  
  const { data } = await supabase
    .from('token_cards')
    .select('canonical_symbol, galaxy_score, alt_rank, sentiment, social_volume_24h, social_updated_at')
    .in('canonical_symbol', symbols);
  
  if (!data || data.length === 0) {
    for (const sym of symbols) {
      cacheStats.misses.push(`social:${sym}`);
    }
    console.log('[Tool] Social: no data in token_cards');
    return [];
  }
  
  let oldestAge = 0;
  const results: SocialData[] = [];
  
  for (const d of data) {
    const age = ageSec(d.social_updated_at);
    results.push({
      symbol: d.canonical_symbol,
      galaxyScore: d.galaxy_score,
      altRank: d.alt_rank,
      sentiment: d.sentiment,
      socialVolume: d.social_volume_24h,
      updatedAt: d.social_updated_at,
    });
    cacheStats.hits.push(`social:${d.canonical_symbol}:token_cards`);
    if (age > oldestAge) oldestAge = age;
  }
  
  cacheStats.ages.social = Math.round(oldestAge);
  console.log(`[Tool] Social: ${results.length}/${symbols.length} from token_cards, oldest ${Math.round(oldestAge)}s`);
  
  return results;
}

// Derivatives - cache-first with budget-limited API fallback
async function fetchDerivatives(
  supabase: any,
  symbols: string[], 
  signal: AbortSignal,
  budget: BudgetState,
  cacheStats: ToolResults['cacheStats']
): Promise<DerivsData[]> {
  if (signal.aborted) return [];
  
  const results: DerivsData[] = [];
  const needsApiCall: string[] = [];
  let oldestAge = 0;
  
  // 1. Check cache first
  const { data: cached } = await supabase
    .from('derivatives_cache')
    .select('symbol, funding_rate, open_interest, liquidations_24h, updated_at')
    .in('symbol', symbols);
  
  if (cached) {
    for (const c of cached) {
      const age = ageSec(c.updated_at);
      
      if (isFresh(c.updated_at, TTL_SEC.derivs)) {
        results.push({
          symbol: c.symbol,
          fundingRate: c.funding_rate || 0,
          liquidations24h: c.liquidations_24h || { long: 0, short: 0, total: 0 },
          updatedAt: c.updated_at,
        });
        cacheStats.hits.push(`derivs:${c.symbol}`);
        if (age > oldestAge) oldestAge = age;
      } else {
        // Stale - needs refresh
        needsApiCall.push(c.symbol);
      }
    }
  }
  
  // Find symbols not in cache at all
  const cachedSymbols = new Set((cached || []).map((c: any) => c.symbol));
  for (const sym of symbols) {
    if (!cachedSymbols.has(sym) && !needsApiCall.includes(sym)) {
      needsApiCall.push(sym);
    }
  }
  
  // 2. Only call CoinGlass if budget allows AND we have missing/stale data
  if (needsApiCall.length > 0 && budget.coinglass > 0 && !signal.aborted) {
    const coinglassKey = Deno.env.get('COINGLASS_API_KEY');
    
    if (coinglassKey) {
      budget.coinglass--; // Consume budget
      cacheStats.apiCalls.push('coinglass');
      
      const apiResults = await fetchDerivativesFromAPI(needsApiCall.slice(0, 3), coinglassKey, signal);
      
      // Upsert to cache
      if (apiResults.length > 0) {
        await supabase.from('derivatives_cache').upsert(
          apiResults.map(d => ({
            symbol: d.symbol,
            funding_rate: d.fundingRate,
            liquidations_24h: d.liquidations24h,
            updated_at: new Date().toISOString(),
          })),
          { onConflict: 'symbol' }
        );
        
        results.push(...apiResults);
        for (const d of apiResults) {
          cacheStats.hits.push(`derivs:${d.symbol}:fresh`);
        }
      }
    }
  } else if (needsApiCall.length > 0) {
    for (const sym of needsApiCall) {
      cacheStats.misses.push(`derivs:${sym}`);
    }
  }
  
  if (results.length > 0) {
    cacheStats.ages.derivs = Math.round(oldestAge);
  }
  
  console.log(`[Tool] Derivs: ${results.length}/${symbols.length}, budget remaining: ${budget.coinglass}`);
  
  return results;
}

// Direct CoinGlass API call (used only when cache is stale/missing)
async function fetchDerivativesFromAPI(
  symbols: string[], 
  apiKey: string,
  signal: AbortSignal
): Promise<DerivsData[]> {
  const results: DerivsData[] = [];
  
  for (const symbol of symbols) {
    if (signal.aborted) break;
    
    try {
      const response = await fetch(
        `https://open-api.coinglass.com/public/v2/funding?symbol=${symbol}&time_type=h8`,
        {
          headers: { 'coinglassSecret': apiKey },
          signal,
        }
      );
      
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data?.length > 0) {
          const latest = data.data[0];
          results.push({
            symbol,
            fundingRate: parseFloat(latest.fundingRate) || 0,
            liquidations24h: { long: 0, short: 0, total: 0 },
            updatedAt: new Date().toISOString(),
          });
        }
      }
    } catch (e) {
      if (e instanceof Error && e.name !== 'AbortError') {
        console.error(`[Tool] CoinGlass error for ${symbol}:`, e);
      }
    }
  }
  
  return results;
}

// Security check - CACHE-FIRST with multi-chain support
async function fetchSecurity(
  address: string, 
  chain: string, 
  signal: AbortSignal,
  budget: BudgetState,
  cacheStats: ToolResults['cacheStats'],
  supabase?: any
): Promise<SecurityData> {
  const result: SecurityData = {
    riskLevel: 'Unknown',
    flags: [],
    chain,
  };
  
  if (signal.aborted) return result;
  
  const normalizedAddress = address.toLowerCase();
  
  // 1. Check security_cache FIRST (24h TTL)
  if (supabase) {
    const { data: cached } = await supabase
      .from('security_cache')
      .select('*')
      .eq('address', normalizedAddress)
      .maybeSingle();
    
    if (cached) {
      const age = ageSec(cached.updated_at);
      
      if (age <= TTL_SEC.security) {
        cacheStats.hits.push('security:cached');
        cacheStats.ages.security = Math.round(age);
        console.log(`[Tool] Security: cache hit for ${address}, age ${Math.round(age)}s`);
        
        return {
          riskLevel: cached.risk_level || 'Unknown',
          flags: cached.flags || [],
          isHoneypot: cached.is_honeypot,
          liquidity: cached.liquidity,
          contractInfo: cached.contract_info,
          chain: cached.chain || chain,
        };
      } else {
        console.log(`[Tool] Security: cache stale for ${address}, age ${Math.round(age)}s`);
      }
    }
  }
  
  // 2. Cache miss - call APIs if budget allows
  
  // Determine which chain IDs to try
  let chainIds: string[] = [];
  
  if (chain !== 'unknown' && GOPLUS_CHAINS[chain]) {
    chainIds = [GOPLUS_CHAINS[chain]];
  } else if (address.startsWith('0x')) {
    chainIds = ['1', '56', '8453', '42161', '137'];
  } else {
    chainIds = ['solana'];
  }
  
  // GoPlus Security API (budget-limited)
  if (budget.goplus > 0) {
    budget.goplus--;
    cacheStats.apiCalls.push('goplus');
    
    for (const chainId of chainIds) {
      if (signal.aborted) break;
      
      try {
        const goplusUrl = chainId === 'solana'
          ? `https://api.gopluslabs.io/api/v1/solana/token_security?contract_addresses=${address}`
          : `https://api.gopluslabs.io/api/v1/token_security/${chainId}?contract_addresses=${address}`;
        
        const response = await fetch(goplusUrl, { signal });
        if (!response.ok) continue;
        
        const data = await response.json();
        const tokenData = data.result?.[normalizedAddress] || data.result?.[address];
        
        if (tokenData) {
          result.chain = chainId === 'solana' ? 'solana' : 
            chainId === '1' ? 'ethereum' :
            chainId === '56' ? 'bsc' :
            chainId === '8453' ? 'base' :
            chainId === '42161' ? 'arbitrum' :
            chainId === '137' ? 'polygon' : 'unknown';
          
          const flags: string[] = [];
          
          if (tokenData.is_honeypot === '1') {
            flags.push('🚨 HONEYPOT DETECTED');
            result.riskLevel = 'High';
            result.isHoneypot = true;
          }
          
          if (tokenData.is_mintable === '1') {
            flags.push('⚠️ Token is mintable');
          }
          
          if (tokenData.cannot_sell_all === '1') {
            flags.push('⚠️ Sell restrictions detected');
          }
          
          const holderCount = parseInt(tokenData.holder_count || '0');
          if (holderCount < 100) {
            flags.push(`⚠️ Low holder count: ${holderCount}`);
          }
          
          if (flags.length === 0) {
            result.riskLevel = 'Low';
          } else if (flags.length <= 2 && !result.isHoneypot) {
            result.riskLevel = 'Medium';
          } else {
            result.riskLevel = 'High';
          }
          
          result.flags = flags;
          result.contractInfo = {
            verified: tokenData.is_open_source === '1',
            mintable: tokenData.is_mintable === '1',
          };
          
          cacheStats.hits.push('security:goplus');
          break;
        }
      } catch (e) {
        if (e instanceof Error && e.name !== 'AbortError') {
          console.error(`[Tool] GoPlus error for chain ${chainId}:`, e);
        }
      }
    }
  } else {
    cacheStats.misses.push('security:budget_exceeded');
  }
  
  // DexScreener for liquidity (budget-limited)
  if (!signal.aborted && budget.dexscreener > 0) {
    budget.dexscreener--;
    cacheStats.apiCalls.push('dexscreener');
    
    try {
      const dexUrl = `https://api.dexscreener.com/latest/dex/tokens/${address}`;
      const response = await fetch(dexUrl, { signal });
      
      if (response.ok) {
        const data = await response.json();
        const pairs = data.pairs || [];
        
        if (pairs.length > 0) {
          const totalLiquidity = pairs.reduce((sum: number, p: any) => sum + (p.liquidity?.usd || 0), 0);
          result.liquidity = {
            dex: totalLiquidity,
            cex: [],
          };
          
          if (totalLiquidity < 10000) {
            result.flags.push(`⚠️ Very low liquidity: $${totalLiquidity.toLocaleString()}`);
            if (result.riskLevel === 'Low') result.riskLevel = 'Medium';
          }
          
          cacheStats.hits.push('security:dexscreener');
        }
      }
    } catch (e) {
      if (e instanceof Error && e.name !== 'AbortError') {
        console.error('[Tool] DexScreener error:', e);
      }
    }
  }
  
  // 3. Cache the result for future requests
  if (supabase && result.riskLevel !== 'Unknown') {
    await supabase.from('security_cache').upsert({
      address: normalizedAddress,
      chain: result.chain,
      risk_level: result.riskLevel,
      flags: result.flags,
      is_honeypot: result.isHoneypot || false,
      liquidity: result.liquidity || {},
      contract_info: result.contractInfo || {},
      source: 'goplus+dexscreener',
      updated_at: new Date().toISOString(),
    }, { onConflict: 'address' });
    
    cacheStats.ages.security = 0; // Just fetched
    console.log(`[Tool] Security: cached result for ${address}`);
  }
  
  return result;
}

/**
 * REFACTORED: News from Mastercards FIRST, then cache/API fallback
 * Priority: token_cards.top_news → stock_cards.top_news → news_cache → Tavily
 */
async function fetchNews(
  supabase: any,
  symbol: string,
  assetType: 'crypto' | 'stock' | 'forex',
  signal: AbortSignal,
  budget: BudgetState,
  cacheStats: ToolResults['cacheStats']
): Promise<NewsItem[]> {
  if (signal.aborted) return [];
  
  // 1. Check Mastercard FIRST for embedded news
  if (assetType === 'crypto') {
    const { data: tokenCard } = await supabase
      .from('token_cards')
      .select('top_news')
      .eq('canonical_symbol', symbol)
      .maybeSingle();
    
    if (tokenCard?.top_news && Array.isArray(tokenCard.top_news) && tokenCard.top_news.length > 0) {
      cacheStats.hits.push(`news:${symbol}:token_cards`);
      console.log(`[Tool] News: ${tokenCard.top_news.length} articles from token_cards for ${symbol}`);
      
      return tokenCard.top_news.slice(0, 5).map((n: any) => ({
        title: n.title,
        source: n.publisher || n.source || 'Unknown',
        date: n.published_utc || n.date || new Date().toISOString(),
        summary: n.description || n.summary,
        url: n.article_url || n.url,
      }));
    }
  } else if (assetType === 'stock') {
    const { data: stockCard } = await supabase
      .from('stock_cards')
      .select('top_news')
      .eq('symbol', symbol)
      .maybeSingle();
    
    if (stockCard?.top_news && Array.isArray(stockCard.top_news) && stockCard.top_news.length > 0) {
      cacheStats.hits.push(`news:${symbol}:stock_cards`);
      console.log(`[Tool] News: ${stockCard.top_news.length} articles from stock_cards for ${symbol}`);
      
      return stockCard.top_news.slice(0, 5).map((n: any) => ({
        title: n.title,
        source: n.publisher || n.source || 'Unknown',
        date: n.published_utc || n.date || new Date().toISOString(),
        summary: n.description || n.summary,
        url: n.article_url || n.url,
      }));
    }
  }
  
  // 2. Fallback: Check news_cache (last 30 minutes)
  const cacheThreshold = new Date(Date.now() - TTL_SEC.news * 1000).toISOString();
  
  const { data: cached } = await supabase
    .from('news_cache')
    .select('title, source, published_at, summary, created_at')
    .eq('symbol', symbol)
    .gte('created_at', cacheThreshold)
    .order('created_at', { ascending: false })
    .limit(5);
  
  if (cached && cached.length > 0) {
    const age = ageSec(cached[0].created_at);
    cacheStats.hits.push(`news:${symbol}:cache`);
    cacheStats.ages.news = Math.round(age);
    
    console.log(`[Tool] News: cache hit for ${symbol}, age ${Math.round(age)}s`);
    
    return cached.map((n: any) => ({
      title: n.title,
      source: n.source || 'Unknown',
      date: n.published_at || n.created_at,
      summary: n.summary,
    }));
  }
  
  // 3. Last resort: call Tavily if budget allows
  if (budget.tavily > 0) {
    const tavilyKey = Deno.env.get('TAVILY_API_KEY');
    
    if (tavilyKey && !signal.aborted) {
      budget.tavily--;
      cacheStats.apiCalls.push('tavily');
      
      try {
        const query = assetType === 'stock' 
          ? `${symbol} stock news` 
          : `${symbol} cryptocurrency news`;
        
        const response = await fetch('https://api.tavily.com/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            api_key: tavilyKey,
            query,
            search_depth: 'basic',
            max_results: 5,
          }),
          signal,
        });
        
        if (response.ok) {
          const data = await response.json();
          const newsItems: NewsItem[] = (data.results || []).map((r: any) => ({
            title: r.title,
            source: r.source || 'Unknown',
            date: r.published_date || new Date().toISOString(),
            summary: r.content?.slice(0, 200),
          }));
          
          // Cache the results
          if (newsItems.length > 0) {
            await supabase.from('news_cache').insert(
              newsItems.map(n => ({
                symbol,
                title: n.title,
                source: n.source,
                url: '',
                published_at: n.date,
                summary: n.summary,
              }))
            );
            
            cacheStats.hits.push(`news:${symbol}:tavily`);
            cacheStats.ages.news = 0; // Just fetched
          }
          
          console.log(`[Tool] News: Tavily returned ${newsItems.length} articles for ${symbol}`);
          return newsItems;
        }
      } catch (e) {
        if (e instanceof Error && e.name !== 'AbortError') {
          console.error('[Tool] Tavily error:', e);
        }
      }
    }
  } else {
    cacheStats.misses.push(`news:${symbol}:budget_exceeded`);
  }
  
  cacheStats.misses.push(`news:${symbol}`);
  console.log(`[Tool] News: no data for ${symbol}`);
  
  return [];
}

/**
 * REFACTORED: Charts/technicals from Mastercards
 * - Crypto: token_cards (rsi_14, macd_line, macd_signal, macd_histogram, sma_20, sma_50, sma_200, ema_12, ema_26, technical_score, technical_signal)
 * - Stocks: stock_cards (rsi_14, macd_line, macd_signal, sma_20, sma_50, sma_200, technical_signal)
 */
async function fetchCharts(
  supabase: any, 
  symbols: string[],
  assetTypes: Map<string, 'crypto' | 'stock' | 'forex'>,
  signal: AbortSignal,
  cacheStats: ToolResults['cacheStats']
): Promise<ChartData | null> {
  if (signal.aborted) return null;
  
  const primarySymbol = symbols[0];
  const primaryType = assetTypes.get(primarySymbol) || 'crypto';
  
  // Query the appropriate Mastercard based on asset type
  if (primaryType === 'crypto') {
    const { data } = await supabase
      .from('token_cards')
      .select('canonical_symbol, rsi_14, macd_line, macd_signal, macd_histogram, sma_20, sma_50, sma_200, ema_12, ema_26, technical_score, technical_signal, technicals_updated_at')
      .eq('canonical_symbol', primarySymbol)
      .maybeSingle();
    
    if (data) {
      const age = ageSec(data.technicals_updated_at);
      cacheStats.hits.push(`charts:${primarySymbol}:token_cards`);
      cacheStats.ages.charts = Math.round(age);
      
      console.log(`[Tool] Charts: token_cards hit for ${primarySymbol}, age ${Math.round(age)}s`);
      
      return {
        rsi: data.rsi_14,
        macd: data.macd_line ? {
          value: data.macd_line,
          signal: data.macd_signal || 0,
          histogram: data.macd_histogram || 0,
        } : undefined,
        sma20: data.sma_20,
        sma50: data.sma_50,
        sma200: data.sma_200,
        ema12: data.ema_12,
        ema26: data.ema_26,
        technicalScore: data.technical_score,
        technicalSignal: data.technical_signal,
        updatedAt: data.technicals_updated_at,
      };
    }
  } else if (primaryType === 'stock') {
    const { data } = await supabase
      .from('stock_cards')
      .select('symbol, rsi_14, macd_line, macd_signal, sma_20, sma_50, sma_200, technical_signal, technicals_updated_at')
      .eq('symbol', primarySymbol)
      .maybeSingle();
    
    if (data) {
      const age = ageSec(data.technicals_updated_at);
      cacheStats.hits.push(`charts:${primarySymbol}:stock_cards`);
      cacheStats.ages.charts = Math.round(age);
      
      console.log(`[Tool] Charts: stock_cards hit for ${primarySymbol}, age ${Math.round(age)}s`);
      
      return {
        rsi: data.rsi_14,
        macd: data.macd_line ? {
          value: data.macd_line,
          signal: data.macd_signal || 0,
          histogram: 0,
        } : undefined,
        sma20: data.sma_20,
        sma50: data.sma_50,
        sma200: data.sma_200,
        technicalSignal: data.technical_signal,
        updatedAt: data.technicals_updated_at,
      };
    }
  }
  
  cacheStats.misses.push(`charts:${primarySymbol}`);
  console.log(`[Tool] Charts: no data in Mastercards for ${primarySymbol}`);
  return null;
}
