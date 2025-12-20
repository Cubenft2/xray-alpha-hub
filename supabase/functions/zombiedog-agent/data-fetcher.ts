// Data Fetcher: Fetch RICH data based on ParsedIntent
// Leverages all available data from Polygon, LunarCrush, and CoinGecko

import { ParsedIntent } from './intent-parser.ts';

// Sector token definitions
export const SECTOR_TOKENS: Record<string, string[]> = {
  ai: ['LINK', 'TAO', 'NEAR', 'RENDER', 'FET', 'INJ', 'VIRTUAL', 'GRT', 'THETA', 'TRAC', 'AGIX', 'OCEAN', 'AKT', 'ATH', 'AIOZ'],
  defi: ['AAVE', 'UNI', 'MKR', 'CRV', 'SNX', 'COMP', 'SUSHI', 'YFI', 'CAKE', 'JOE', 'LDO', 'PENDLE'],
  meme: ['DOGE', 'SHIB', 'PEPE', 'FLOKI', 'BONK', 'WIF', 'BRETT', 'MOG', 'TURBO', 'POPCAT'],
  gaming: ['AXS', 'SAND', 'MANA', 'IMX', 'GALA', 'ENJ', 'MAGIC', 'PRIME', 'BEAM', 'RONIN'],
  l1: ['BTC', 'ETH', 'SOL', 'AVAX', 'ADA', 'DOT', 'NEAR', 'ATOM', 'SUI', 'APT', 'SEI', 'TON'],
  l2: ['ARB', 'OP', 'MATIC', 'IMX', 'MNT', 'METIS', 'ZK', 'STRK', 'BLAST'],
  nft: ['APE', 'BLUR', 'LOOKS', 'X2Y2', 'RARI', 'SUPER'],
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

export interface FetchedData {
  type: string;
  tokens: RichToken[];
  gainers?: RichToken[];
  losers?: RichToken[];
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

export async function fetchDataForIntent(supabase: any, intent: ParsedIntent): Promise<FetchedData> {
  console.log(`[data-fetcher] Fetching RICH data for intent: ${intent.intent}, sector: ${intent.sector}, tickers: [${intent.tickers.join(',')}]`);
  
  try {
    switch (intent.intent) {
      case 'market_overview':
        return await fetchMarketOverview(supabase);
        
      case 'sector_analysis':
        return await fetchSectorData(supabase, intent.sector, intent.action);
        
      case 'token_lookup':
        return await fetchTokens(supabase, intent.tickers);
        
      case 'comparison':
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

  return {
    type: 'token_lookup',
    tokens: data || [],
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
