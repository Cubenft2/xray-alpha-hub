// Shared Zod Validation Schemas for all Edge Functions
// Single source of truth for API response validation

import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

// Re-export Zod for convenience
export { z };

// ============= ParsedIntent Schema (from intent-parser) =============
export const ParsedIntentSchema = z.object({
  intent: z.enum([
    'market_overview', 'sector_analysis', 'token_lookup', 
    'stock_lookup', 'comparison', 'trending', 'news', 'general_chat'
  ]),
  sector: z.enum([
    'ai', 'defi', 'meme', 'gaming', 'l1', 'l2', 
    'nft', 'privacy', 'storage', 'rwa', 'btc_eco'
  ]).nullable().default(null),
  stockSector: z.enum([
    'tech', 'healthcare', 'finance', 'energy', 'retail', 
    'auto', 'aerospace', 'utilities', 'communications'
  ]).nullable().default(null),
  tickers: z.array(z.string()).default([]),
  assetType: z.enum(['crypto', 'stock', 'forex', 'mixed']).default('crypto'),
  timeframe: z.enum(['now', 'today', '24h', 'week', 'month']).default('24h'),
  action: z.enum(['gainers', 'losers', 'movers', 'volume']).nullable().default(null),
  summary: z.string().default('Parsed successfully'),
  // Deep analysis flag - triggers comprehensive report with all data sources
  depth: z.enum(['normal', 'deep']).default('normal'),
});
export type ParsedIntent = z.infer<typeof ParsedIntentSchema>;

// ============= CoinGecko API Response Schemas =============
export const CoinGeckoMarketDataSchema = z.object({
  id: z.string(),
  symbol: z.string(),
  name: z.string(),
  current_price: z.number().nullable(),
  market_cap: z.number().nullable(),
  market_cap_rank: z.number().nullable(),
  fully_diluted_valuation: z.number().nullable(),
  total_volume: z.number().nullable(),
  high_24h: z.number().nullable(),
  low_24h: z.number().nullable(),
  price_change_percentage_24h: z.number().nullable(),
  price_change_percentage_1h_in_currency: z.number().nullable(),
  price_change_percentage_7d_in_currency: z.number().nullable(),
  price_change_percentage_30d_in_currency: z.number().nullable(),
  circulating_supply: z.number().nullable(),
  total_supply: z.number().nullable(),
  max_supply: z.number().nullable(),
  ath: z.number().nullable(),
  ath_date: z.string().nullable(),
  atl: z.number().nullable(),
  atl_date: z.string().nullable(),
  last_updated: z.string().nullable(),
});
export type CoinGeckoMarketData = z.infer<typeof CoinGeckoMarketDataSchema>;

// For validating the full /coins/markets response
export const CoinGeckoMarketsResponseSchema = z.array(CoinGeckoMarketDataSchema);

// ============= LunarCrush API Response Schemas =============
export const LunarCrushAssetSchema = z.object({
  name: z.string(),
  symbol: z.string(),
  galaxy_score: z.number().default(0),
  alt_rank: z.number().default(0),
  social_volume: z.number().default(0),
  social_dominance: z.number().default(0),
  sentiment: z.number().default(0),
  fomo_score: z.number().default(0),
});
export type LunarCrushAsset = z.infer<typeof LunarCrushAssetSchema>;

// For validating the coins/list response wrapper
export const LunarCrushCoinsListResponseSchema = z.object({
  data: z.array(z.any()).default([]), // Raw data, we parse items individually
});

export const LunarCrushNewsPostSchema = z.object({
  id: z.string(),
  post_type: z.string(),
  post_title: z.string(),
  post_link: z.string(),
  post_image: z.string().optional(),
  post_created: z.number(),
  post_sentiment: z.number(),
  creator_id: z.string(),
  creator_name: z.string(),
  creator_display_name: z.string().optional(),
  creator_followers: z.number(),
  creator_avatar: z.string().optional(),
  interactions_24h: z.number(),
  interactions_total: z.number(),
});
export type LunarCrushNewsPost = z.infer<typeof LunarCrushNewsPostSchema>;

// ============= Polygon API Response Schemas =============
export const PolygonTradeResultSchema = z.object({
  p: z.number(), // price
  s: z.number().optional(), // size
  t: z.number(), // timestamp
  x: z.number().optional(), // exchange
});
export type PolygonTradeResult = z.infer<typeof PolygonTradeResultSchema>;

