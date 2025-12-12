// Tool Orchestrator: Execute tools in parallel with timeouts and fallbacks

import { RouteConfig } from "./router.ts";
import { ResolvedAsset } from "./resolver.ts";

const TOOL_TIMEOUT_MS = 5000;

export interface ToolResults {
  prices?: PriceData[];
  social?: SocialData[];
  derivs?: DerivsData[];
  security?: SecurityData;
  news?: NewsItem[];
  charts?: ChartData;
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

// Timeout wrapper
async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), ms));
  return Promise.race([promise, timeout]);
}

export async function executeTools(
  supabase: any,
  config: RouteConfig,
  assets: ResolvedAsset[]
): Promise<ToolResults> {
  const results: ToolResults = {};
  const symbols = assets.map(a => a.symbol);
  
  if (symbols.length === 0) {
    // For market overview, use top cryptos
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
      withTimeout(fetchPrices(supabase, symbols), TOOL_TIMEOUT_MS)
        .then(data => { if (data) results.prices = data; })
        .catch(e => console.error('[Tool] Prices error:', e))
    );
  }
  
  // Social data
  if (config.fetchSocial) {
    tasks.push(
      withTimeout(fetchSocial(supabase, symbols), TOOL_TIMEOUT_MS)
        .then(data => { if (data) results.social = data; })
        .catch(e => console.error('[Tool] Social error:', e))
    );
  }
  
  // Derivatives
  if (config.fetchDerivs) {
    tasks.push(
      withTimeout(fetchDerivatives(supabase, symbols), TOOL_TIMEOUT_MS)
        .then(data => { if (data) results.derivs = data; })
        .catch(e => console.error('[Tool] Derivs error:', e))
    );
  }
  
  // Security check
  if (config.fetchSecurity && assets[0]?.address) {
    tasks.push(
      withTimeout(fetchSecurity(assets[0].address), TOOL_TIMEOUT_MS)
        .then(data => { if (data) results.security = data; })
        .catch(e => console.error('[Tool] Security error:', e))
    );
  }
  
  // News
  if (config.fetchNews) {
    tasks.push(
      withTimeout(fetchNews(symbols[0]), TOOL_TIMEOUT_MS)
        .then(data => { if (data) results.news = data; })
        .catch(e => console.error('[Tool] News error:', e))
    );
  }
  
  // Charts/technical
  if (config.fetchCharts) {
    tasks.push(
      withTimeout(fetchCharts(supabase, symbols[0]), TOOL_TIMEOUT_MS)
        .then(data => { if (data) results.charts = data; })
        .catch(e => console.error('[Tool] Charts error:', e))
    );
  }
  
  await Promise.allSettled(tasks);
  return results;
}

// --- TOOL IMPLEMENTATIONS ---

async function fetchPrices(supabase: any, symbols: string[]): Promise<PriceData[]> {
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

async function fetchSocial(supabase: any, symbols: string[]): Promise<SocialData[]> {
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

async function fetchDerivatives(supabase: any, symbols: string[]): Promise<DerivsData[]> {
  // Call the existing derivs edge function
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  
  try {
    const response = await fetch(
      `${supabaseUrl}/functions/v1/derivs?symbols=${symbols.join(',')}`,
      {
        headers: {
          'Authorization': `Bearer ${serviceKey}`,
          'Content-Type': 'application/json',
        },
      }
    );
    
    if (!response.ok) return [];
    
    const data = await response.json();
    return data.derivatives || [];
  } catch (e) {
    console.error('[Tool] Derivs fetch error:', e);
    return [];
  }
}

async function fetchSecurity(address: string): Promise<SecurityData> {
  const result: SecurityData = {
    riskLevel: 'Unknown',
    flags: [],
  };
  
  // GoPlus Security API (free, no key needed)
  try {
    const chain = address.startsWith('0x') ? '1' : '0'; // 1 for ETH, 0 for unknown
    const goplusUrl = `https://api.gopluslabs.io/api/v1/token_security/${chain}?contract_addresses=${address}`;
    
    const response = await fetch(goplusUrl);
    if (response.ok) {
      const data = await response.json();
      const tokenData = data.result?.[address.toLowerCase()];
      
      if (tokenData) {
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
      }
    }
  } catch (e) {
    console.error('[Tool] GoPlus error:', e);
  }
  
  // DexScreener for liquidity
  try {
    const dexUrl = `https://api.dexscreener.com/latest/dex/tokens/${address}`;
    const response = await fetch(dexUrl);
    
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
    console.error('[Tool] DexScreener error:', e);
  }
  
  return result;
}

async function fetchNews(symbol: string): Promise<NewsItem[]> {
  const tavilyKey = Deno.env.get('TAVILY_API_KEY');
  if (!tavilyKey) return [];
  
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
    console.error('[Tool] Tavily error:', e);
    return [];
  }
}

async function fetchCharts(supabase: any, symbol: string): Promise<ChartData | null> {
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
