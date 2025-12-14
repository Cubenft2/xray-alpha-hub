/**
 * Market Preset Definitions for ZombieDog Agent
 * Mirror of src/config/marketPresets.ts for edge function use
 * 
 * CANONICAL SOURCE OF TRUTH - ZombieDog must NOT invent queries
 */

export interface MarketPreset {
  id: string;
  name: string;
  description: string;
  category: 'movement' | 'network' | 'sector' | 'structure' | 'sentiment';
  query: {
    sortBy: string;
    sortDir: 'asc' | 'desc';
    changeFilter: 'all' | 'gainers' | 'losers';
    categoryFilter: string;
    minVolume: number;
    minGalaxyScore: number;
    minMarketCap: number;
    limit: number;
  };
  intentKeywords: string[];
}

export const MARKET_PRESETS: MarketPreset[] = [
  // Movement
  {
    id: 'TOP_GAINERS_24H',
    name: 'Top Gainers (24h)',
    description: 'Cryptocurrencies with the highest price increase in the last 24 hours',
    category: 'movement',
    query: { sortBy: 'percent_change_24h', sortDir: 'desc', changeFilter: 'gainers', categoryFilter: 'all', minVolume: 0, minGalaxyScore: 0, minMarketCap: 0, limit: 25 },
    intentKeywords: ['gainers', 'top gainers', 'biggest gainers', 'movers up', 'pumping', 'green'],
  },
  {
    id: 'TOP_LOSERS_24H',
    name: 'Top Losers (24h)',
    description: 'Cryptocurrencies with the largest price decrease in the last 24 hours',
    category: 'movement',
    query: { sortBy: 'percent_change_24h', sortDir: 'asc', changeFilter: 'losers', categoryFilter: 'all', minVolume: 0, minGalaxyScore: 0, minMarketCap: 0, limit: 25 },
    intentKeywords: ['losers', 'top losers', 'biggest losers', 'movers down', 'dumping', 'red'],
  },
  {
    id: 'HIGHEST_VOLUME_24H',
    name: 'Highest Volume (24h)',
    description: 'Cryptocurrencies with the highest trading volume in the last 24 hours',
    category: 'movement',
    query: { sortBy: 'volume_24h', sortDir: 'desc', changeFilter: 'all', categoryFilter: 'all', minVolume: 0, minGalaxyScore: 0, minMarketCap: 0, limit: 25 },
    intentKeywords: ['volume', 'highest volume', 'most traded', 'active'],
  },
  {
    id: 'TOP_MOVERS_24H',
    name: 'Top Movers (24h)',
    description: 'Cryptocurrencies with the biggest price movement',
    category: 'movement',
    query: { sortBy: 'percent_change_24h', sortDir: 'desc', changeFilter: 'gainers', categoryFilter: 'all', minVolume: 10000000, minGalaxyScore: 0, minMarketCap: 0, limit: 25 },
    intentKeywords: ['movers', 'top movers', 'biggest movers', 'market movers'],
  },
  // Network
  {
    id: 'L1_BY_MARKET_CAP',
    name: 'Layer 1 by Market Cap',
    description: 'Layer 1 blockchain tokens ranked by market capitalization',
    category: 'network',
    query: { sortBy: 'market_cap_rank', sortDir: 'asc', changeFilter: 'all', categoryFilter: 'layer-1', minVolume: 0, minGalaxyScore: 0, minMarketCap: 0, limit: 25 },
    intentKeywords: ['l1', 'layer 1', 'layer-1', 'layer one', 'base chains'],
  },
  {
    id: 'L1_TOP_GAINERS_24H',
    name: 'Layer 1 Top Gainers (24h)',
    description: 'Layer 1 tokens with highest gains',
    category: 'network',
    query: { sortBy: 'percent_change_24h', sortDir: 'desc', changeFilter: 'gainers', categoryFilter: 'layer-1', minVolume: 0, minGalaxyScore: 0, minMarketCap: 0, limit: 25 },
    intentKeywords: ['l1 gainers', 'layer 1 gainers', 'l1 movers'],
  },
  // Sectors
  {
    id: 'AI_TOKENS',
    name: 'AI Tokens',
    description: 'Artificial intelligence and ML related tokens',
    category: 'sector',
    query: { sortBy: 'market_cap_rank', sortDir: 'asc', changeFilter: 'all', categoryFilter: 'ai', minVolume: 0, minGalaxyScore: 0, minMarketCap: 0, limit: 25 },
    intentKeywords: ['ai tokens', 'ai crypto', 'artificial intelligence', 'machine learning tokens'],
  },
  {
    id: 'DEFI_TOKENS',
    name: 'DeFi Tokens',
    description: 'Decentralized finance protocol tokens',
    category: 'sector',
    query: { sortBy: 'market_cap_rank', sortDir: 'asc', changeFilter: 'all', categoryFilter: 'defi', minVolume: 0, minGalaxyScore: 0, minMarketCap: 0, limit: 25 },
    intentKeywords: ['defi', 'defi tokens', 'decentralized finance'],
  },
  {
    id: 'GAMING_TOKENS',
    name: 'Gaming Tokens',
    description: 'Gaming and metaverse tokens',
    category: 'sector',
    query: { sortBy: 'market_cap_rank', sortDir: 'asc', changeFilter: 'all', categoryFilter: 'gaming', minVolume: 0, minGalaxyScore: 0, minMarketCap: 0, limit: 25 },
    intentKeywords: ['gaming tokens', 'gaming crypto', 'game tokens', 'metaverse'],
  },
  {
    id: 'MEME_TOKENS',
    name: 'Meme Tokens',
    description: 'Meme coins and community tokens',
    category: 'sector',
    query: { sortBy: 'market_cap_rank', sortDir: 'asc', changeFilter: 'all', categoryFilter: 'meme', minVolume: 0, minGalaxyScore: 0, minMarketCap: 0, limit: 25 },
    intentKeywords: ['meme', 'meme tokens', 'memecoins', 'meme coins'],
  },
  // Structure
  {
    id: 'TOP_25_MARKET_CAP',
    name: 'Top 25 by Market Cap',
    description: 'Top 25 cryptocurrencies by market cap',
    category: 'structure',
    query: { sortBy: 'market_cap_rank', sortDir: 'asc', changeFilter: 'all', categoryFilter: 'all', minVolume: 0, minGalaxyScore: 0, minMarketCap: 0, limit: 25 },
    intentKeywords: ['top 25', 'top 25 crypto', 'top coins', 'biggest crypto', 'largest crypto', 'market cap'],
  },
  {
    id: 'TOP_100_MARKET_CAP',
    name: 'Top 100 by Market Cap',
    description: 'Top 100 cryptocurrencies by market cap',
    category: 'structure',
    query: { sortBy: 'market_cap_rank', sortDir: 'asc', changeFilter: 'all', categoryFilter: 'all', minVolume: 0, minGalaxyScore: 0, minMarketCap: 0, limit: 100 },
    intentKeywords: ['top 100', 'top 100 crypto'],
  },
  {
    id: 'LARGE_CAP_TOKENS',
    name: 'Large Cap Tokens',
    description: 'Large-cap cryptocurrencies (>$10B)',
    category: 'structure',
    query: { sortBy: 'market_cap_rank', sortDir: 'asc', changeFilter: 'all', categoryFilter: 'all', minVolume: 0, minGalaxyScore: 0, minMarketCap: 10000000000, limit: 25 },
    intentKeywords: ['large cap', 'big cap', 'blue chip', 'blue chips'],
  },
  // Sentiment
  {
    id: 'TOP_GALAXY_SCORE',
    name: 'Top Galaxy Score',
    description: 'Highest LunarCrush Galaxy Score',
    category: 'sentiment',
    query: { sortBy: 'galaxy_score', sortDir: 'desc', changeFilter: 'all', categoryFilter: 'all', minVolume: 0, minGalaxyScore: 0, minMarketCap: 0, limit: 25 },
    intentKeywords: ['galaxy score', 'top galaxy', 'best galaxy score', 'social health'],
  },
  {
    id: 'TRENDING_SOCIAL_VOLUME',
    name: 'Trending by Social Volume',
    description: 'Highest social media activity',
    category: 'sentiment',
    query: { sortBy: 'social_volume', sortDir: 'desc', changeFilter: 'all', categoryFilter: 'all', minVolume: 0, minGalaxyScore: 0, minMarketCap: 0, limit: 25 },
    intentKeywords: ['trending', 'social volume', 'most discussed', 'viral', 'social activity'],
  },
  {
    id: 'HIGHEST_SENTIMENT',
    name: 'Highest Sentiment',
    description: 'Most positive social sentiment',
    category: 'sentiment',
    query: { sortBy: 'sentiment', sortDir: 'desc', changeFilter: 'all', categoryFilter: 'all', minVolume: 0, minGalaxyScore: 0, minMarketCap: 0, limit: 25 },
    intentKeywords: ['sentiment', 'positive sentiment', 'bullish sentiment'],
  },
];

