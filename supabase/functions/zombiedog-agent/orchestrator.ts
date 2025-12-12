// Tool Orchestrator: Execute tools in parallel with timeouts, fallbacks, and AbortController
// FIXES: #7 (GoPlus chain), #8 (derivs call), #9 (AbortController timeout)

import { RouteConfig } from "./router.ts";
import { ResolvedAsset } from "./resolver.ts";

const TOOL_TIMEOUT_MS = 5000;

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
  timestamps: Record<string, string>;
}

export interface PriceData {
  symbol: string;
  price: number;
  change24h: number;
  marketCap?: number;
  volume24h?: number;
  source: string;
}

export interface SocialData {
  symbol: string;
  galaxyScore?: number;
  altRank?: number;
  sentiment?: number;
  socialVolume?: number;
}

export interface DerivsData {
  symbol: string;
  fundingRate: number;
  liquidations24h: { long: number; short: number; total: number };
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
}

// FIX #9: Proper timeout with AbortController
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
  };
  const symbols = assets.map(a => a.symbol);
  
  if (symbols.length === 0) {
    if (config.intent === 'market_overview') {
      symbols.push('BTC', 'ETH', 'SOL', 'XRP', 'DOGE');
    } else {
      return results;
    }
  }
  
  const tasks: Promise<void>[] = [];
  
  // Price fetching
  if (config.fetchPrices) {
    tasks.push(
      fetchWithTimeout(
        (signal) => fetchPrices(supabase, symbols, signal),
        TOOL_TIMEOUT_MS
      ).then(data => {
        if (data) {
          results.prices = data;
          results.timestamps.prices = new Date().toISOString();
        }
      }).catch(e => console.error('[Tool] Prices error:', e))
    );
  }
  
  // Social data
  if (config.fetchSocial) {
    tasks.push(
      fetchWithTimeout(
        (signal) => fetchSocial(supabase, symbols, signal),
        TOOL_TIMEOUT_MS
      ).then(data => {
        if (data) {
          results.social = data;
          results.timestamps.social = new Date().toISOString();
        }
      }).catch(e => console.error('[Tool] Social error:', e))
    );
  }
  
  // FIX #8: Direct derivatives fetch instead of calling edge function
  if (config.fetchDerivs) {
    tasks.push(
      fetchWithTimeout(
        (signal) => fetchDerivativesDirect(symbols, signal),
        TOOL_TIMEOUT_MS
      ).then(data => {
        if (data) {
          results.derivs = data;
          results.timestamps.derivs = new Date().toISOString();
        }
      }).catch(e => console.error('[Tool] Derivs error:', e))
    );
  }
  
  // FIX #7: Security check with proper chain detection
  if (config.fetchSecurity && assets[0]?.address) {
    const chain = detectChain(supabase, assets[0]);
    tasks.push(
      fetchWithTimeout(
        (signal) => fetchSecurity(assets[0].address!, chain, signal),
        TOOL_TIMEOUT_MS
      ).then(data => {
        if (data) {
          results.security = data;
          results.timestamps.security = new Date().toISOString();
        }
      }).catch(e => console.error('[Tool] Security error:', e))
    );
  }
  
  // News (optional, skip gracefully if slow)
  if (config.fetchNews) {
    tasks.push(
      fetchWithTimeout(
        (signal) => fetchNews(symbols[0], signal),
        TOOL_TIMEOUT_MS
      ).then(data => {
        if (data) {
          results.news = data;
          results.timestamps.news = new Date().toISOString();
        }
      }).catch(e => console.error('[Tool] News error:', e))
    );
  }
  
  // Charts/technical
  if (config.fetchCharts) {
    tasks.push(
      fetchWithTimeout(
        (signal) => fetchCharts(supabase, symbols[0], signal),
        TOOL_TIMEOUT_MS
      ).then(data => {
        if (data) {
          results.charts = data;
          results.timestamps.charts = new Date().toISOString();
        }
      }).catch(e => console.error('[Tool] Charts error:', e))
    );
  }
  
  await Promise.allSettled(tasks);
  return results;
}

