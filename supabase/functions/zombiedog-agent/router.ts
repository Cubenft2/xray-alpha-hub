// Intent Router: Detect user intent and determine which tools to fetch

import { SessionContext } from "./context.ts";

export type Intent = 
  | 'price' 
  | 'chart' 
  | 'analysis' 
  | 'news' 
  | 'safety' 
  | 'sentiment' 
  | 'derivatives' 
  | 'content' 
  | 'verification'
  | 'market_overview'
  | 'general';

export interface RouteConfig {
  intent: Intent;
  fetchPrices: boolean;
  fetchSocial: boolean;
  fetchDerivs: boolean;
  fetchSecurity: boolean;
  fetchNews: boolean;
  fetchCharts: boolean;
  fetchDetails: boolean; // Asset fundamentals (description, categories, etc.)
  isSimpleQuery: boolean; // For model routing
}

// Intent patterns
const PRICE_PATTERN = /\b(price|prices|cost|costs|worth|value|trading at|how much)\b/i;
const CHART_PATTERN = /\b(chart|technical|rsi|macd|sma|ema|bollinger|indicator|support|resistance|trend)\b/i;
const NEWS_PATTERN = /\b(news|headline|latest|update|announced|announcement|what happened|why is|why did)\b/i;
const SAFETY_PATTERN = /\b(safe|scam|rug|honeypot|legit|legitimate|trust|risk|risky|danger|careful)\b/i;
const SENTIMENT_PATTERN = /\b(sentiment|social|trending|buzz|hype|galaxy|vibes|feeling|vibe)\b/i;
const DERIVS_PATTERN = /\b(funding|liquidation|derivatives|perp|perpetual|futures|open interest|oi)\b/i;
const CONTENT_PATTERN = /\b(write|make|create|draft|generate|compose)\b.*\b(post|tweet|caption|thread|content|about)\b/i;
const VERIFY_PATTERN = /\b(is this|verify|confirm|correct|right|legit|real|official|valid)\b.*\b(address|contract|ca|token)\b/i;
const MARKET_PATTERN = /\b(market|crypto|how('s|s| is)|what('s|s| is))\b.*\b(today|doing|looking|going|overall)\b/i;
const ANALYSIS_PATTERN = /\b(analysis|analyze|deep dive|breakdown|overview|tell me about|explain)\b/i;
const DETAILS_PATTERN = /\b(what is|what are|about|fundamentals|describe|who is|explain|overview|info)\b/i;
// NEW: Top N / group queries
const TOP_N_PATTERN = /\b(top\s*\d+|top\s*ten|top\s*twenty|top\s*100|best|biggest|largest|major|rundown)\b.*\b(coins?|crypto|tokens?|assets?|currencies?|market)?\b/i;
const GROUP_QUERY_PATTERN = /\b(give me|show me|list|what are|how are)\b.*\b(top|biggest|best|major|all)\b/i;

// Check if query contains explicit ticker
function hasExplicitTicker(query: string): boolean {
  const COMMON = new Set(['THE', 'AND', 'FOR', 'NOT', 'YOU', 'ARE', 'BUT', 'CAN', 'NOW', 'HOW', 'WHY', 'WHO',
    'DEX', 'CEX', 'API', 'USD', 'EUR', 'NFT', 'DAO', 'TVL', 'APY', 'APR', 'ATH', 'ATL', 'ABOUT', 'THIS', 'THAT',
    'TODAY', 'MARKET', 'CRYPTO', 'DOING', 'GOING', 'LOOKING', 'OVERALL', 'SAFE', 'NEWS', 'CHART']);
  
  const tickers = query.toUpperCase().match(/\$?[A-Z]{2,10}\b/g) || [];
  return tickers.some(t => {
    const cleaned = t.replace('$', '');
    return !COMMON.has(cleaned) && cleaned.length >= 2 && cleaned.length <= 6;
  });
}