// Map for O(1) lookup
export const PRESET_MAP = new Map<string, MarketPreset>(
  MARKET_PRESETS.map(p => [p.id, p])
);

/**
 * Match user query to a preset
 * Returns null if no confident match - AI should ask for clarification
 */
export function matchQueryToPreset(query: string): MarketPreset | null {
  const normalizedQuery = query.toLowerCase().trim();
  
  // Exact match on preset name
  for (const preset of MARKET_PRESETS) {
    if (normalizedQuery === preset.name.toLowerCase()) {
      return preset;
    }
  }
  
  // Keyword matching with scoring
  let bestMatch: MarketPreset | null = null;
  let bestScore = 0;
  
  for (const preset of MARKET_PRESETS) {
    let score = 0;
    for (const keyword of preset.intentKeywords) {
      if (normalizedQuery.includes(keyword.toLowerCase())) {
        score += keyword.length;
      }
    }
    if (score > bestScore) {
      bestScore = score;
      bestMatch = preset;
    }
  }
  
  // Require minimum confidence
  return bestScore >= 5 ? bestMatch : null;
}

/**
 * Get available preset IDs for clarification prompts
 */
export function getPresetSuggestions(category?: string): string[] {
  if (category) {
    return MARKET_PRESETS.filter(p => p.category === category).map(p => p.name);
  }
  return [
    'Top Gainers (24h)',
    'Top Losers (24h)',
    'Top 25 by Market Cap',
    'Top Galaxy Score',
    'AI Tokens',
    'Meme Tokens',
  ];
}
