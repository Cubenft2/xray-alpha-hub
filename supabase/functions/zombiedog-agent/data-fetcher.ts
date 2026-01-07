// Data Fetcher: Fetch RICH data based on ParsedIntent
// Leverages all available data from Polygon, LunarCrush, and CoinGecko

import { ParsedIntent } from './intent-parser.ts';

// Sector token definitions - comprehensive coverage
export const SECTOR_TOKENS: Record<string, string[]> = {
  ai: ['LINK', 'TAO', 'NEAR', 'RENDER', 'FET', 'INJ', 'VIRTUAL', 'GRT', 'THETA', 'TRAC', 'AGIX', 'OCEAN', 'AKT', 'ATH', 'AIOZ', 'CGPT'],
  defi: ['AAVE', 'UNI', 'MKR', 'CRV', 'SNX', 'COMP', 'SUSHI', 'YFI', 'CAKE', 'JOE', 'LDO', 'PENDLE', 'KNC', 'HFT'],
  meme: ['DOGE', 'SHIB', 'PEPE', 'FLOKI', 'BONK', 'WIF', 'BRETT', 'MOG', 'TURBO', 'POPCAT', 'ELON'],
  gaming: ['AXS', 'SAND', 'MANA', 'IMX', 'GALA', 'ENJ', 'MAGIC', 'PRIME', 'BEAM', 'RONIN'],
  l1: ['BTC', 'ETH', 'SOL', 'AVAX', 'ADA', 'DOT', 'NEAR', 'ATOM', 'SUI', 'APT', 'SEI', 'TON', 'INJ', 'CRO'],
  l2: ['ARB', 'OP', 'MATIC', 'IMX', 'MNT', 'METIS', 'ZK', 'STRK', 'BLAST', 'AXL'],
  nft: ['APE', 'BLUR', 'LOOKS', 'X2Y2', 'RARI', 'SUPER'],
  // NEW: Privacy coins - always relevant for crypto natives
  privacy: ['XMR', 'ZEC', 'DASH', 'DCR', 'ZEN', 'XVG', 'BEAM', 'ZANO', 'BDX', 'MWC', 'ALEO', 'SCRT', 'ROSE', 'NIGHT'],
  // NEW: Storage/infrastructure 
  storage: ['FIL', 'AR', 'SC', 'STORJ', 'BTT', 'AIOZ'],
  // NEW: RWA - Real World Assets
  rwa: ['ONDO', 'PENDLE', 'MKR', 'AXL', 'LINK', 'SNX'],
  // NEW: Bitcoin ecosystem
  btc_eco: ['BTC', 'STX', 'RUNE', 'ORDI', 'SATS', 'TRAC'],
};

// Rich token data interface matching token_cards schema
export interface RichToken {
  // Identity
  canonical_symbol: string;
  name: string;
  market_cap_rank: number | null;
  description?: string | null;
  
  // Price data (Polygon)
  price_usd: number | null;
  change_24h_pct: number | null;
  change_7d_pct: number | null;
  high_24h: number | null;
  low_24h: number | null;
  volume_24h_usd: number | null;
  vwap_24h: number | null;
  market_cap: number | null;
  
  // Technicals (Polygon)
  rsi_14: number | null;
  rsi_signal: string | null;
  macd_line: number | null;
  macd_signal: number | null;
  macd_histogram: number | null;
  macd_trend: string | null;
  sma_20: number | null;
  sma_50: number | null;
  sma_200: number | null;
  ema_12: number | null;
  ema_26: number | null;
  price_vs_sma_50: string | null;
  price_vs_sma_200: string | null;
  technical_signal: string | null;
  
  // Social (LunarCrush)
  galaxy_score: number | null;
  alt_rank: number | null;
  sentiment: number | null;
  sentiment_label: string | null;
  social_volume_24h: number | null;
  social_dominance: number | null;
  interactions_24h: number | null;
  
  // AI & Content (LunarCrush)
  ai_summary: string | null;
  ai_summary_short: string | null;
  key_themes: string[] | null;
  top_posts: any[] | null;
  top_news: any[] | null;
  
  // Social enrichment (for deep analysis)
  top_creators?: any[] | null;
  top_creators_count?: number | null;
  
  // Market data (CoinGecko)
  circulating_supply: number | null;
  total_supply?: number | null;
  max_supply?: number | null;
  fully_diluted_valuation?: number | null;
  ath_price: number | null;
  ath_date: string | null;
  ath_change_pct: number | null;
  atl_price?: number | null;
  atl_date?: string | null;
  
