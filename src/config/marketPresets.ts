/**
 * Market Preset Registry - Canonical Source of Truth
 * 
 * These presets define deterministic queries against crypto_snapshot
 * for both CryptoUniverse UI and ZombieDog AI agent.
 * 
 * RULES:
 * - NO dynamic logic or AI reasoning
 * - ALL presets map directly to lunarcrush-universe edge function
 * - ZombieDog must execute presets, not invent queries
 */

export interface MarketPreset {
  id: string;
  name: string;
  description: string;
  category: 'movement' | 'network' | 'sector' | 'structure' | 'sentiment';
  // Query params for lunarcrush-universe edge function
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
  // AI intent mapping keywords
  intentKeywords: string[];
  ttlSeconds: number;
}

// ============================================
// MARKET MOVEMENT PRESETS
// ============================================
const MOVEMENT_PRESETS: MarketPreset[] = [
  {
    id: 'TOP_GAINERS_24H',
    name: 'Top Gainers (24h)',
    description: 'Cryptocurrencies with the highest price increase in the last 24 hours',
    category: 'movement',
    query: {
      sortBy: 'percent_change_24h',
      sortDir: 'desc',
      changeFilter: 'gainers',
      categoryFilter: 'all',
      minVolume: 0,
      minGalaxyScore: 0,
      minMarketCap: 0,
      limit: 25,
    },
    intentKeywords: ['gainers', 'top gainers', 'biggest gainers', 'movers up', 'pumping', 'green'],
    ttlSeconds: 300,
  },
  {
    id: 'TOP_LOSERS_24H',
    name: 'Top Losers (24h)',
    description: 'Cryptocurrencies with the largest price decrease in the last 24 hours',
    category: 'movement',
    query: {
      sortBy: 'percent_change_24h',
      sortDir: 'asc',
      changeFilter: 'losers',
      categoryFilter: 'all',
      minVolume: 0,
      minGalaxyScore: 0,
      minMarketCap: 0,
      limit: 25,
    },
    intentKeywords: ['losers', 'top losers', 'biggest losers', 'movers down', 'dumping', 'red'],
    ttlSeconds: 300,
  },
  {
    id: 'HIGHEST_VOLUME_24H',
    name: 'Highest Volume (24h)',
    description: 'Cryptocurrencies with the highest trading volume in the last 24 hours',
    category: 'movement',
    query: {
      sortBy: 'volume_24h',
      sortDir: 'desc',
      changeFilter: 'all',
      categoryFilter: 'all',
      minVolume: 0,
      minGalaxyScore: 0,
      minMarketCap: 0,
      limit: 25,
    },
    intentKeywords: ['volume', 'highest volume', 'most traded', 'active'],
    ttlSeconds: 300,
  },
  {
    id: 'TOP_MOVERS_24H',
    name: 'Top Movers (24h)',
    description: 'Cryptocurrencies with the biggest absolute price movement (gainers)',
    category: 'movement',
    query: {
      sortBy: 'percent_change_24h',
      sortDir: 'desc',
      changeFilter: 'gainers',
      categoryFilter: 'all',
      minVolume: 10000000, // >$10M volume to filter noise
      minGalaxyScore: 0,
      minMarketCap: 0,
      limit: 25,
    },
    intentKeywords: ['movers', 'top movers', 'biggest movers', 'market movers'],
    ttlSeconds: 300,
  },
];

// ============================================
// NETWORK LAYER PRESETS
// ============================================
const NETWORK_PRESETS: MarketPreset[] = [
  {
    id: 'L1_BY_MARKET_CAP',
    name: 'Layer 1 by Market Cap',
    description: 'Layer 1 blockchain tokens ranked by market capitalization',
    category: 'network',
    query: {
      sortBy: 'market_cap_rank',
      sortDir: 'asc',
      changeFilter: 'all',
      categoryFilter: 'layer-1',
      minVolume: 0,
      minGalaxyScore: 0,
      minMarketCap: 0,
      limit: 25,
    },
    intentKeywords: ['l1', 'layer 1', 'layer-1', 'layer one', 'base chains'],
    ttlSeconds: 300,
  },
  {
    id: 'L1_TOP_GAINERS_24H',
    name: 'Layer 1 Top Gainers (24h)',
    description: 'Layer 1 blockchain tokens with highest price gains in 24 hours',
    category: 'network',
    query: {
      sortBy: 'percent_change_24h',
      sortDir: 'desc',
      changeFilter: 'gainers',
      categoryFilter: 'layer-1',
      minVolume: 0,
      minGalaxyScore: 0,
      minMarketCap: 0,
      limit: 25,
    },
    intentKeywords: ['l1 gainers', 'layer 1 gainers', 'l1 movers'],
    ttlSeconds: 300,
  },
];

