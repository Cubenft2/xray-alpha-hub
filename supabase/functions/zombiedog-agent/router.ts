// Intent Router: Detect user intent and determine which tools to fetch
// Uses canonical market presets for deterministic queries

import { SessionContext } from "./context.ts";
import { matchQueryToPreset, MarketPreset } from "./presets.ts";

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
  | 'market_preset'
  | 'compare'        // NEW: Asset comparison (BTC vs ETH)
  | 'general_chat'   // NEW: Greetings, help, non-market queries
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
  preset?: MarketPreset; // If intent is market_preset, this holds the matched preset
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
// Top N / group queries
const TOP_N_PATTERN = /\b(top\s*\d+|top\s*ten|top\s*twenty|top\s*100|best|biggest|largest|major|rundown|movers?|gainers?|losers?)\b.*\b(coins?|crypto|tokens?|assets?|currencies?|market|performance)?\b/i;
const GROUP_QUERY_PATTERN = /\b(give me|show me|list|what are|how are|can you make|make me)\b.*\b(top|biggest|best|major|all|movers?|gainers?|losers?)\b/i;

// NEW: Trending / Hot patterns → route to market_preset
const TRENDING_PATTERN = /\b(what'?s|which|show me|give me)\s*(hot|trending|pumping|moving|on fire)\b/i;
const HOT_PATTERN = /\b(hot|trending)\s*(coins?|tokens?|crypto)?\s*(right now|today)?/i;

// NEW: Compare patterns → compare intent
const COMPARE_PATTERN = /\b(vs\.?|versus|compare|between)\b/i;
const COMPARE_EXPLICIT = /\b(\w+)\s+or\s+(\w+)\b.*\b(better|pick|choose)\b/i;

// NEW: General chat (skip all data fetching)
const GREETING_PATTERN = /^(hi|hello|hey|yo|sup|gm|thanks?|thank you|thx|good morning|good evening)\s*[!.]?$/i;
const CAPABILITIES_PATTERN = /\b(what can you|who are you|what are you|help$|how do you work)\b/i;

// Check if query contains explicit ticker
function hasExplicitTicker(query: string): boolean {
const COMMON = new Set(['THE', 'AND', 'FOR', 'NOT', 'YOU', 'ARE', 'BUT', 'CAN', 'NOW', 'HOW', 'WHY', 'WHO',
    'DEX', 'CEX', 'API', 'USD', 'EUR', 'NFT', 'DAO', 'TVL', 'APY', 'APR', 'ATH', 'ATL', 'ABOUT', 'THIS', 'THAT',
    'TODAY', 'MARKET', 'CRYPTO', 'DOING', 'GOING', 'LOOKING', 'OVERALL', 'SAFE', 'NEWS', 'CHART',
    'TOP', 'BEST', 'BIGGEST', 'LARGEST', 'MAJOR', 'PERFORMANCE', 'RANK', 'RANKING',
    'LIST', 'RUNDOWN', 'SHOW', 'GIVE', 'COMPARE', 'MOVERS', 'GAINERS', 'LOSERS', 'PASS',
    // Additional stopwords to prevent false ticker detection
    'WORLD', 'GLOBAL', 'WORKS', 'EVER', 'EVERY', 'NEVER', 'BEEN', 'OVER', 'MUCH',
    'THING', 'THINGS', 'ALONG', 'TELL', 'MAKES', 'MADE', 'WELL', 'FEEL', 'FEELS']);
  
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
  
  // === GENERAL CHAT (highest priority - skip all data fetching) ===
  if (GREETING_PATTERN.test(query) || CAPABILITIES_PATTERN.test(query)) {
    console.log('[Router] General chat detected (greeting/capabilities)');
    return {
      intent: 'general_chat',
      fetchPrices: false,
      fetchSocial: false,
      fetchDerivs: false,
      fetchSecurity: false,
      fetchNews: false,
      fetchCharts: false,
      fetchDetails: false,
      isSimpleQuery: true,
    };
  }
  
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
  
  // === COMPARE (BTC vs ETH, compare X and Y) ===
  if ((COMPARE_PATTERN.test(query) || COMPARE_EXPLICIT.test(query)) && hasExplicitTicker(query)) {
    console.log('[Router] Compare intent detected');
    return {
      intent: 'compare',
      fetchPrices: true,
      fetchSocial: true,
      fetchDerivs: false,
      fetchSecurity: false,
      fetchNews: false,
      fetchCharts: true,
      fetchDetails: false,
      isSimpleQuery: false,
    };
  }
  
  // === TRENDING/HOT patterns → route to market_preset ===
  if ((TRENDING_PATTERN.test(query) || HOT_PATTERN.test(query)) && !hasExplicitTicker(query)) {
    // Try to match to a preset (usually TOP_GALAXY_SCORE for "what's hot")
    const matchedPreset = matchQueryToPreset(query);
    
    if (matchedPreset) {
      console.log(`[Router] TRENDING matched to preset=${matchedPreset.id}`);
      return {
        intent: 'market_preset',
        fetchPrices: false,
        fetchSocial: false,
        fetchDerivs: false,
        fetchSecurity: false,
        fetchNews: false,
        fetchCharts: false,
        fetchDetails: false,
        isSimpleQuery: false,
        preset: matchedPreset,
      };
    }
  }
  
  // Market preset - check if query matches a canonical preset first
  if ((TOP_N_PATTERN.test(query) || GROUP_QUERY_PATTERN.test(query)) && !hasExplicitTicker(query)) {
    const matchedPreset = matchQueryToPreset(query);
    
    if (matchedPreset) {
      console.log(`[Router] MARKET_PRESET_MATCHED preset=${matchedPreset.id} query="${query}"`);
      return {
        intent: 'market_preset',
        fetchPrices: false, // Preset execution handles data fetching
        fetchSocial: false,
        fetchDerivs: false,
        fetchSecurity: false,
        fetchNews: false,
        fetchCharts: false,
        fetchDetails: false,
        isSimpleQuery: false,
        preset: matchedPreset,
      };
    }
    
    // No preset match but looks like market query - use general market_overview
    console.log(`[Router] Market query detected but no preset match - using market_overview`);
  }
  
  // Market overview - general market sentiment (no specific preset)
  if (MARKET_PATTERN.test(query) && !hasExplicitTicker(query)) {
    console.log('[Router] Market overview detected');
    return {
      intent: 'market_overview',
      fetchPrices: true,
      fetchSocial: true,
      fetchDerivs: false,
      fetchSecurity: false,
      fetchNews: false,
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