// FIX #7: Detect chain from asset or token_contracts
async function detectChain(supabase: any, asset: ResolvedAsset): Promise<string> {
  if (asset.address) {
    // Check token_contracts table for chain info
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
    
    // Default based on address format
    if (asset.address.startsWith('0x')) {
      return 'ethereum'; // Default EVM to ETH mainnet
    }
  }
  
  return 'unknown';
}

// --- TOOL IMPLEMENTATIONS ---

async function fetchPrices(supabase: any, symbols: string[], signal: AbortSignal): Promise<PriceData[]> {
  if (signal.aborted) return [];
  
  const results: PriceData[] = [];
  
  // Try crypto_snapshot first
  const { data: cryptoData } = await supabase
    .from('crypto_snapshot')
    .select('symbol, price, change_percent, market_cap, volume_24h')
    .in('symbol', symbols);
  
  if (cryptoData) {
    for (const c of cryptoData) {
      results.push({
        symbol: c.symbol,
        price: c.price,
        change24h: c.change_percent || 0,
        marketCap: c.market_cap,
        volume24h: c.volume_24h,
        source: 'crypto_snapshot',
      });
    }
  }
  
  // Check for missing symbols in stock_snapshot
  const foundSymbols = new Set(results.map(r => r.symbol));
  const missingSymbols = symbols.filter(s => !foundSymbols.has(s));
  
  if (missingSymbols.length > 0) {
    const { data: stockData } = await supabase
      .from('stock_snapshot')
      .select('symbol, price, change_percent, market_cap, volume_24h')
      .in('symbol', missingSymbols);
    
    if (stockData) {
      for (const s of stockData) {
        results.push({
          symbol: s.symbol,
          price: s.price,
          change24h: s.change_percent || 0,
          marketCap: s.market_cap,
          volume24h: s.volume_24h,
          source: 'stock_snapshot',
        });
      }
    }
  }
  
  // Fallback to live_prices for any still missing
  const stillFoundSymbols = new Set(results.map(r => r.symbol));
  const stillMissing = symbols.filter(s => !stillFoundSymbols.has(s));
  
  if (stillMissing.length > 0) {
    const { data: liveData } = await supabase
      .from('live_prices')
      .select('ticker, price, change24h')
      .in('ticker', stillMissing);
    
    if (liveData) {
      for (const l of liveData) {
        results.push({
          symbol: l.ticker,
          price: l.price,
          change24h: l.change24h || 0,
          source: 'live_prices',
        });
      }
    }
  }
  
  return results;
}

async function fetchSocial(supabase: any, symbols: string[], signal: AbortSignal): Promise<SocialData[]> {
  if (signal.aborted) return [];
  
  const { data } = await supabase
    .from('crypto_snapshot')
    .select('symbol, galaxy_score, alt_rank, sentiment, social_volume_24h')
    .in('symbol', symbols);
  
  if (!data) return [];
  
  return data.map((d: any) => ({
    symbol: d.symbol,
    galaxyScore: d.galaxy_score,
    altRank: d.alt_rank,
    sentiment: d.sentiment,
    socialVolume: d.social_volume_24h,
  }));
}

// FIX #8: Direct CoinGlass fetch instead of calling edge function
async function fetchDerivativesDirect(symbols: string[], signal: AbortSignal): Promise<DerivsData[]> {
  const coinglassKey = Deno.env.get('COINGLASS_API_KEY');
  if (!coinglassKey || signal.aborted) return [];
  
  const results: DerivsData[] = [];
  
  for (const symbol of symbols.slice(0, 3)) { // Limit to 3 to avoid rate limits
    if (signal.aborted) break;
    
    try {
      const response = await fetch(
        `https://open-api.coinglass.com/public/v2/funding?symbol=${symbol}&time_type=h8`,
        {
          headers: { 'coinglassSecret': coinglassKey },
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
            liquidations24h: { long: 0, short: 0, total: 0 }, // Would need separate call
          });
        }
      }
    } catch (e) {
      if (e instanceof Error && e.name !== 'AbortError') {
        console.error(`[Tool] Derivs error for ${symbol}:`, e);
      }
    }
  }
  
  return results;
}

