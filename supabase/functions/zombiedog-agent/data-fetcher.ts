// Data Fetcher: Fetch data based on ParsedIntent
// Centralized data fetching for LLM intent-based routing

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

export interface FetchedData {
  type: string;
  tokens: any[];
  marketSummary?: {
    total: number;
    greenCount: number;
    redCount: number;
    breadthPct: number;
    leaders: { symbol: string; change: number }[];
    laggards: { symbol: string; change: number }[];
    avgGalaxyScore?: number;
  };
  error?: string;
}

const MIN_MARKET_CAP = 5000000; // $5M minimum

export async function fetchDataForIntent(supabase: any, intent: ParsedIntent): Promise<FetchedData> {
  console.log(`[data-fetcher] Fetching for intent: ${intent.intent}, sector: ${intent.sector}, tickers: [${intent.tickers.join(',')}]`);
  
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
  // Get top 25 by market cap
  const { data: topCoins, error: topError } = await supabase
    .from('token_cards')
    .select('canonical_symbol, name, price_usd, change_24h_pct, volume_24h_usd, market_cap, market_cap_rank, galaxy_score, sentiment, rsi_14, lc_ai_summary')
    .gt('market_cap_rank', 0)
    .order('market_cap_rank', { ascending: true })
    .limit(25);

  if (topError) {
    console.error(`[data-fetcher] Market overview error: ${topError.message}`);
    return { type: 'market_overview', tokens: [], error: topError.message };
  }

  const tokens = topCoins || [];
  
  // Compute market summary
  const greenCount = tokens.filter((t: any) => (t.change_24h_pct || 0) > 0).length;
  const redCount = tokens.filter((t: any) => (t.change_24h_pct || 0) < 0).length;
  const sorted = [...tokens].sort((a: any, b: any) => (b.change_24h_pct || 0) - (a.change_24h_pct || 0));
  
  const avgGalaxyScore = tokens.filter((t: any) => t.galaxy_score).length > 0
    ? Math.round(tokens.reduce((sum: number, t: any) => sum + (t.galaxy_score || 0), 0) / tokens.filter((t: any) => t.galaxy_score).length)
    : undefined;

  return {
    type: 'market_overview',
    tokens,
    marketSummary: {
      total: tokens.length,
      greenCount,
      redCount,
      breadthPct: Math.round((greenCount / tokens.length) * 100),
      leaders: sorted.slice(0, 3).map((t: any) => ({ symbol: t.canonical_symbol, change: t.change_24h_pct || 0 })),
      laggards: sorted.slice(-3).reverse().map((t: any) => ({ symbol: t.canonical_symbol, change: t.change_24h_pct || 0 })),
      avgGalaxyScore,
    }
  };
}

async function fetchSectorData(supabase: any, sector: string | null, action: string | null): Promise<FetchedData> {
  // Get sector tokens list
  const sectorTokens = sector && SECTOR_TOKENS[sector] ? SECTOR_TOKENS[sector] : SECTOR_TOKENS.l1;
  
  let query = supabase
    .from('token_cards')
    .select('canonical_symbol, name, price_usd, change_24h_pct, volume_24h_usd, market_cap, market_cap_rank, galaxy_score, sentiment, rsi_14, lc_ai_summary')
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

  return {
    type: 'sector_analysis',
    tokens,
    marketSummary: {
      total: tokens.length,
      greenCount,
      redCount,
      breadthPct: tokens.length > 0 ? Math.round((greenCount / tokens.length) * 100) : 0,
      leaders: sorted.slice(0, 3).map((t: any) => ({ symbol: t.canonical_symbol, change: t.change_24h_pct || 0 })),
      laggards: sorted.slice(-3).reverse().map((t: any) => ({ symbol: t.canonical_symbol, change: t.change_24h_pct || 0 })),
    }
  };
}

async function fetchTokens(supabase: any, tickers: string[]): Promise<FetchedData> {
  if (tickers.length === 0) {
    return { type: 'token_lookup', tokens: [] };
  }

  const { data, error } = await supabase
    .from('token_cards')
    .select('*')
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
    .select('canonical_symbol, name, price_usd, change_24h_pct, volume_24h_usd, market_cap, market_cap_rank, galaxy_score, sentiment')
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
    .select('canonical_symbol, name, lc_ai_summary, lc_top_posts, sentiment, galaxy_score')
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