  // Derivatives data (CoinGlass - for major tokens)
  funding_rate?: number | null;
  open_interest?: number | null;
  liquidations_24h?: { long: number; short: number; total: number } | null;
  
  // Premium LunarCrush AI (for top 25 tokens)
  premium_headline?: string | null;
  premium_about?: string | null;
  premium_insights?: any[] | null;
  premium_price_analysis?: string | null;
  premium_supportive_themes?: any[] | null;
  premium_critical_themes?: any[] | null;
  premium_sentiment_pct?: number | null;
}

// Rich stock data interface matching stock_cards schema
export interface RichStock {
  symbol: string;
  name: string | null;
  price_usd: number | null;
  change_pct: number | null;
  market_cap: number | null;
  volume: number | null;
  sector: string | null;
  industry: string | null;
  pe_ratio: number | null;
  dividend_yield: number | null;
  eps: number | null;
  rsi_14: number | null;
  macd_line: number | null;
  macd_signal: number | null;
  sma_20: number | null;
  sma_50: number | null;
  sma_200: number | null;
  technical_signal: string | null;
  high_52w: number | null;
  low_52w: number | null;
  employees: number | null;
  website: string | null;
  description: string | null;
  exchange: string | null;
}

export interface RichForex {
  pair: string;
  display_name: string | null;
  base_currency: string;
  quote_currency: string;
  rate: number | null;
  change_24h_pct: number | null;
  high_24h: number | null;
  low_24h: number | null;
  open_24h: number | null;
  rsi_14: number | null;
  sma_20: number | null;
  sma_50: number | null;
  sma_200: number | null;
  technical_signal: string | null;
  price_updated_at: string | null;
  updated_at: string | null;
}

export interface FetchedData {
  type: string;
  tokens: RichToken[];
  stocks?: RichStock[];
  forex?: RichForex[];
  gainers?: RichToken[];
  losers?: RichToken[];
  stockGainers?: RichStock[];
  stockLosers?: RichStock[];
  marketSummary?: {
    total: number;
    greenCount: number;
    redCount: number;
    breadthPct: number;
    leaders: { symbol: string; change: number; galaxy: number | null }[];
    laggards: { symbol: string; change: number; galaxy: number | null }[];
    avgGalaxyScore?: number;
    avgSentiment?: number;
    avgRsi?: number;
  };
  error?: string;
}

const MIN_MARKET_CAP = 5000000; // $5M minimum

// Full select for rich token data - comprehensive for deep analysis
const RICH_TOKEN_SELECT = `
  canonical_symbol,
  name,
  market_cap_rank,
  description,
  price_usd,
  change_24h_pct,
  change_7d_pct,
  high_24h,
  low_24h,
  volume_24h_usd,
  vwap_24h,
  market_cap,
  rsi_14,
  rsi_signal,
  macd_line,
  macd_signal,
  macd_histogram,
  macd_trend,
  sma_20,
  sma_50,
  sma_200,
  ema_12,
  ema_26,
  price_vs_sma_50,
  price_vs_sma_200,
  technical_signal,
  galaxy_score,
  alt_rank,
  sentiment,
  sentiment_label,
  social_volume_24h,
  social_dominance,
  interactions_24h,
  ai_summary,
  ai_summary_short,
  key_themes,
  top_posts,
  top_news,
  top_creators,
  top_creators_count,
  circulating_supply,
  total_supply,
  max_supply,
  fully_diluted_valuation,
  ath_price,
  ath_date,
  ath_change_pct,
  atl_price,
  atl_date
`;

// Stock select for rich stock data
const RICH_STOCK_SELECT = `
  symbol,
  name,
  price_usd,
  change_pct,
  market_cap,
  volume,
  sector,
  industry,
  pe_ratio,
  dividend_yield,
  eps,
  rsi_14,
  macd_line,
  macd_signal,
  sma_20,
  sma_50,
  sma_200,
  technical_signal,
  high_52w,
  low_52w,
  employees,
  website,
  description,
  exchange
`;

// Stock sector mapping
const STOCK_SECTOR_KEYWORDS: Record<string, string[]> = {
  tech: ['SOFTWARE', 'COMPUTER', 'ELECTRONIC', 'SEMICONDUCTOR', 'PROGRAMMING', 'DATA PROCESSING'],
  healthcare: ['PHARMACEUTICAL', 'BIOLOGICAL', 'MEDICAL', 'HEALTH', 'DRUG', 'HOSPITAL', 'SURGICAL'],
  finance: ['BANK', 'INSURANCE', 'FINANCE', 'INVESTMENT', 'SECURITY', 'LOAN', 'CREDIT'],
  energy: ['OIL', 'GAS', 'PETROLEUM', 'MINING', 'COAL', 'CRUDE'],
  retail: ['RETAIL', 'STORE', 'CATALOG', 'DEPARTMENT', 'VARIETY'],
  auto: ['MOTOR', 'AUTO', 'VEHICLE', 'CAR'],
  aerospace: ['AEROSPACE', 'AIRCRAFT', 'MISSILE', 'GUIDED'],
  utilities: ['ELECTRIC', 'UTILITY', 'WATER', 'SANITARY'],
  communications: ['TELEPHONE', 'COMMUNICATION', 'RADIO', 'TELEVISION', 'BROADCASTING'],
};