// ============================================
// SECTOR / THEME PRESETS
// ============================================
const SECTOR_PRESETS: MarketPreset[] = [
  {
    id: 'AI_TOKENS',
    name: 'AI Tokens',
    description: 'Artificial intelligence and machine learning related tokens',
    category: 'sector',
    query: {
      sortBy: 'market_cap_rank',
      sortDir: 'asc',
      changeFilter: 'all',
      categoryFilter: 'ai',
      minVolume: 0,
      minGalaxyScore: 0,
      minMarketCap: 0,
      limit: 25,
    },
    intentKeywords: ['ai tokens', 'ai crypto', 'artificial intelligence', 'machine learning tokens'],
    ttlSeconds: 300,
  },
  {
    id: 'DEFI_TOKENS',
    name: 'DeFi Tokens',
    description: 'Decentralized finance protocol tokens',
    category: 'sector',
    query: {
      sortBy: 'market_cap_rank',
      sortDir: 'asc',
      changeFilter: 'all',
      categoryFilter: 'defi',
      minVolume: 0,
      minGalaxyScore: 0,
      minMarketCap: 0,
      limit: 25,
    },
    intentKeywords: ['defi', 'defi tokens', 'decentralized finance'],
    ttlSeconds: 300,
  },
  {
    id: 'GAMING_TOKENS',
    name: 'Gaming Tokens',
    description: 'Gaming and metaverse related tokens',
    category: 'sector',
    query: {
      sortBy: 'market_cap_rank',
      sortDir: 'asc',
      changeFilter: 'all',
      categoryFilter: 'gaming',
      minVolume: 0,
      minGalaxyScore: 0,
      minMarketCap: 0,
      limit: 25,
    },
    intentKeywords: ['gaming tokens', 'gaming crypto', 'game tokens', 'metaverse'],
    ttlSeconds: 300,
  },
  {
    id: 'MEME_TOKENS',
    name: 'Meme Tokens',
    description: 'Meme coins and community-driven tokens',
    category: 'sector',
    query: {
      sortBy: 'market_cap_rank',
      sortDir: 'asc',
      changeFilter: 'all',
      categoryFilter: 'meme',
      minVolume: 0,
      minGalaxyScore: 0,
      minMarketCap: 0,
      limit: 25,
    },
    intentKeywords: ['meme', 'meme tokens', 'memecoins', 'meme coins'],
    ttlSeconds: 300,
  },
  {
    id: 'NFT_TOKENS',
    name: 'NFT Tokens',
    description: 'NFT platform and marketplace tokens',
    category: 'sector',
    query: {
      sortBy: 'market_cap_rank',
      sortDir: 'asc',
      changeFilter: 'all',
      categoryFilter: 'nft',
      minVolume: 0,
      minGalaxyScore: 0,
      minMarketCap: 0,
      limit: 25,
    },
    intentKeywords: ['nft', 'nft tokens', 'nft crypto'],
    ttlSeconds: 300,
  },
];

// ============================================
// MARKET STRUCTURE PRESETS
// ============================================
const STRUCTURE_PRESETS: MarketPreset[] = [
  {
    id: 'TOP_25_MARKET_CAP',
    name: 'Top 25 by Market Cap',
    description: 'Top 25 cryptocurrencies ranked by market capitalization',
    category: 'structure',
    query: {
      sortBy: 'market_cap_rank',
      sortDir: 'asc',
      changeFilter: 'all',
      categoryFilter: 'all',
      minVolume: 0,
      minGalaxyScore: 0,
      minMarketCap: 0,
      limit: 25,
    },
    intentKeywords: ['top 25', 'top 25 crypto', 'top coins', 'biggest crypto', 'largest crypto', 'market cap'],
    ttlSeconds: 300,
  },
  {
    id: 'TOP_100_MARKET_CAP',
    name: 'Top 100 by Market Cap',
    description: 'Top 100 cryptocurrencies ranked by market capitalization',
    category: 'structure',
    query: {
      sortBy: 'market_cap_rank',
      sortDir: 'asc',
      changeFilter: 'all',
      categoryFilter: 'all',
      minVolume: 0,
      minGalaxyScore: 0,
      minMarketCap: 0,
      limit: 100,
    },
    intentKeywords: ['top 100', 'top 100 crypto'],
    ttlSeconds: 300,
  },
  {
    id: 'MID_CAP_TOKENS',
    name: 'Mid Cap Tokens',
    description: 'Mid-cap cryptocurrencies ($100M - $1B market cap)',
    category: 'structure',
    query: {
      sortBy: 'market_cap_rank',
      sortDir: 'asc',
      changeFilter: 'all',
      categoryFilter: 'all',
      minVolume: 0,
      minGalaxyScore: 0,
      minMarketCap: 100000000, // $100M min
      limit: 50,
    },
    intentKeywords: ['mid cap', 'midcap', 'medium cap'],
    ttlSeconds: 300,
  },
  {
    id: 'LARGE_CAP_TOKENS',
    name: 'Large Cap Tokens',
    description: 'Large-cap cryptocurrencies (>$10B market cap)',
    category: 'structure',
    query: {
      sortBy: 'market_cap_rank',
      sortDir: 'asc',
      changeFilter: 'all',
      categoryFilter: 'all',
      minVolume: 0,
      minGalaxyScore: 0,
      minMarketCap: 10000000000, // $10B min
      limit: 25,
    },
    intentKeywords: ['large cap', 'big cap', 'blue chip', 'blue chips'],
    ttlSeconds: 300,
  },
];