export function detectIntent(userQuery: string, context: SessionContext): RouteConfig {
  const query = userQuery.trim();
  
  // Check if details should be fetched (fundamentals/about queries)
  const wantsDetails = DETAILS_PATTERN.test(query);
  
  // Content creation - high confidence pre-route
  if (CONTENT_PATTERN.test(query)) {
    console.log('[Router] Content creation detected');
    return {
      intent: 'content',
      fetchPrices: true,
      fetchSocial: true,
      fetchDerivs: false,
      fetchSecurity: false,
      fetchNews: true,
      fetchCharts: false,
      fetchDetails: true, // Content needs context
      isSimpleQuery: false,
    };
  }
  
  // Address verification - high confidence pre-route
  if (VERIFY_PATTERN.test(query)) {
    console.log('[Router] Verification detected');
    return {
      intent: 'verification',
      fetchPrices: false,
      fetchSocial: false,
      fetchDerivs: false,
      fetchSecurity: true,
      fetchNews: false,
      fetchCharts: false,
      fetchDetails: false,
      isSimpleQuery: true,
    };
  }
  
  // Market overview - including "top N" group queries
  if ((MARKET_PATTERN.test(query) || TOP_N_PATTERN.test(query) || GROUP_QUERY_PATTERN.test(query)) && !hasExplicitTicker(query)) {
    console.log('[Router] Market overview / group query detected');
    return {
      intent: 'market_overview',
      fetchPrices: true,
      fetchSocial: true,
      fetchDerivs: false, // Skip derivs for overview - focus on price/social
      fetchSecurity: false,
      fetchNews: false, // Skip news for overview - keep response fast
      fetchCharts: false,
      fetchDetails: false,
      isSimpleQuery: false,
    };
  }
  
  // Safety check
  if (SAFETY_PATTERN.test(query)) {
    console.log('[Router] Safety check detected');
    return {
      intent: 'safety',
      fetchPrices: true,
      fetchSocial: true,
      fetchDerivs: false,
      fetchSecurity: true,
      fetchNews: false,
      fetchCharts: false,
      fetchDetails: true, // Safety needs context about what the token is
      isSimpleQuery: false,
    };
  }
  
  // Derivatives
  if (DERIVS_PATTERN.test(query)) {
    console.log('[Router] Derivatives query detected');
    return {
      intent: 'derivatives',
      fetchPrices: true,
      fetchSocial: false,
      fetchDerivs: true,
      fetchSecurity: false,
      fetchNews: false,
      fetchCharts: false,
      fetchDetails: false,
      isSimpleQuery: true,
    };
  }
  
  // Sentiment/social
  if (SENTIMENT_PATTERN.test(query)) {
    console.log('[Router] Sentiment query detected');
    return {
      intent: 'sentiment',
      fetchPrices: true,
      fetchSocial: true,
      fetchDerivs: false,
      fetchSecurity: false,
      fetchNews: true,
      fetchCharts: false,
      fetchDetails: false,
      isSimpleQuery: false,
    };
  }
  
  // News
  if (NEWS_PATTERN.test(query)) {
    console.log('[Router] News query detected');
    return {
      intent: 'news',
      fetchPrices: true,
      fetchSocial: false,
      fetchDerivs: false,
      fetchSecurity: false,
      fetchNews: true,
      fetchCharts: false,
      fetchDetails: false,
      isSimpleQuery: false,
    };
  }
  
  // Chart/technical
  if (CHART_PATTERN.test(query)) {
    console.log('[Router] Chart/technical query detected');
    return {
      intent: 'chart',
      fetchPrices: true,
      fetchSocial: false,
      fetchDerivs: false,
      fetchSecurity: false,
      fetchNews: false,
      fetchCharts: true,
      fetchDetails: false,
      isSimpleQuery: false,
    };
  }
  
  // Simple price query
  if (PRICE_PATTERN.test(query)) {
    console.log('[Router] Price query detected');
    return {
      intent: 'price',
      fetchPrices: true,
      fetchSocial: false,
      fetchDerivs: false,
      fetchSecurity: false,
      fetchNews: false,
      fetchCharts: false,
      fetchDetails: false,
      isSimpleQuery: true,
    };
  }
  
  // Analysis/deep dive
  if (ANALYSIS_PATTERN.test(query)) {
    console.log('[Router] Analysis query detected');
    return {
      intent: 'analysis',
      fetchPrices: true,
      fetchSocial: true,
      fetchDerivs: true,
      fetchSecurity: false,
      fetchNews: true,
      fetchCharts: true,
      fetchDetails: true, // Analysis needs fundamentals
      isSimpleQuery: false,
    };
  }
  
  // Default: general query with basic data
  console.log('[Router] General query');
  return {
    intent: 'general',
    fetchPrices: true,
    fetchSocial: context.recentAssets.length > 0,
    fetchDerivs: false,
    fetchSecurity: false,
    fetchNews: false,
    fetchCharts: false,
    fetchDetails: wantsDetails, // Only if "what is" / "about" detected
    isSimpleQuery: false,
  };
}