// Top stocks by sector for sector queries
const TOP_STOCKS_BY_SECTOR: Record<string, string[]> = {
  tech: ['NVDA', 'AAPL', 'MSFT', 'GOOG', 'META', 'AMD', 'INTC', 'CRM', 'ORCL', 'ADBE'],
  healthcare: ['LLY', 'UNH', 'JNJ', 'PFE', 'ABBV', 'MRK', 'TMO', 'ABT', 'DHR', 'BMY'],
  finance: ['JPM', 'BAC', 'GS', 'MS', 'WFC', 'C', 'BLK', 'SCHW', 'V', 'MA'],
  energy: ['XOM', 'CVX', 'COP', 'SLB', 'EOG', 'MPC', 'PSX', 'VLO', 'OXY', 'HAL'],
  retail: ['AMZN', 'WMT', 'COST', 'TGT', 'HD', 'LOW', 'TJX', 'ROST', 'DG', 'DLTR'],
  auto: ['TSLA', 'F', 'GM', 'RIVN', 'TM', 'HMC', 'STLA', 'NIO', 'LCID', 'XPEV'],
  aerospace: ['BA', 'LMT', 'RTX', 'NOC', 'GD', 'GE', 'HWM', 'TDG', 'HII', 'LHX'],
  utilities: ['NEE', 'DUK', 'SO', 'D', 'AEP', 'EXC', 'SRE', 'XEL', 'PEG', 'ED'],
  communications: ['VZ', 'T', 'CMCSA', 'DIS', 'NFLX', 'TMUS', 'CHTR', 'WBD', 'PARA', 'FOX'],
};

// Default major indices and mega-cap stocks for stock market overview
const STOCK_MARKET_OVERVIEW_SYMBOLS = ['SPY', 'QQQ', 'DIA', 'AAPL', 'MSFT', 'NVDA', 'GOOGL', 'AMZN', 'TSLA', 'META'];

export async function fetchDataForIntent(supabase: any, intent: ParsedIntent): Promise<FetchedData> {
  console.log(`[data-fetcher] Fetching data for intent: ${intent.intent}, assetType: ${intent.assetType}, sector: ${intent.sector}, stockSector: ${intent.stockSector}, tickers: [${intent.tickers.join(',')}]`);
  
  try {
    // Handle stock market overview FIRST (before general stock routing)
    if (intent.intent === 'stock_market_overview') {
      return await fetchStockMarketOverview(supabase, intent.tickers);
    }
    
    // Handle market_overview with stock assetType
    if (intent.intent === 'market_overview' && intent.assetType === 'stock') {
      return await fetchStockMarketOverview(supabase, intent.tickers);
    }
    
    // Route based on asset type and intent
    if (intent.assetType === 'stock' || intent.intent === 'stock_lookup') {
      return await fetchStockData(supabase, intent);
    }
    
    // Handle forex/precious metals
    if (intent.assetType === 'forex') {
      return await fetchForexData(supabase, intent.tickers);
    }
    
    switch (intent.intent) {
      case 'market_overview':
        return await fetchMarketOverview(supabase);
        
      case 'sector_analysis':
        return await fetchSectorData(supabase, intent.sector, intent.action);
        
      case 'token_lookup':
        return await fetchTokens(supabase, intent.tickers);
        
      case 'comparison':
        // Check if comparing stocks or crypto
        if (intent.assetType === 'stock') {
          return await fetchStockData(supabase, intent);
        }
        return await fetchTokens(supabase, intent.tickers);
        
      case 'trending':
        return await fetchTrending(supabase, intent.action);
        
      case 'news':
        return await fetchNewsData(supabase, intent.tickers);
        
      case 'general_chat':
        return { type: 'general_chat', tokens: [] };
        
      default:
        return await fetchMarketOverview(supabase);
    }
  } catch (err) {
    console.error(`[data-fetcher] Error: ${err}`);
    return { type: 'error', tokens: [], error: String(err) };
  }
}