// ============================================
// SENTIMENT PRESETS (LunarCrush-native)
// ============================================
const SENTIMENT_PRESETS: MarketPreset[] = [
  {
    id: 'TOP_GALAXY_SCORE',
    name: 'Top Galaxy Score',
    description: 'Cryptocurrencies with the highest LunarCrush Galaxy Score',
    category: 'sentiment',
    query: {
      sortBy: 'galaxy_score',
      sortDir: 'desc',
      changeFilter: 'all',
      categoryFilter: 'all',
      minVolume: 0,
      minGalaxyScore: 0,
      minMarketCap: 0,
      limit: 25,
    },
    intentKeywords: ['galaxy score', 'top galaxy', 'best galaxy score', 'social health'],
    ttlSeconds: 300,
  },
  {
    id: 'TRENDING_SOCIAL_VOLUME',
    name: 'Trending by Social Volume',
    description: 'Cryptocurrencies with the highest social media activity',
    category: 'sentiment',
    query: {
      sortBy: 'social_volume',
      sortDir: 'desc',
      changeFilter: 'all',
      categoryFilter: 'all',
      minVolume: 0,
      minGalaxyScore: 0,
      minMarketCap: 0,
      limit: 25,
    },
    intentKeywords: ['trending', 'social volume', 'most discussed', 'viral', 'social activity'],
    ttlSeconds: 300,
  },
  {
    id: 'TOP_ALT_RANK',
    name: 'Top Alt Rank',
    description: 'Cryptocurrencies with the best LunarCrush Alt Rank',
    category: 'sentiment',
    query: {
      sortBy: 'alt_rank',
      sortDir: 'asc',
      changeFilter: 'all',
      categoryFilter: 'all',
      minVolume: 0,
      minGalaxyScore: 0,
      minMarketCap: 0,
      limit: 25,
    },
    intentKeywords: ['alt rank', 'top alt rank', 'best alt rank'],
    ttlSeconds: 300,
  },
  {
    id: 'HIGHEST_SENTIMENT',
    name: 'Highest Sentiment',
    description: 'Cryptocurrencies with the most positive social sentiment',
    category: 'sentiment',
    query: {
      sortBy: 'sentiment',
      sortDir: 'desc',
      changeFilter: 'all',
      categoryFilter: 'all',
      minVolume: 0,
      minGalaxyScore: 0,
      minMarketCap: 0,
      limit: 25,
    },
    intentKeywords: ['sentiment', 'positive sentiment', 'bullish sentiment'],
    ttlSeconds: 300,
  },
];

// ============================================
// COMBINED REGISTRY
// ============================================
export const MARKET_PRESETS: MarketPreset[] = [
  ...MOVEMENT_PRESETS,
  ...NETWORK_PRESETS,
  ...SECTOR_PRESETS,
  ...STRUCTURE_PRESETS,
  ...SENTIMENT_PRESETS,
];

// Map for O(1) lookup
export const PRESET_MAP = new Map<string, MarketPreset>(
  MARKET_PRESETS.map(p => [p.id, p])
);

/**
 * Match user query to a preset using keyword matching
 * Returns null if no confident match (AI should ask for clarification)
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
        // Longer keywords get higher scores
        score += keyword.length;
      }
    }
    if (score > bestScore) {
      bestScore = score;
      bestMatch = preset;
    }
  }
  
  // Require minimum confidence (at least 5 characters matched)
  return bestScore >= 5 ? bestMatch : null;
}

/**
 * Get presets by category for UI display
 */
export function getPresetsByCategory(category: MarketPreset['category']): MarketPreset[] {
  return MARKET_PRESETS.filter(p => p.category === category);
}

/**
 * Get all categories
 */
export const PRESET_CATEGORIES: MarketPreset['category'][] = [
  'movement',
  'network', 
  'sector',
  'structure',
  'sentiment',
];

export const CATEGORY_LABELS: Record<MarketPreset['category'], string> = {
  movement: '📈 Market Movement',
  network: '🧱 Network Layers',
  sector: '🏷️ Sectors & Themes',
  structure: '📊 Market Structure',
  sentiment: '🔥 Sentiment & Social',
};