// FIX #7: Security check with multi-chain support
async function fetchSecurity(address: string, chain: string, signal: AbortSignal): Promise<SecurityData> {
  const result: SecurityData = {
    riskLevel: 'Unknown',
    flags: [],
    chain,
  };
  
  if (signal.aborted) return result;
  
  // Determine which chain IDs to try
  let chainIds: string[] = [];
  
  if (chain !== 'unknown' && GOPLUS_CHAINS[chain]) {
    chainIds = [GOPLUS_CHAINS[chain]];
  } else if (address.startsWith('0x')) {
    // Try top EVM chains in order of popularity
    chainIds = ['1', '56', '8453', '42161', '137']; // ETH, BSC, Base, Arbitrum, Polygon
  } else {
    // Likely Solana
    chainIds = ['solana'];
  }
  
  // GoPlus Security API (try chains until we get a hit)
  for (const chainId of chainIds) {
    if (signal.aborted) break;
    
    try {
      const goplusUrl = chainId === 'solana'
        ? `https://api.gopluslabs.io/api/v1/solana/token_security?contract_addresses=${address}`
        : `https://api.gopluslabs.io/api/v1/token_security/${chainId}?contract_addresses=${address}`;
      
      const response = await fetch(goplusUrl, { signal });
      if (!response.ok) continue;
      
      const data = await response.json();
      const tokenData = data.result?.[address.toLowerCase()] || data.result?.[address];
      
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
        
        // Calculate risk level
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
        
        break; // Found data, stop trying other chains
      }
    } catch (e) {
      if (e instanceof Error && e.name !== 'AbortError') {
        console.error(`[Tool] GoPlus error for chain ${chainId}:`, e);
      }
    }
  }
  
  // DexScreener for liquidity
  if (!signal.aborted) {
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
        }
      }
    } catch (e) {
      if (e instanceof Error && e.name !== 'AbortError') {
        console.error('[Tool] DexScreener error:', e);
      }
    }
  }
  
  return result;
}

async function fetchNews(symbol: string, signal: AbortSignal): Promise<NewsItem[]> {
  const tavilyKey = Deno.env.get('TAVILY_API_KEY');
  if (!tavilyKey || signal.aborted) return [];
  
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
    
    if (!response.ok) return [];
    
    const data = await response.json();
    return (data.results || []).map((r: any) => ({
      title: r.title,
      source: r.source || 'Unknown',
      date: r.published_date || new Date().toISOString(),
      summary: r.content?.slice(0, 200),
    }));
  } catch (e) {
    if (e instanceof Error && e.name !== 'AbortError') {
      console.error('[Tool] Tavily error:', e);
    }
    return [];
  }
}

async function fetchCharts(supabase: any, symbol: string, signal: AbortSignal): Promise<ChartData | null> {
  if (signal.aborted) return null;
  
  const { data } = await supabase
    .from('technical_indicators')
    .select('indicator_type, value')
    .eq('ticker', symbol)
    .gt('expires_at', new Date().toISOString());
  
  if (!data || data.length === 0) return null;
  
  const result: ChartData = {};
  for (const d of data) {
    if (d.indicator_type === 'rsi') result.rsi = d.value?.rsi;
    if (d.indicator_type === 'macd') result.macd = d.value;
    if (d.indicator_type === 'sma') {
      result.sma20 = d.value?.sma20;
      result.sma50 = d.value?.sma50;
    }
  }
  
  return result;
}