// ============= STOCK MARKET OVERVIEW =============
async function fetchStockMarketOverview(supabase: any, tickers: string[]): Promise<FetchedData> {
  // Use provided tickers or default to major indices + mega-caps
  const symbolsToFetch = tickers.length > 0 ? tickers : STOCK_MARKET_OVERVIEW_SYMBOLS;
  
  console.log(`[data-fetcher] Stock market overview - fetching: [${symbolsToFetch.join(',')}]`);
  
  const { data: stocks, error } = await supabase
    .from('stock_cards')
    .select(RICH_STOCK_SELECT)
    .in('symbol', symbolsToFetch)
    .eq('is_active', true)
    .not('price_usd', 'is', null)
    .order('market_cap', { ascending: false, nullsFirst: false });

  if (error) {
    console.error(`[data-fetcher] Stock market overview error: ${error.message}`);
    return { type: 'stock_market_overview', tokens: [], stocks: [], error: error.message };
  }

  const stockList = stocks || [];
  
  // Also get top gainers and losers ($1B+ market cap)
  const { data: gainers } = await supabase
    .from('stock_cards')
    .select(RICH_STOCK_SELECT)
    .eq('is_active', true)
    .not('change_pct', 'is', null)
    .gt('market_cap', 1000000000)
    .order('change_pct', { ascending: false })
    .limit(5);

  const { data: losers } = await supabase
    .from('stock_cards')
    .select(RICH_STOCK_SELECT)
    .eq('is_active', true)
    .not('change_pct', 'is', null)
    .gt('market_cap', 1000000000)
    .order('change_pct', { ascending: true })
    .limit(5);

  // Compute market summary
  const greenCount = stockList.filter((s: any) => (s.change_pct || 0) > 0).length;
  const redCount = stockList.filter((s: any) => (s.change_pct || 0) < 0).length;
  const sorted = [...stockList].sort((a: any, b: any) => (b.change_pct || 0) - (a.change_pct || 0));

  console.log(`[data-fetcher] Stock market overview: ${stockList.length} stocks, ${greenCount} green, ${redCount} red`);

  return {
    type: 'stock_market_overview',
    tokens: [],
    stocks: stockList,
    stockGainers: gainers || [],
    stockLosers: losers || [],
    marketSummary: {
      total: stockList.length,
      greenCount,
      redCount,
      breadthPct: stockList.length > 0 ? Math.round((greenCount / stockList.length) * 100) : 0,
      leaders: sorted.slice(0, 3).map((s: any) => ({ 
        symbol: s.symbol, 
        change: s.change_pct || 0,
        galaxy: null
      })),
      laggards: sorted.slice(-3).reverse().map((s: any) => ({ 
        symbol: s.symbol, 
        change: s.change_pct || 0,
        galaxy: null
      })),
    }
  };
}

async function fetchMarketOverview(supabase: any): Promise<FetchedData> {
  // Get top 10 by market cap with FULL rich data
  const { data: topCoins, error: topError } = await supabase
    .from('token_cards')
    .select(RICH_TOKEN_SELECT)
    .gt('market_cap_rank', 0)
    .lte('market_cap_rank', 10)
    .order('market_cap_rank', { ascending: true })
    .limit(10);

  if (topError) {
    console.error(`[data-fetcher] Market overview error: ${topError.message}`);
    return { type: 'market_overview', tokens: [], error: topError.message };
  }

  // Get top 5 gainers (min $5M market cap)
  const { data: gainers } = await supabase
    .from('token_cards')
    .select(RICH_TOKEN_SELECT)
    .gt('market_cap', MIN_MARKET_CAP)
    .not('change_24h_pct', 'is', null)
    .order('change_24h_pct', { ascending: false })
    .limit(5);

  // Get top 5 losers (min $5M market cap)
  const { data: losers } = await supabase
    .from('token_cards')
    .select(RICH_TOKEN_SELECT)
    .gt('market_cap', MIN_MARKET_CAP)
    .not('change_24h_pct', 'is', null)
    .order('change_24h_pct', { ascending: true })
    .limit(5);

  const tokens = topCoins || [];
  
  // Compute market summary
  const greenCount = tokens.filter((t: any) => (t.change_24h_pct || 0) > 0).length;
  const redCount = tokens.filter((t: any) => (t.change_24h_pct || 0) < 0).length;
  const sorted = [...tokens].sort((a: any, b: any) => (b.change_24h_pct || 0) - (a.change_24h_pct || 0));
  
  const tokensWithGalaxy = tokens.filter((t: any) => t.galaxy_score);
  const avgGalaxyScore = tokensWithGalaxy.length > 0
    ? Math.round(tokensWithGalaxy.reduce((sum: number, t: any) => sum + t.galaxy_score, 0) / tokensWithGalaxy.length)
    : undefined;

  const tokensWithSentiment = tokens.filter((t: any) => t.sentiment);
  const avgSentiment = tokensWithSentiment.length > 0
    ? Math.round(tokensWithSentiment.reduce((sum: number, t: any) => sum + t.sentiment, 0) / tokensWithSentiment.length)
    : undefined;

  const tokensWithRsi = tokens.filter((t: any) => t.rsi_14);
  const avgRsi = tokensWithRsi.length > 0
    ? Math.round(tokensWithRsi.reduce((sum: number, t: any) => sum + t.rsi_14, 0) / tokensWithRsi.length)
    : undefined;

  return {
    type: 'market_overview',
    tokens,
    gainers: gainers || [],
    losers: losers || [],
    marketSummary: {
      total: tokens.length,
      greenCount,
      redCount,
      breadthPct: tokens.length > 0 ? Math.round((greenCount / tokens.length) * 100) : 0,
      leaders: sorted.slice(0, 3).map((t: any) => ({ 
        symbol: t.canonical_symbol, 
        change: t.change_24h_pct || 0,
        galaxy: t.galaxy_score
      })),
      laggards: sorted.slice(-3).reverse().map((t: any) => ({ 
        symbol: t.canonical_symbol, 
        change: t.change_24h_pct || 0,
        galaxy: t.galaxy_score
      })),
      avgGalaxyScore,
      avgSentiment,
      avgRsi,
    }
  };
}

