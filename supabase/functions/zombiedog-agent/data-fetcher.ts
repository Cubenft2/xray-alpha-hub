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
  macd_trend: string | null;
  sma_20: number | null;
  sma_50: number | null;
  sma_200: number | null;
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
  
  // Market data (CoinGecko)
  circulating_supply: number | null;
  ath_price: number | null;
  ath_date: string | null;
  ath_change_pct: number | null;
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

// Full select for rich token data
const RICH_TOKEN_SELECT = `
  canonical_symbol,
  name,
  market_cap_rank,
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
  macd_trend,
  sma_20,
  sma_50,
  sma_200,
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
  circulating_supply,
  ath_price,
  ath_date,
  ath_change_pct
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

export async function fetchDataForIntent(supabase: any, intent: ParsedIntent): Promise<FetchedData> {
  console.log(`[data-fetcher] Fetching data for intent: ${intent.intent}, assetType: ${intent.assetType}, sector: ${intent.sector}, stockSector: ${intent.stockSector}, tickers: [${intent.tickers.join(',')}]`);
  
  try {
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
      .select('canonical_symbol, headline, insights, price_analysis, supportive_themes, critical_themes, sentiment_pct, about')
      .in('canonical_symbol', tickers);
    
    if (premiumAI && premiumAI.length > 0) {
      console.log(`[data-fetcher] Found ${premiumAI.length} premium AI summaries`);
      const premiumMap = new Map(premiumAI.map((p: any) => [p.canonical_symbol, p]));
      
      for (const token of tokens) {
        const premium = premiumMap.get(token.canonical_symbol);
        if (premium) {
          // Enhance AI summary with premium data
          token.ai_summary = premium.headline || token.ai_summary;
          (token as any).premium_insights = premium.insights;
          (token as any).premium_price_analysis = premium.price_analysis;
          (token as any).premium_supportive_themes = premium.supportive_themes;
          (token as any).premium_critical_themes = premium.critical_themes;
          (token as any).premium_sentiment_pct = premium.sentiment_pct;
          (token as any).premium_about = premium.about;
        }
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
  updated_at
`;

async function fetchForexData(supabase: any, tickers: string[]): Promise<FetchedData> {
  console.log(`[data-fetcher] Fetching forex data for: [${tickers.join(',')}]`);
  
  // Normalize tickers - handle formats like GOLD, XAU, XAUUSD
  const normalizedPairs = tickers.map(t => {
    const upper = t.toUpperCase();
    // Handle common aliases
    if (upper === 'GOLD' || upper === 'XAU') return 'XAUUSD';
    if (upper === 'SILVER' || upper === 'XAG') return 'XAGUSD';
    // Already a pair format
    return upper;
  });
  
  // Query forex_cards for the requested pairs
  const { data: forexData, error } = await supabase
    .from('forex_cards')
    .select(RICH_FOREX_SELECT)
    .in('pair', normalizedPairs);
  
  if (error) {
    console.error(`[data-fetcher] Forex query error: ${error.message}`);
    return { type: 'forex_lookup', tokens: [], forex: [], error: error.message };
  }
  
  const forex = forexData || [];
  console.log(`[data-fetcher] Found ${forex.length} forex pairs`);
  
  return {
    type: 'forex_lookup',
    tokens: [],
    forex,
  };
}