export const PolygonPrevDaySchema = z.object({
  c: z.number().optional(), // close
  h: z.number().optional(), // high
  l: z.number().optional(), // low
  o: z.number().optional(), // open
  v: z.number().optional(), // volume
  vw: z.number().optional(), // vwap
});
export type PolygonPrevDay = z.infer<typeof PolygonPrevDaySchema>;

export const PolygonCryptoPriceSchema = z.object({
  symbol: z.string(),
  price: z.number(),
  change24h: z.number().default(0),
  timestamp: z.number(),
  exchange: z.string().default('POLYGON'),
  size: z.number().nullable(),
});
export type PolygonCryptoPrice = z.infer<typeof PolygonCryptoPriceSchema>;

export const PolygonTickerSnapshotSchema = z.object({
  ticker: z.string(),
  todaysChange: z.number().optional(),
  todaysChangePerc: z.number().optional(),
  updated: z.number().optional(),
  day: z.object({
    c: z.number().optional(),
    h: z.number().optional(),
    l: z.number().optional(),
    o: z.number().optional(),
    v: z.number().optional(),
    vw: z.number().optional(),
  }).optional(),
  lastTrade: z.object({
    p: z.number().optional(),
    s: z.number().optional(),
    t: z.number().optional(),
  }).optional(),
  prevDay: PolygonPrevDaySchema.optional(),
});
export type PolygonTickerSnapshot = z.infer<typeof PolygonTickerSnapshotSchema>;

// ============= Validation Utilities =============

/**
 * Safely parse an array of items, skipping invalid ones and logging errors.
 * Returns only the valid items.
 */
export function safeParseArray<T>(
  schema: z.ZodType<T>,
  data: unknown[],
  logPrefix: string
): T[] {
  if (!Array.isArray(data)) {
    console.warn(`[${logPrefix}] Expected array, got ${typeof data}`);
    return [];
  }

  const valid: T[] = [];
  const errors: string[] = [];
  
  for (let i = 0; i < data.length; i++) {
    const result = schema.safeParse(data[i]);
    if (result.success) {
      valid.push(result.data);
    } else {
      const issuesSummary = result.error.issues
        .map(issue => `${issue.path.join('.')}: ${issue.message}`)
        .join('; ');
      errors.push(`[${i}] ${issuesSummary}`);
    }
  }
  
  if (errors.length > 0) {
    console.warn(`[${logPrefix}] Validation skipped ${errors.length}/${data.length} items. First 3:`, 
      errors.slice(0, 3));
  }
  
  return valid;
}

/**
 * Safely parse a single value with a fallback default.
 * Logs errors but doesn't throw.
 */
export function safeParseWithDefault<T>(
  schema: z.ZodType<T>,
  data: unknown,
  defaultValue: T,
  logPrefix: string
): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    console.error(`[${logPrefix}] Validation failed:`, {
      issues: result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`),
      receivedType: typeof data,
    });
    return defaultValue;
  }
  return result.data;
}

/**
 * Transform raw LunarCrush coin data to our schema format.
 * Handles API field name variations.
 */
export function transformLunarCrushCoin(coin: Record<string, unknown>): LunarCrushAsset {
  return {
    name: String(coin.name || ''),
    symbol: String(coin.symbol || ''),
    galaxy_score: Number(coin.galaxy_score) || 0,
    alt_rank: Number(coin.alt_rank) || 0,
    // LunarCrush uses different field names for social volume
    social_volume: Number(coin.interactions_24h ?? coin.social_volume) || 0,
    social_dominance: Number(coin.social_dominance) || 0,
    sentiment: Number(coin.sentiment) || 0,
    fomo_score: Number(coin.fomo_score) || 0,
  };
}

/**
 * Validate and transform CoinGecko market data with safe parsing.
 */
export function parseCoingeckoMarkets(data: unknown, logPrefix: string): CoinGeckoMarketData[] {
  if (!Array.isArray(data)) {
    console.warn(`[${logPrefix}] Expected array from CoinGecko, got ${typeof data}`);
    return [];
  }
  
  return safeParseArray(CoinGeckoMarketDataSchema, data, logPrefix);
}
