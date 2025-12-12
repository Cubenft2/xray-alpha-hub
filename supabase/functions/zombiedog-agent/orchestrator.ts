// Tool Orchestrator: Cache-first execution with TTL, budgets, and timeouts
// Supports thousands of concurrent users without per-request API spam

import { RouteConfig } from "./router.ts";
import { ResolvedAsset } from "./resolver.ts";

const TOOL_TIMEOUT_MS = 5000;

// TTL Configuration (in seconds)
const TTL_SEC = {
  live_prices: 180,      // 3 min (pollers run every 2-5 min)
  crypto_snapshot: 300,  // 5 min (LunarCrush sync every 1 min)
  stock_snapshot: 300,   // 5 min fallback
  indicators: 3600,      // 1 hour
  derivs: 300,           // 5 min
  news: 1800,            // 30 min
  security: 86400,       // 24h (mostly static)
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

export interface ToolResults {
  prices?: PriceData[];
  social?: SocialData[];
  derivs?: DerivsData[];
  security?: SecurityData;
  news?: NewsItem[];
  charts?: ChartData;
  details?: AssetDetails; // Asset fundamentals
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
}

export interface ChartData {
  rsi?: number;
  macd?: { value: number; signal: number; histogram: number };
  sma20?: number;
  sma50?: number;
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
  
  if (symbols.length === 0) {
    if (config.intent === 'market_overview') {
      symbols.push('BTC', 'ETH', 'SOL', 'XRP', 'DOGE');
    } else {
      return results;
    }
  }
  
  const tasks: Promise<void>[] = [];
  
  // Price fetching (cache-first: live_prices → crypto_snapshot → stock_snapshot)
  if (config.fetchPrices) {
    tasks.push(
      fetchWithTimeout(
        (signal) => fetchPrices(supabase, symbols, signal, results.cacheStats),
        TOOL_TIMEOUT_MS
      ).then(data => {
        if (data) {
          results.prices = data;
          results.timestamps.prices = new Date().toISOString();
        }
      }).catch(e => console.error('[Tool] Prices error:', e))
    );
  }
  
  // Social data (cache-only from crypto_snapshot)
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
  
  // News (cache-first with budget)
  if (config.fetchNews) {
    tasks.push(
      fetchWithTimeout(
        (signal) => fetchNews(supabase, symbols[0], signal, budget, results.cacheStats),
        TOOL_TIMEOUT_MS
      ).then(data => {
        if (data) {
          results.news = data;
          results.timestamps.news = new Date().toISOString();
        }
      }).catch(e => console.error('[Tool] News error:', e))
    );
  }
  
  // Charts/technical (cache-only)
  if (config.fetchCharts) {
    tasks.push(
      fetchWithTimeout(
        (signal) => fetchCharts(supabase, symbols[0], signal, results.cacheStats),
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

// --- TOOL IMPLEMENTATIONS ---

// CRITICAL: Cache-first price fetching with correct priority
// Priority: live_prices (freshest) → crypto_snapshot → stock_snapshot
async function fetchPrices(
  supabase: any, 
  symbols: string[], 
  signal: AbortSignal,
  cacheStats: ToolResults['cacheStats']
): Promise<PriceData[]> {
  if (signal.aborted) return [];
  
  const results: PriceData[] = [];
  const foundSymbols = new Set<string>();
  let stalestAge = 0;  // Renamed for clarity: this is the worst-case (stalest) data age
  let newestAge = Infinity;  // Best-case: freshest data age
  
  // Build all possible ticker formats for live_prices lookup
  const tickerVariants: string[] = [];
  for (const sym of symbols) {
    tickerVariants.push(sym);
    tickerVariants.push(`X:${sym}USD`);  // Crypto format
    tickerVariants.push(sym.toUpperCase());
  }
  
  // 1. Query live_prices FIRST (freshest data from pollers)
  const { data: liveData } = await supabase
    .from('live_prices')
    .select('ticker, price, change24h, updated_at')
    .in('ticker', tickerVariants);
  
  if (liveData) {
    for (const l of liveData) {
      // Normalize symbol from ticker format
      let normalizedSymbol = l.ticker;
      if (l.ticker.startsWith('X:') && l.ticker.endsWith('USD')) {
        normalizedSymbol = l.ticker.slice(2, -3); // X:BTCUSD → BTC
      }
      
      const age = ageSec(l.updated_at);
      
      // Only include if fresh
      if (isFresh(l.updated_at, TTL_SEC.live_prices)) {
        results.push({
          symbol: normalizedSymbol,
          price: l.price,
          change24h: l.change24h || 0,
          source: 'live_prices',
          updatedAt: l.updated_at,
        });
        foundSymbols.add(normalizedSymbol);
        cacheStats.hits.push(`price:${normalizedSymbol}`);
        if (age > stalestAge) stalestAge = age;
        if (age < newestAge) newestAge = age;
      } else {
        // Data exists but is stale - still return it but mark as stale
        results.push({
          symbol: normalizedSymbol,
          price: l.price,
          change24h: l.change24h || 0,
          source: 'live_prices_stale',
          updatedAt: l.updated_at,
        });
        foundSymbols.add(normalizedSymbol);
        cacheStats.hits.push(`price:${normalizedSymbol}:stale`);
        if (age > stalestAge) stalestAge = age;
        if (age < newestAge) newestAge = age;
      }
    }
  }
  
  // 2. Check crypto_snapshot for missing symbols
  const missingAfterLive = symbols.filter(s => !foundSymbols.has(s));
  if (missingAfterLive.length > 0) {
    const { data: cryptoData } = await supabase
      .from('crypto_snapshot')
      .select('symbol, price, change_percent, market_cap, volume_24h, updated_at')
      .in('symbol', missingAfterLive);
    
    if (cryptoData) {
      for (const c of cryptoData) {
        const age = ageSec(c.updated_at);
        results.push({
          symbol: c.symbol,
          price: c.price,
          change24h: c.change_percent || 0,
          marketCap: c.market_cap,
          volume24h: c.volume_24h,
          source: isFresh(c.updated_at, TTL_SEC.crypto_snapshot) ? 'crypto_snapshot' : 'crypto_snapshot_stale',
          updatedAt: c.updated_at,
        });
        foundSymbols.add(c.symbol);
        cacheStats.hits.push(`price:${c.symbol}:snapshot`);
        if (age > stalestAge) stalestAge = age;
        if (age < newestAge) newestAge = age;
      }
    }
  }
  
  // 3. Check stock_snapshot for still-missing symbols (stocks only)
  const missingAfterCrypto = symbols.filter(s => !foundSymbols.has(s));
  if (missingAfterCrypto.length > 0) {
    const { data: stockData } = await supabase
      .from('stock_snapshot')
      .select('symbol, price, change_percent, market_cap, volume_24h, updated_at')
      .in('symbol', missingAfterCrypto);
    
    if (stockData) {
      for (const s of stockData) {
        const age = ageSec(s.updated_at);
        results.push({
          symbol: s.symbol,
          price: s.price,
          change24h: s.change_percent || 0,
          marketCap: s.market_cap,
          volume24h: s.volume_24h,
          source: isFresh(s.updated_at, TTL_SEC.stock_snapshot) ? 'stock_snapshot' : 'stock_snapshot_stale',
          updatedAt: s.updated_at,
        });
        foundSymbols.add(s.symbol);
        cacheStats.hits.push(`price:${s.symbol}:stock`);
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
  
  // Record both stalest (worst-case) and freshest ages
  if (results.length > 0) {
    cacheStats.ages.prices = Math.round(stalestAge);  // Show stalest for transparency
    cacheStats.ages.prices_newest = Math.round(newestAge);  // Also track freshest
  }
  
  console.log(`[Tool] Prices: ${results.length}/${symbols.length} found, stalest ${Math.round(stalestAge)}s, freshest ${Math.round(newestAge)}s`);
  
  return results;
}

// Social data - cache-only from crypto_snapshot (no API calls)
async function fetchSocial(
  supabase: any, 
  symbols: string[], 
  signal: AbortSignal,
  cacheStats: ToolResults['cacheStats']
): Promise<SocialData[]> {
  if (signal.aborted) return [];
  
  const { data } = await supabase
    .from('crypto_snapshot')
    .select('symbol, galaxy_score, alt_rank, sentiment, social_volume_24h, updated_at')
    .in('symbol', symbols);
  
  if (!data || data.length === 0) {
    for (const sym of symbols) {
      cacheStats.misses.push(`social:${sym}`);
    }
    console.log('[Tool] Social: cache miss (no data in crypto_snapshot)');
    return [];
  }
  
  let oldestAge = 0;
  const results: SocialData[] = [];
  
  for (const d of data) {
    const age = ageSec(d.updated_at);
    results.push({
      symbol: d.symbol,
      galaxyScore: d.galaxy_score,
      altRank: d.alt_rank,
      sentiment: d.sentiment,
      socialVolume: d.social_volume_24h,
      updatedAt: d.updated_at,
    });
    cacheStats.hits.push(`social:${d.symbol}`);
    if (age > oldestAge) oldestAge = age;
  }
  
  cacheStats.ages.social = Math.round(oldestAge);
  console.log(`[Tool] Social: ${results.length}/${symbols.length} cache hits, oldest ${Math.round(oldestAge)}s`);
  
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

// News - cache-first with budget-limited API fallback
async function fetchNews(
  supabase: any,
  symbol: string, 
  signal: AbortSignal,
  budget: BudgetState,
  cacheStats: ToolResults['cacheStats']
): Promise<NewsItem[]> {
  if (signal.aborted) return [];
  
  // 1. Check cache first (last 30 minutes)
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
    cacheStats.hits.push(`news:${symbol}`);
    cacheStats.ages.news = Math.round(age);
    
    console.log(`[Tool] News: cache hit for ${symbol}, age ${Math.round(age)}s`);
    
    return cached.map((n: any) => ({
      title: n.title,
      source: n.source || 'Unknown',
      date: n.published_at || n.created_at,
      summary: n.summary,
    }));
  }
  
  // 2. Cache miss - call Tavily if budget allows
  if (budget.tavily > 0) {
    const tavilyKey = Deno.env.get('TAVILY_API_KEY');
    
    if (tavilyKey && !signal.aborted) {
      budget.tavily--;
      cacheStats.apiCalls.push('tavily');
      
      try {
        const response = await fetch('https://api.tavily.com/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            api_key: tavilyKey,
            query: `${symbol} cryptocurrency news`,
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
            
            cacheStats.hits.push(`news:${symbol}:fresh`);
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
  console.log(`[Tool] News: cache miss for ${symbol}, no budget for API call`);
  
  return [];
}

// Charts/technical - cache-only from technical_indicators
async function fetchCharts(
  supabase: any, 
  symbol: string, 
  signal: AbortSignal,
  cacheStats: ToolResults['cacheStats']
): Promise<ChartData | null> {
  if (signal.aborted) return null;
  
  const { data } = await supabase
    .from('technical_indicators')
    .select('indicator_type, value, created_at, expires_at')
    .eq('ticker', symbol)
    .gt('expires_at', new Date().toISOString());
  
  if (!data || data.length === 0) {
    // Also try X:BTCUSD format for crypto
    const { data: cryptoData } = await supabase
      .from('technical_indicators')
      .select('indicator_type, value, created_at, expires_at')
      .eq('ticker', `X:${symbol}USD`)
      .gt('expires_at', new Date().toISOString());
    
    if (!cryptoData || cryptoData.length === 0) {
      cacheStats.misses.push(`charts:${symbol}`);
      console.log(`[Tool] Charts: cache miss for ${symbol}`);
      return null;
    }
    
    return parseChartData(cryptoData, symbol, cacheStats);
  }
  
  return parseChartData(data, symbol, cacheStats);
}

function parseChartData(
  data: any[], 
  symbol: string,
  cacheStats: ToolResults['cacheStats']
): ChartData {
  const result: ChartData = {};
  let oldestAge = 0;
  
  for (const d of data) {
    const age = ageSec(d.created_at);
    if (age > oldestAge) oldestAge = age;
    
    if (d.indicator_type === 'rsi') result.rsi = d.value?.rsi;
    if (d.indicator_type === 'macd') result.macd = d.value;
    if (d.indicator_type === 'sma') {
      result.sma20 = d.value?.sma20;
      result.sma50 = d.value?.sma50;
    }
  }
  
  cacheStats.hits.push(`charts:${symbol}`);
  cacheStats.ages.charts = Math.round(oldestAge);
  
  console.log(`[Tool] Charts: cache hit for ${symbol}, age ${Math.round(oldestAge)}s`);
  
  return result;
}