async function fetchSectorData(supabase: any, sector: string | null, action: string | null): Promise<FetchedData> {
  // Get sector tokens list
  const sectorTokens = sector && SECTOR_TOKENS[sector] ? SECTOR_TOKENS[sector] : SECTOR_TOKENS.l1;
  
  let query = supabase
    .from('token_cards')
    .select(RICH_TOKEN_SELECT)
    .in('canonical_symbol', sectorTokens)
    .gt('market_cap', MIN_MARKET_CAP);

  // Sort based on action
  if (action === 'gainers') {
    query = query.order('change_24h_pct', { ascending: false });
  } else if (action === 'losers') {
    query = query.order('change_24h_pct', { ascending: true });
  } else if (action === 'volume') {
    query = query.order('volume_24h_usd', { ascending: false });
  } else {
    query = query.order('market_cap', { ascending: false });
  }

  const { data, error } = await query.limit(15);
  
  if (error) {
    console.error(`[data-fetcher] Sector query error: ${error.message}`);
    return { type: 'sector_analysis', tokens: [], error: error.message };
  }

  const tokens = data || [];
  
  // Compute sector summary
  const greenCount = tokens.filter((t: any) => (t.change_24h_pct || 0) > 0).length;
  const redCount = tokens.filter((t: any) => (t.change_24h_pct || 0) < 0).length;
  const sorted = [...tokens].sort((a: any, b: any) => (b.change_24h_pct || 0) - (a.change_24h_pct || 0));

  const tokensWithGalaxy = tokens.filter((t: any) => t.galaxy_score);
  const avgGalaxyScore = tokensWithGalaxy.length > 0
    ? Math.round(tokensWithGalaxy.reduce((sum: number, t: any) => sum + t.galaxy_score, 0) / tokensWithGalaxy.length)
    : undefined;

  return {
    type: 'sector_analysis',
    tokens,
    marketSummary: {
      total: tokens.length,
      greenCount,
      redCount,
      breadthPct: tokens.length > 0 ? Math.round((greenCount / tokens.length) * 100) : 0,
      leaders: sorted.slice(0, 3).map((t: any) => ({ 
        symbol: t.canonical_symbol, 
        change: t.change_24h_pct || 0,
        galaxy: t.galaxy_score
      })),
      laggards: sorted.slice(-3).reverse().map((t: any) => ({ 
        symbol: t.canonical_symbol, 
        change: t.change_24h_pct || 0,
        galaxy: t.galaxy_score
      })),
      avgGalaxyScore,
    }
  };
}

async function fetchTokens(supabase: any, tickers: string[]): Promise<FetchedData> {
  if (tickers.length === 0) {
    return { type: 'token_lookup', tokens: [] };
  }

  const { data, error } = await supabase
    .from('token_cards')
    .select(RICH_TOKEN_SELECT)
    .in('canonical_symbol', tickers);

  if (error) {
    console.error(`[data-fetcher] Token lookup error: ${error.message}`);
    return { type: 'token_lookup', tokens: [], error: error.message };
  }

  const tokens = data || [];
  
  // Enrich with premium LunarCrush AI summaries if available (top 25)
  if (tokens.length > 0) {
    const { data: premiumAI } = await supabase
      .from('lunarcrush_ai_summaries')
      .select('canonical_symbol, headline, insights, price_analysis, supportive_themes, critical_themes, sentiment_pct, about, top_creators, top_news, top_posts')
      .in('canonical_symbol', tickers);
    
    if (premiumAI && premiumAI.length > 0) {
      console.log(`[data-fetcher] Found ${premiumAI.length} premium AI summaries`);
      const premiumMap = new Map(premiumAI.map((p: any) => [p.canonical_symbol, p]));
      
      for (const token of tokens) {
        const premium = premiumMap.get(token.canonical_symbol);
        if (premium) {
          // Enhance with premium data (headline is separate from regular ai_summary)
          (token as any).premium_headline = premium.headline;
          (token as any).premium_about = premium.about;
          (token as any).premium_insights = premium.insights;
          (token as any).premium_price_analysis = premium.price_analysis;
          (token as any).premium_supportive_themes = premium.supportive_themes;
          (token as any).premium_critical_themes = premium.critical_themes;
          (token as any).premium_sentiment_pct = premium.sentiment_pct;
          // Premium creators/posts if available
          if (premium.top_creators) (token as any).top_creators = premium.top_creators;
        }
      }
    }
    
    // Fetch derivatives data for major tokens
    const majorDerivTokens = ['BTC', 'ETH', 'SOL', 'XRP', 'DOGE', 'ADA', 'AVAX', 'DOT', 'LINK', 'MATIC', 'ZEC', 'LTC', 'XMR', 'ETC', 'ATOM', 'APT', 'NEAR', 'ARB', 'OP', 'SUI'];
    const derivSymbols = tickers.filter(t => majorDerivTokens.includes(t.toUpperCase()));
    
    if (derivSymbols.length > 0) {
      try {
        // Fetch from derivatives_cache table first (if populated by sync job)
        const { data: derivsCache } = await supabase
          .from('derivatives_cache')
          .select('symbol, funding_rate, open_interest, liquidations_24h')
          .in('symbol', derivSymbols);
        
        if (derivsCache && derivsCache.length > 0) {
          console.log(`[data-fetcher] Found ${derivsCache.length} derivatives from cache`);
          const derivsMap = new Map(derivsCache.map((d: any) => [d.symbol, d]));
          
          for (const token of tokens) {
            const deriv = derivsMap.get(token.canonical_symbol);
            if (deriv) {
              (token as any).funding_rate = deriv.funding_rate;
              (token as any).open_interest = deriv.open_interest;
              (token as any).liquidations_24h = deriv.liquidations_24h;
            }
          }
        }
      } catch (derivErr) {
        console.warn(`[data-fetcher] Derivatives fetch failed:`, derivErr);
        // Continue without derivatives - don't fail the whole request
      }
    }
  }

  return {
    type: 'token_lookup',
    tokens,
  };
}

async function fetchTrending(supabase: any, action: string | null): Promise<FetchedData> {
  let query = supabase
    .from('token_cards')
    .select(RICH_TOKEN_SELECT)
    .gt('market_cap', MIN_MARKET_CAP);

  if (action === 'gainers') {
    query = query.not('change_24h_pct', 'is', null).order('change_24h_pct', { ascending: false });
  } else if (action === 'losers') {
    query = query.not('change_24h_pct', 'is', null).order('change_24h_pct', { ascending: true });
  } else if (action === 'volume') {
    query = query.order('volume_24h_usd', { ascending: false });
  } else {
    // Default: by galaxy score (social trending)
    query = query.not('galaxy_score', 'is', null).order('galaxy_score', { ascending: false });
  }

  const { data, error } = await query.limit(10);

  if (error) {
    console.error(`[data-fetcher] Trending query error: ${error.message}`);
    return { type: 'trending', tokens: [], error: error.message };
  }

  return {
    type: 'trending',
    tokens: data || [],
  };
}

async function fetchNewsData(supabase: any, tickers: string[]): Promise<FetchedData> {
  const tickersToFetch = tickers.length > 0 ? tickers : ['BTC', 'ETH'];
  
  const { data, error } = await supabase
    .from('token_cards')
    .select(RICH_TOKEN_SELECT)
    .in('canonical_symbol', tickersToFetch);

  if (error) {
    console.error(`[data-fetcher] News query error: ${error.message}`);
    return { type: 'news', tokens: [], error: error.message };
  }

  return {
    type: 'news',
    tokens: data || [],
  };
}

// ============= STOCK FETCHING FUNCTIONS =============

async function fetchStockData(supabase: any, intent: ParsedIntent): Promise<FetchedData> {
  console.log(`[data-fetcher] Fetching stock data - stockSector: ${intent.stockSector}, tickers: [${intent.tickers.join(',')}]`);
  
  // If specific tickers requested, fetch those
  if (intent.tickers.length > 0) {
    return await fetchStocksBySymbols(supabase, intent.tickers);
  }
  
  // If stock sector requested, fetch top stocks in that sector
  if (intent.stockSector) {
    return await fetchStocksBySector(supabase, intent.stockSector, intent.action);
  }
  
  // Default: fetch top stocks by market cap
  return await fetchTopStocks(supabase, intent.action);
}

async function fetchStocksBySymbols(supabase: any, symbols: string[]): Promise<FetchedData> {
  const { data, error } = await supabase
    .from('stock_cards')
    .select(RICH_STOCK_SELECT)
    .in('symbol', symbols)
    .eq('is_active', true);

  if (error) {
    console.error(`[data-fetcher] Stock lookup error: ${error.message}`);
    return { type: 'stock_lookup', tokens: [], stocks: [], error: error.message };
  }

  const stocks = data || [];
  console.log(`[data-fetcher] Found ${stocks.length} stocks for symbols: [${symbols.join(',')}]`);

  return {
    type: 'stock_lookup',
    tokens: [],
    stocks,
  };
}

async function fetchStocksBySector(supabase: any, stockSector: string, action: string | null): Promise<FetchedData> {
  // Get top stocks for this sector
  const sectorStocks = TOP_STOCKS_BY_SECTOR[stockSector] || TOP_STOCKS_BY_SECTOR.tech;
  
  let query = supabase
    .from('stock_cards')
    .select(RICH_STOCK_SELECT)
    .in('symbol', sectorStocks)
    .eq('is_active', true)
    .not('price_usd', 'is', null);

  // Sort based on action
  if (action === 'gainers') {
    query = query.order('change_pct', { ascending: false });
  } else if (action === 'losers') {
    query = query.order('change_pct', { ascending: true });
  } else if (action === 'volume') {
    query = query.order('volume', { ascending: false });
  } else {
    query = query.order('market_cap', { ascending: false, nullsFirst: false });
  }

  const { data, error } = await query.limit(10);

  if (error) {
    console.error(`[data-fetcher] Stock sector query error: ${error.message}`);
    return { type: 'stock_lookup', tokens: [], stocks: [], error: error.message };
  }

  const stocks = data || [];
  const greenCount = stocks.filter((s: any) => (s.change_pct || 0) > 0).length;
  const redCount = stocks.filter((s: any) => (s.change_pct || 0) < 0).length;
  const sorted = [...stocks].sort((a: any, b: any) => (b.change_pct || 0) - (a.change_pct || 0));

  console.log(`[data-fetcher] Found ${stocks.length} stocks for sector: ${stockSector}`);

  return {
    type: 'stock_lookup',
    tokens: [],
    stocks,
    marketSummary: {
      total: stocks.length,
      greenCount,
      redCount,
      breadthPct: stocks.length > 0 ? Math.round((greenCount / stocks.length) * 100) : 0,
      leaders: sorted.slice(0, 3).map((s: any) => ({ 
        symbol: s.symbol, 
        change: s.change_pct || 0,
        galaxy: null
      })),
      laggards: sorted.slice(-3).reverse().map((s: any) => ({ 
        symbol: s.symbol, 
        change: s.change_pct || 0,
        galaxy: null
      })),
    }
  };
}

async function fetchTopStocks(supabase: any, action: string | null): Promise<FetchedData> {
  let query = supabase
    .from('stock_cards')
    .select(RICH_STOCK_SELECT)
    .eq('is_active', true)
    .not('price_usd', 'is', null)
    .gt('market_cap', 1000000000); // $1B+ market cap

  if (action === 'gainers') {
    query = query.not('change_pct', 'is', null).order('change_pct', { ascending: false });
  } else if (action === 'losers') {
    query = query.not('change_pct', 'is', null).order('change_pct', { ascending: true });
  } else if (action === 'volume') {
    query = query.order('volume', { ascending: false });
  } else {
    query = query.order('market_cap', { ascending: false, nullsFirst: false });
  }

  const { data, error } = await query.limit(10);

  if (error) {
    console.error(`[data-fetcher] Top stocks query error: ${error.message}`);
    return { type: 'stock_lookup', tokens: [], stocks: [], error: error.message };
  }

  const stocks = data || [];
  console.log(`[data-fetcher] Found ${stocks.length} top stocks`);

  return {
    type: 'stock_lookup',
    tokens: [],
    stocks,
  };
}

// ============= FOREX / PRECIOUS METALS FETCHER =============

// Default precious metals tickers - used when no specific tickers provided
const DEFAULT_METALS = ['XAUUSD', 'XAGUSD', 'XPTUSD', 'XPDUSD'];

// Major forex pairs - used when asking about "forex market" in general
const DEFAULT_MAJOR_FOREX = ['EURUSD', 'GBPUSD', 'USDJPY', 'USDCAD', 'AUDUSD', 'NZDUSD', 'USDCHF'];

const RICH_FOREX_SELECT = `
  pair,
  display_name,
  base_currency,
  quote_currency,
  rate,
  change_24h_pct,
  high_24h,
  low_24h,
  open_24h,
  rsi_14,
  sma_20,
  sma_50,
  sma_200,
  technical_signal,
  price_updated_at,
  updated_at
`;

async function fetchForexData(supabase: any, tickers: string[]): Promise<FetchedData> {
  console.log(`[data-fetcher] Fetching forex data for: [${tickers.join(',')}] (raw input)`);
  
  // If no tickers provided, default to major forex + precious metals
  const tickersToUse = tickers.length === 0 ? [...DEFAULT_MAJOR_FOREX, ...DEFAULT_METALS] : tickers;
  
  // Normalize tickers - handle formats like GOLD, XAU, EUR/USD, EURUSD, EURO, etc.
  const normalizedPairs = tickersToUse.map(t => {
    const upper = t.toUpperCase().replace(/[\s\-\/]+/g, ''); // Remove spaces, dashes, slashes
    
    // Handle common metal aliases
    if (upper === 'GOLD' || upper === 'XAU') return 'XAUUSD';
    if (upper === 'SILVER' || upper === 'XAG') return 'XAGUSD';
    if (upper === 'PLATINUM' || upper === 'XPT') return 'XPTUSD';
    if (upper === 'PALLADIUM' || upper === 'XPD') return 'XPDUSD';
    
    // Handle "PRECIOUSMETALS" or "METALS" keyword → return null to trigger default
    if (upper === 'PRECIOUSMETALS' || upper === 'METALS') return null;
    
    // Handle forex market keywords → return null to trigger default (all forex + metals)
    if (upper === 'FOREX' || upper === 'FOREXMARKET' || upper === 'MAJORS' || upper === 'CURRENCYPAIRS') return null;
    
    // Handle currency aliases (single currency → most common pair)
    if (upper === 'EURO' || upper === 'EUR') return 'EURUSD';
    if (upper === 'POUND' || upper === 'GBP' || upper === 'STERLING') return 'GBPUSD';
    if (upper === 'YEN' || upper === 'JPY') return 'USDJPY';
    if (upper === 'LOONIE' || upper === 'CAD') return 'USDCAD';
    if (upper === 'AUSSIE' || upper === 'AUD') return 'AUDUSD';
    if (upper === 'KIWI' || upper === 'NZD') return 'NZDUSD';
    if (upper === 'SWISSY' || upper === 'CHF') return 'USDCHF';
    if (upper === 'DOLLAR' || upper === 'USD') return 'EURUSD'; // Default dollar pair
    
    // Already a normalized pair format (e.g., EURUSD from EUR/USD)
    return upper;
  }).filter(Boolean) as string[];
  
  // If all tickers were keywords (like "FOREX" or "METALS"), use default (all forex + metals)
  const finalPairs = normalizedPairs.length === 0 ? [...DEFAULT_MAJOR_FOREX, ...DEFAULT_METALS] : normalizedPairs;
  
  console.log(`[data-fetcher] Normalized forex pairs: [${finalPairs.join(',')}]`);
  
  // Query forex_cards for the requested pairs
  const { data: forexData, error } = await supabase
    .from('forex_cards')
    .select(RICH_FOREX_SELECT)
    .in('pair', finalPairs);
  
  if (error) {
    console.error(`[data-fetcher] Forex query error: ${error.message}`);
    return { type: 'forex_lookup', tokens: [], forex: [], error: error.message };
  }
  
  const forex = forexData || [];
  console.log(`[data-fetcher] Found ${forex.length} forex pairs with freshness data`);
  
  // Log freshness for debugging
  for (const f of forex) {
    const age = f.price_updated_at ? Math.round((Date.now() - new Date(f.price_updated_at).getTime()) / 1000) : 'unknown';
    console.log(`[data-fetcher] ${f.pair}: $${f.rate} (updated ${age}s ago)`);
  }
  
  return {
    type: 'forex_lookup',
    tokens: [],
    forex,
  };
}
