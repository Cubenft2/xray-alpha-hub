import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// AI Provider types
type AIProvider = 'lovable' | 'openai' | 'anthropic';

// Top cryptos to fetch general prices for
const TOP_CRYPTOS = ['BTC', 'ETH', 'SOL', 'XRP', 'ADA', 'DOGE', 'LINK', 'AVAX', 'DOT', 'MATIC', 'SHIB', 'UNI', 'LTC', 'BCH', 'ATOM'];

// Message compression settings
const RECENT_MESSAGES_TO_KEEP = 3;

// ============================================
// AI USAGE TRACKING - TOKEN ESTIMATION & COST
// ============================================

// Estimate tokens (~4 chars per token is a common approximation)
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

// Pricing per 1M tokens (in USD)
const AI_PRICING: Record<string, { input: number; output: number; model: string }> = {
  'lovable': { input: 0.15, output: 0.60, model: 'google/gemini-2.5-flash' },
  'openai': { input: 0.15, output: 0.60, model: 'gpt-4o-mini' },
  'anthropic': { input: 0.80, output: 4.00, model: 'claude-3-5-haiku-20241022' },
};

// Calculate cost in millicents (1 USD = 100,000 millicents)
function calculateCostMillicents(provider: AIProvider, inputTokens: number, outputTokens: number): number {
  const pricing = AI_PRICING[provider];
  if (!pricing) return 0;
  
  const inputCost = (inputTokens / 1_000_000) * pricing.input;
  const outputCost = (outputTokens / 1_000_000) * pricing.output;
  return Math.ceil((inputCost + outputCost) * 100_000); // Convert to millicents
}

// Log AI usage to database
async function logAIUsage(
  supabase: any,
  provider: AIProvider,
  inputTokens: number,
  outputTokens: number,
  latencyMs: number,
  metadata: {
    questionTypes?: string[];
    assetsQueried?: string[];
    dataSourcesUsed?: string[];
    fallbackUsed?: boolean;
    fallbackFrom?: string;
    userMessagePreview?: string;
    sessionId?: string;
    clientIp?: string;
  }
): Promise<void> {
  try {
    const costMillicents = calculateCostMillicents(provider, inputTokens, outputTokens);
    
    await supabase.from('ai_usage_logs').insert({
      provider,
      model: AI_PRICING[provider]?.model || 'unknown',
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      estimated_cost_millicents: costMillicents,
      latency_ms: latencyMs,
      question_type: metadata.questionTypes || [],
      assets_queried: metadata.assetsQueried || [],
      data_sources_used: metadata.dataSourcesUsed || [],
      fallback_used: metadata.fallbackUsed || false,
      fallback_from: metadata.fallbackFrom || null,
      user_message_preview: metadata.userMessagePreview?.substring(0, 200) || null,
      session_id: metadata.sessionId || null,
      client_ip: metadata.clientIp || null,
    });
    
    console.log(`[AI Usage] Logged: ${provider} | ${inputTokens}in/${outputTokens}out | ${costMillicents/100000} USD | ${latencyMs}ms`);
  } catch (error) {
    console.error('[AI Usage] Failed to log usage:', error);
    // Don't throw - logging failure shouldn't break the chat
  }
}

// ============================================
// RATE LIMITING - 10 messages/day per IP (admins unlimited)
// ============================================
const DAILY_MESSAGE_LIMIT = 10;

// Get client IP from request headers
function getClientIP(req: Request): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
         req.headers.get('x-real-ip') || 
         'unknown';
}

// Check if user is admin (by JWT token)
async function isAdminUser(req: Request, supabase: any): Promise<boolean> {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return false;
    }
    
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) {
      return false;
    }
    
    // Check user_roles table for admin role
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .single();
    
    return !!roleData;
  } catch (error) {
    console.error('[Rate Limit] Admin check error:', error);
    return false;
  }
}

// Check rate limit for a client IP
async function checkRateLimit(supabase: any, clientIp: string): Promise<{ allowed: boolean; remaining: number; resetTime: string }> {
  try {
    // Get current date in ET timezone (midnight reset)
    const now = new Date();
    const etFormatter = new Intl.DateTimeFormat('en-CA', { 
      timeZone: 'America/New_York',
      year: 'numeric',
      month: '2-digit', 
      day: '2-digit'
    });
    const todayET = etFormatter.format(now); // Format: YYYY-MM-DD
    
    // Convert today's date in ET to a UTC timestamp for comparison
    const startOfDayET = new Date(`${todayET}T00:00:00-05:00`); // Approximate ET offset
    
    // Count messages from this IP today
    const { count, error } = await supabase
      .from('ai_usage_logs')
      .select('*', { count: 'exact', head: true })
      .eq('client_ip', clientIp)
      .gte('created_at', startOfDayET.toISOString());
    
    if (error) {
      console.error('[Rate Limit] Count query error:', error);
      // On error, allow the request (fail open for UX)
      return { allowed: true, remaining: DAILY_MESSAGE_LIMIT, resetTime: 'midnight ET' };
    }
    
    const messageCount = count || 0;
    const remaining = Math.max(0, DAILY_MESSAGE_LIMIT - messageCount);
    const allowed = messageCount < DAILY_MESSAGE_LIMIT;
    
    console.log(`[Rate Limit] IP ${clientIp}: ${messageCount}/${DAILY_MESSAGE_LIMIT} messages today, ${remaining} remaining`);
    
    return { allowed, remaining, resetTime: 'midnight ET' };
  } catch (error) {
    console.error('[Rate Limit] Check error:', error);
    // Fail open for UX
    return { allowed: true, remaining: DAILY_MESSAGE_LIMIT, resetTime: 'midnight ET' };
  }
}

// Get usage count for a client IP (for frontend display)
async function getUsageCount(supabase: any, clientIp: string): Promise<number> {
  try {
    const now = new Date();
    const etFormatter = new Intl.DateTimeFormat('en-CA', { 
      timeZone: 'America/New_York',
      year: 'numeric',
      month: '2-digit', 
      day: '2-digit'
    });
    const todayET = etFormatter.format(now);
    const startOfDayET = new Date(`${todayET}T00:00:00-05:00`);
    
    const { count, error } = await supabase
      .from('ai_usage_logs')
      .select('*', { count: 'exact', head: true })
      .eq('client_ip', clientIp)
      .gte('created_at', startOfDayET.toISOString());
    
    return error ? 0 : (count || 0);
  } catch {
    return 0;
  }
}

// Prepare messages for AI with hybrid compression (keep last 3 full, summarize rest)
function prepareMessagesForAI(messages: any[]): any[] {
  if (messages.length <= RECENT_MESSAGES_TO_KEEP) {
    console.log(`[Message Prep] ${messages.length} messages - no compression needed`);
    return messages;
  }
  
  // Split: older messages vs recent 3
  const olderMessages = messages.slice(0, -RECENT_MESSAGES_TO_KEEP);
  const recentMessages = messages.slice(-RECENT_MESSAGES_TO_KEEP);
  
  // Compress older messages into a context summary
  const summary = compressConversationHistory(olderMessages);
  
  console.log(`[Message Prep] Compressed ${olderMessages.length} older messages, keeping ${recentMessages.length} recent`);
  
  // Return: [compressed context] + [last 3 full messages]
  return [
    { role: 'user', content: `[PREVIOUS CONVERSATION CONTEXT: ${summary}]` },
    ...recentMessages
  ];
}

// Compress older conversation history into a summary
function compressConversationHistory(messages: any[]): string {
  // Extract user questions only (assistant responses are implied by context)
  const userQuestions = messages
    .filter(m => m.role === 'user')
    .map(m => {
      // Extract key content - symbols, questions, topics
      const content = m.content.substring(0, 120).trim();
      // Find any symbols mentioned
      const symbols = content.match(/\$?[A-Z]{2,6}\b/g) || [];
      const symbolStr = symbols.length > 0 ? ` (${symbols.join(', ')})` : '';
      return content.length > 100 ? content.substring(0, 100) + '...' + symbolStr : content + symbolStr;
    });
  
  if (userQuestions.length === 0) {
    return 'General market discussion.';
  }
  
  // Create compressed summary
  return `User previously asked ${userQuestions.length} questions about: ${userQuestions.join(' | ').substring(0, 600)}`;
}

// Common crypto aliases to recognize lowercase mentions
const CRYPTO_ALIASES: Record<string, string> = {
  'btc': 'BTC', 'bitcoin': 'BTC',
  'eth': 'ETH', 'ethereum': 'ETH', 'ether': 'ETH',
  'sol': 'SOL', 'solana': 'SOL',
  'xrp': 'XRP', 'ripple': 'XRP',
  'ada': 'ADA', 'cardano': 'ADA',
  'doge': 'DOGE', 'dogecoin': 'DOGE',
  'link': 'LINK', 'chainlink': 'LINK',
  'avax': 'AVAX', 'avalanche': 'AVAX',
  'dot': 'DOT', 'polkadot': 'DOT',
  'matic': 'MATIC', 'polygon': 'MATIC',
  'shib': 'SHIB', 'shiba': 'SHIB',
  'uni': 'UNI', 'uniswap': 'UNI',
  'ltc': 'LTC', 'litecoin': 'LTC',
  'bch': 'BCH',
  'atom': 'ATOM', 'cosmos': 'ATOM',
  'mon': 'MON', 'monad': 'MON',
  'bnb': 'BNB', 'binance': 'BNB',
  'ton': 'TON', 'toncoin': 'TON',
  'sui': 'SUI',
  'apt': 'APT', 'aptos': 'APT',
  'arb': 'ARB', 'arbitrum': 'ARB',
  'op': 'OP', 'optimism': 'OP',
  'pepe': 'PEPE',
  'wif': 'WIF', 'dogwifhat': 'WIF',
  'bonk': 'BONK',
  'floki': 'FLOKI',
  'near': 'NEAR',
  'sei': 'SEI',
  'render': 'RNDR', 'rndr': 'RNDR',
  'inj': 'INJ', 'injective': 'INJ',
  'fet': 'FET',
  'fil': 'FIL', 'filecoin': 'FIL',
  'hbar': 'HBAR', 'hedera': 'HBAR',
  'xlm': 'XLM', 'stellar': 'XLM',
  'algo': 'ALGO', 'algorand': 'ALGO',
};

interface PriceData {
  symbol: string;
  price: number;
  change24h: number;
}

interface CoinDetail {
  symbol: string;
  name: string;
  price: number;
  change24h: number;
  change7d: number;
  change30d: number;
  galaxyScore: number;
  altRank: number;
  riskLevel: string;
  volatility: number;
  volume24h: number;
  marketCap: number;
  shortTermTrend: string;
  mediumTermTrend: string;
  longTermTrend: string;
  fomoScore?: number;
}

interface ResolvedAsset {
  symbol: string;
  coingeckoId: string | null;
  displayName: string;
  assetType: 'crypto' | 'stock';
  polygonTicker?: string;
}

interface HistoricalContext {
  symbol: string;
  change30d: number;
  high30d: number;
  low30d: number;
  avgVolume: number;
}

interface TechnicalIndicators {
  symbol: string;
  rsi?: { value: number; signal: string };
  macd?: { histogram: number; signal: string };
  sma50?: number;
  ema20?: number;
}

interface SimilarAsset {
  symbol: string;
  displayName: string;
  type: string;
  similarity: number;
}

interface WebSearchResult {
  title: string;
  url: string;
  content: string;
  score: number;
}

interface CompanyDetails {
  ticker: string;
  name: string | null;
  description: string | null;
  sector: string | null;
  industry: string | null;
  market_cap: number | null;
  employees: number | null;
  headquarters: { address?: string; city?: string; state?: string } | null;
  website: string | null;
  logo_url: string | null;
  list_date: string | null;
  last_financials: Array<{
    fiscal_period: string;
    fiscal_year: string;
    revenue: number | null;
    net_income: number | null;
    eps_basic: number | null;
    eps_diluted: number | null;
  }>;
  dividends: Array<{
    ex_dividend_date: string;
    pay_date: string;
    cash_amount: number;
    frequency: number;
  }>;
  splits: Array<{
    execution_date: string;
    split_from: number;
    split_to: number;
  }>;
  related_companies: Array<{ ticker: string }>;
}

// ============================================
// PHASE 1: MARKET BRIEFS INTERFACE
// ============================================
interface MarketBriefContext {
  briefType: string;
  title: string;
  executiveSummary: string;
  publishedAt: string;
  featuredAssets: string[];
  sentimentScore: number | null;
}

// ============================================
// PHASE 2: DERIVATIVES INTERFACE
// ============================================
interface DerivativesData {
  symbol: string;
  fundingRate: number;
  liquidations24h: {
    long: number;
    short: number;
    total: number;
  };
  openInterest?: number;
  source: string;
}

// ============================================
// PHASE 3: SOCIAL SENTIMENT INTERFACE
// ============================================
interface SocialSentimentData {
  symbol: string;
  name: string;
  galaxyScore: number;
  altRank: number;
  socialVolume: number;
  socialDominance: number;
  sentiment: number;
  fomoScore: number;
}

// ============================================
// PHASE 4: NEWS FEED INTERFACE
// ============================================
interface NewsItem {
  title: string;
  description: string;
  url: string;
  publishedAt: string;
  source: string;
  sentiment?: 'positive' | 'negative' | 'neutral';
  tickers?: string[];
}

interface AssetSentimentSnapshot {
  assetSymbol: string;
  assetName: string;
  sentimentScore: number;
  sentimentLabel: string;
  positiveCount: number;
  negativeCount: number;
  neutralCount: number;
  totalArticles: number;
  trendDirection: string | null;
}

// ============================================
// PHASE 5: TOKEN SECURITY & ON-CHAIN DATA
// ============================================
interface GoTokenSecurity {
  isHoneypot: boolean;
  isOpenSource: boolean;
  isProxy: boolean;
  isMintable: boolean;
  canTakeBackOwnership: boolean;
  ownerPercent: number;
  creatorPercent: number;
  holderCount: number;
  lpHolderCount: number;
  lpTotalSupplyLocked: number;
  buyTax: number;
  sellTax: number;
  isAntiWhale: boolean;
  slippageModifiable: boolean;
  isBlacklisted: boolean;
  tradingCooldown: boolean;
  transferPausable: boolean;
  tokenName: string;
  tokenSymbol: string;
}

interface DexScreenerData {
  symbol: string;
  name: string;
  priceUsd: number;
  priceChange24h: number;
  volume24h: number;
  liquidity: number;
  fdv: number;
  pairAddress: string;
  pairCreatedAt: string;
  dexId: string;
  chainId: string;
  txns24h: { buys: number; sells: number };
}

// CEX Listing interface for centralized exchange data
interface CexListing {
  exchange: string;
  volume24h: number;
  price: number;
  lastUpdated: string;
}

interface TokenSecurityContext {
  symbol: string;
  contractAddress: string;
  chain: string;
  goplus: GoTokenSecurity | null;
  dexscreener: DexScreenerData | null;
  cexListings: CexListing[];
  cexTotalVolume: number;
  coingeckoId: string | null;
  warnings: string[];
}

// ============================================
// PHASE 5: AI-POWERED QUESTION UNDERSTANDING (Gemini)
// ============================================

type QuestionType = 'price' | 'news' | 'technical' | 'general' | 'social' | 'derivatives' | 'greeting';

interface SmartRouteConfig {
  fetchTechnicals: boolean;
  fetchDerivatives: boolean;
  fetchSocial: boolean;
  fetchNews: boolean;
  fetchBriefs: boolean;
  fetchWebSearch: boolean;
}

// AI-parsed question understanding
interface QuestionUnderstanding {
  intent: 'price' | 'news' | 'analysis' | 'comparison' | 'general' | 'greeting' | 'safety';
  assets: Array<{
    symbol: string;
    name: string;
    type: 'crypto' | 'stock' | 'unknown';
    confidence: number;
    contractAddress?: string;
  }>;
  needsClarification: boolean;
  clarificationMessage: string | null;
  fetchData: {
    prices: boolean;
    news: boolean;
    technicals: boolean;
    companyDetails: boolean;
    webSearch: boolean;
    derivatives: boolean;
    social: boolean;
    securityCheck: boolean;
  };
}

// 🔧 FIX: Extract recently discussed assets from conversation history
// This helps maintain context for follow-up questions like "tell me more about this" or "is it safe?"
function extractRecentAssets(conversationHistory: Array<{role: string, content: string}>): string[] {
  const recentAssets: string[] = [];
  
  // Look at last 6 messages (3 exchanges) for asset mentions
  const recentMessages = conversationHistory.slice(-6);
  
  for (const msg of recentMessages) {
    if (!msg.content) continue;
    
    // Match ticker patterns: $BTC, BTC, PEPE, etc. (2-10 uppercase letters)
    // Also match tickers mentioned in context like "BSKT" or "Basketcoin"
    const tickerMatches = msg.content.match(/\$?[A-Z]{2,10}\b/g);
    if (tickerMatches) {
      for (const match of tickerMatches) {
        const ticker = match.replace('$', '');
        // Filter out common words that match the pattern
        const commonWords = ['THE', 'AND', 'FOR', 'NOT', 'YOU', 'ARE', 'BUT', 'HAS', 'HAD', 'WAS', 'HIS', 'HER', 
          'CAN', 'NOW', 'HOW', 'WHY', 'WHO', 'ALL', 'GET', 'NEW', 'ONE', 'TWO', 'OUT', 'OUR', 'DAY', 'ANY',
          'DEX', 'CEX', 'API', 'USD', 'EUR', 'GBP', 'NFT', 'DAO', 'TVL', 'APY', 'APR', 'ATH', 'ATL'];
        if (!commonWords.includes(ticker) && ticker.length >= 2) {
          recentAssets.push(ticker);
        }
      }
    }
  }
  
  // Dedupe and return most recent first
  return [...new Set(recentAssets)].reverse();
}

// Use Gemini (via Lovable AI) to understand the question
async function understandQuestion(
  userMessage: string, 
  conversationHistory: Array<{role: string, content: string}> = [],
  recentAssets: string[] = []  // 🔧 NEW: Pass recently discussed assets
): Promise<QuestionUnderstanding | null> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) {
    console.log("[Question Understanding] No LOVABLE_API_KEY, falling back to keyword matching");
    return null;
  }

  try {
    // Check if this is an answer to a clarification question
    const assistantMessages = conversationHistory.filter(m => m.role === 'assistant');
    const lastAssistantMsg = assistantMessages[assistantMessages.length - 1];
    const userMessages = conversationHistory.filter(m => m.role === 'user');
    
    const isClarificationAnswer = lastAssistantMsg?.content && (
      lastAssistantMsg.content.includes('Please let me know which one') ||
      lastAssistantMsg.content.includes('Please specify') ||
      lastAssistantMsg.content.includes('which one you\'re asking about') ||
      lastAssistantMsg.content.includes('Could you clarify') ||
      lastAssistantMsg.content.includes('Did you mean')
    );

    let contextualMessage = userMessage;
    if (isClarificationAnswer && userMessages.length >= 2) {
      // Get the original question (before this answer)
      const originalQuestion = userMessages[userMessages.length - 2]?.content;
      if (originalQuestion) {
        contextualMessage = `Original question: "${originalQuestion}". User's clarification/answer: "${userMessage}"`;
        console.log(`[Question Understanding] Detected clarification answer, combined context: ${contextualMessage}`);
      }
    }

    console.log("[Question Understanding] Parsing with Gemini...");
    
    // 🔧 FIX: Build context hint from recently discussed assets
    const recentAssetsContext = recentAssets.length > 0 
      ? `\n\nCONVERSATION CONTEXT: User recently discussed these assets: ${recentAssets.slice(0, 5).join(', ')}. If user says "this", "it", "that", or refers to something they just discussed, assume they mean: ${recentAssets[0]}`
      : '';

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        max_tokens: 300,
        messages: [{
          role: "user",
          content: `Parse this financial/crypto question and return ONLY valid JSON (no markdown, no code blocks):

"${contextualMessage}"${recentAssetsContext}

Return this exact JSON structure:
{
  "intent": "price|news|analysis|comparison|general|greeting|safety|content|verification",
  "assets": [{"symbol": "BTC", "name": "Bitcoin", "type": "crypto", "confidence": 0.95, "contractAddress": null}],
  "needsClarification": false,
  "clarificationMessage": null,
  "fetchData": {
    "prices": true,
    "news": false,
    "technicals": false,
    "companyDetails": false,
    "webSearch": false,
    "derivatives": false,
    "social": false,
    "securityCheck": false
  }
}

CRITICAL RULES:
1. Common question words are NOT assets: news, latest, price, stock, crypto, market, update, what, how, why, tell, show, find, today, current, safe, risk, scam
2. "news about NVIDIA" → asset is {symbol:"NVDA", name:"NVIDIA", type:"stock"}, intent is "news"
3. "what's the price of ETH" → asset is {symbol:"ETH", name:"Ethereum", type:"crypto"}, intent is "price"
4. Greetings like "hi", "hello", "hey" → intent:"greeting", assets:[], no data fetching needed
5. **AVOID UNNECESSARY CLARIFICATION**: If user mentions a ticker by name or symbol, resolve it - DO NOT ask for clarification unless there are multiple tokens with the EXACT same symbol. If user says "this", "it", "that" token, use the most recently discussed asset from CONVERSATION CONTEXT.
6. Only enable fetchData fields that are ACTUALLY needed:
   - "price" questions → prices:true, technicals:true
   - "news" questions → news:true, webSearch:true, social:true
   - "analysis" questions → prices:true, technicals:true, derivatives:true, social:true
   - "comparison" questions → prices:true, social:true
   - "greeting" → all false
   - companyDetails:true ONLY for stocks
   - "safety" questions → securityCheck:true, social:true, news:true
   - "content" questions (make a post, write about, tweet) → social:true, news:true
   - "verification" questions → prices:true, securityCheck:true
7. SAFETY INTENT: Questions about safety, scams, rugs, risks, legitimacy, honeypots, "should I buy", "is X legit", "is X safe" → intent:"safety", securityCheck:true
8. CONTENT INTENT: Requests to "make a post", "write about", "tweet", "create content" → intent:"content", use asset from context
9. VERIFICATION INTENT: Questions like "is this the address", "is this correct", "is this right", "verify this", "confirm this address" → intent:"verification". The user is asking you to VERIFY information they're seeing. Use the asset from CONVERSATION CONTEXT. DO NOT ask for the address - they're asking you to confirm what they see.
10. Stock symbols: AAPL, NVDA, TSLA, MSFT, GOOG, AMZN, META, COIN, MSTR, etc.
11. Crypto symbols: BTC, ETH, SOL, XRP, ADA, DOGE, LINK, AVAX, etc.
12. If user provides a contract address (0x... or Solana base58), include it in contractAddress field
13. FOLLOW-UP QUESTIONS: If the user is clearly asking a follow-up about something they just discussed (e.g., "is it safe?", "make a post about this", "where can I buy it", "is this the address"), use the asset from CONVERSATION CONTEXT - DO NOT ask for clarification

Return ONLY the JSON object, nothing else.`
        }]
      })
    });

    if (!response.ok) {
      console.error("[Question Understanding] Gemini error:", response.status);
      return null;
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    
    if (!content) {
      console.error("[Question Understanding] No content in response");
      return null;
    }

    // Parse JSON, handling potential markdown code blocks
    let jsonStr = content.trim();
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }
    
    const parsed = JSON.parse(jsonStr) as QuestionUnderstanding;
    console.log(`[Question Understanding] Intent: ${parsed.intent}, Assets: ${parsed.assets.map(a => a.symbol).join(', ')}, Clarification: ${parsed.needsClarification}`);
    
    return parsed;
  } catch (error) {
    console.error("[Question Understanding] Error:", error);
    return null;
  }
}

// Convert AI understanding to question types (for backward compatibility)
function understandingToQuestionTypes(understanding: QuestionUnderstanding): Set<QuestionType> {
  const types = new Set<QuestionType>();
  
  switch (understanding.intent) {
    case 'price':
      types.add('price');
      break;
    case 'news':
      types.add('news');
      break;
    case 'analysis':
      types.add('technical');
      types.add('price');
      break;
    case 'comparison':
      types.add('social');
      types.add('price');
      break;
    case 'safety':
      types.add('social');
      types.add('news');
      break;
    case 'greeting':
      types.add('general');
      break;
    default:
      types.add('general');
  }
  
  // Add additional types based on fetchData flags
  if (understanding.fetchData.derivatives) types.add('derivatives');
  if (understanding.fetchData.social) types.add('social');
  if (understanding.fetchData.news) types.add('news');
  if (understanding.fetchData.technicals) types.add('technical');
  
  return types;
}

// Extended smart routing config with security
interface SmartRouteConfigExtended extends SmartRouteConfig {
  fetchSecurityCheck: boolean;
}

// Generate smart routing config from AI understanding
function getSmartRouteConfigFromUnderstanding(understanding: QuestionUnderstanding): SmartRouteConfigExtended {
  return {
    fetchTechnicals: understanding.fetchData.technicals || understanding.fetchData.prices,
    fetchDerivatives: understanding.fetchData.derivatives,
    fetchSocial: understanding.fetchData.social,
    fetchNews: understanding.fetchData.news,
    fetchBriefs: understanding.fetchData.news || understanding.intent === 'analysis',
    fetchWebSearch: understanding.fetchData.webSearch,
    fetchSecurityCheck: understanding.fetchData.securityCheck || understanding.intent === 'safety'
  };
}

// Fallback: Generate smart routing config based on question types (keyword-based)
function getSmartRouteConfig(questionTypes: Set<QuestionType>, hasCrypto: boolean, hasStocks: boolean): SmartRouteConfig {
  // General questions get everything relevant
  if (questionTypes.has('general')) {
    return {
      fetchTechnicals: true,
      fetchDerivatives: hasCrypto,
      fetchSocial: hasCrypto,
      fetchNews: true,
      fetchBriefs: true,
      fetchWebSearch: false
    };
  }
  
  return {
    fetchTechnicals: questionTypes.has('technical') || questionTypes.has('price'),
    fetchDerivatives: hasCrypto && (questionTypes.has('derivatives') || questionTypes.has('price')),
    fetchSocial: hasCrypto && (questionTypes.has('social') || questionTypes.has('news')),
    fetchNews: questionTypes.has('news'),
    fetchBriefs: questionTypes.has('news') || questionTypes.has('general'),
    fetchWebSearch: questionTypes.has('news')
  };
}

// Fallback keyword-based detection (used when Gemini fails)
function detectQuestionTypesKeyword(message: string): Set<QuestionType> {
  const lowerMessage = message.toLowerCase();
  const types = new Set<QuestionType>();
  
  const PRICE_KEYWORDS = ['price', 'cost', 'worth', 'value', 'market cap', 'mcap', 'volume', 'change', 'up', 'down', 'pump', 'dump', 'ath', 'atl', 'high', 'low', 'how much'];
  const TECHNICAL_KEYWORDS = ['rsi', 'macd', 'sma', 'ema', 'moving average', 'bollinger', 'support', 'resistance', 'oversold', 'overbought', 'technical', 'indicator', 'chart'];
  const NEWS_KEYWORDS = ['news', 'latest', 'update', 'announced', 'announcement', 'release', 'launch', 'partnership', 'why', 'happened', 'happening'];
  const DERIVATIVES_KEYWORDS = ['funding', 'funding rate', 'liquidation', 'leverage', 'long', 'short', 'open interest', 'futures', 'perp', 'perpetual'];
  const SOCIAL_KEYWORDS = ['sentiment', 'social', 'twitter', 'reddit', 'community', 'hype', 'trending', 'viral', 'galaxy score', 'altrank', 'fomo'];
  
  if (PRICE_KEYWORDS.some(kw => lowerMessage.includes(kw))) types.add('price');
  if (TECHNICAL_KEYWORDS.some(kw => lowerMessage.includes(kw))) types.add('technical');
  if (NEWS_KEYWORDS.some(kw => lowerMessage.includes(kw))) types.add('news');
  if (DERIVATIVES_KEYWORDS.some(kw => lowerMessage.includes(kw))) types.add('derivatives');
  if (SOCIAL_KEYWORDS.some(kw => lowerMessage.includes(kw))) types.add('social');
  
  if (types.size === 0) types.add('general');
  
  return types;
}

// Common words to filter out from symbol/name extraction
const COMMON_WORDS = new Set([
  'THE', 'AND', 'FOR', 'ARE', 'BUT', 'NOT', 'YOU', 'ALL', 'CAN', 'HER', 
  'WAS', 'ONE', 'OUR', 'OUT', 'DAY', 'HAD', 'HOW', 'ITS', 'MAY', 'NEW', 
  'NOW', 'OLD', 'SEE', 'WAY', 'WHO', 'BOY', 'DID', 'GET', 'HAS', 'HIM', 
  'HIS', 'LET', 'PUT', 'SAY', 'TOO', 'USE', 'WHY', 'WHAT', 'WHEN', 'WHERE',
  'WHICH', 'THIS', 'THAT', 'WILL', 'WOULD', 'COULD', 'SHOULD', 'WITH',
  'TELL', 'ABOUT', 'DOING', 'GOING', 'DOWN', 'LIKE', 'GOOD', 'BAD',
  'BEST', 'WORST', 'MORE', 'MOST', 'SOME', 'MANY', 'MUCH', 'VERY',
  'JUST', 'ONLY', 'ALSO', 'EVEN', 'WELL', 'BACK', 'BEEN', 'BEING',
  'BOTH', 'EACH', 'FROM', 'HAVE', 'HERE', 'INTO', 'JUST', 'KNOW',
  'LAST', 'LONG', 'MAKE', 'OVER', 'SUCH', 'TAKE', 'THAN', 'THEM',
  'THEN', 'THERE', 'THESE', 'THEY', 'TIME', 'VERY', 'WANT', 'WHAT',
  'YEAR', 'YOUR', 'LOOK', 'THINK', 'PRICE', 'COIN', 'CRYPTO', 'TOKEN',
  'MARKET', 'BUY', 'SELL', 'HOLD', 'MOON', 'PUMP', 'DUMP', 'STOCK',
  'STOCKS', 'ANALYSIS', 'ANALYZE', 'SHOW', 'GIVE', 'INFO', 'DATA'
]);

const COMMON_WORDS_LOWER = new Set([
  'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'her',
  'was', 'one', 'our', 'out', 'day', 'had', 'how', 'its', 'may', 'new',
  'price', 'going', 'doing', 'down', 'tell', 'about', 'what', 'why',
  'think', 'look', 'like', 'good', 'bad', 'best', 'worst', 'more',
  'coin', 'crypto', 'token', 'market', 'buy', 'sell', 'hold', 'moon',
  'pump', 'dump', 'will', 'would', 'could', 'should', 'with', 'from',
  'have', 'been', 'being', 'this', 'that', 'these', 'they', 'them',
  'there', 'where', 'when', 'which', 'know', 'just', 'only', 'also',
  'even', 'well', 'back', 'both', 'each', 'here', 'into', 'last',
  'long', 'make', 'over', 'such', 'take', 'than', 'then', 'time',
  'very', 'want', 'year', 'your', 'some', 'many', 'much', 'most',
  'stock', 'stocks', 'analysis', 'analyze', 'show', 'give', 'info', 'data',
  // Question/news words that shouldn't match company names
  'news', 'latest', 'recent', 'today', 'update', 'updates',
  'happening', 'currently', 'right', 'now', 'whats', "what's",
  'find', 'search', 'prices', 'cost', 'worth', 'value', 'markets'
]);

// Extract contract addresses from message text (EVM + Solana)
function extractContractAddresses(message: string): { address: string; type: 'evm' | 'solana' }[] {
  const addresses: { address: string; type: 'evm' | 'solana' }[] = [];
  
  // Match EVM addresses (0x + 40 hex chars)
  const evmPattern = /0x[a-fA-F0-9]{40}/g;
  const evmMatches = message.match(evmPattern);
  if (evmMatches) {
    evmMatches.forEach(addr => {
      addresses.push({ address: addr.toLowerCase(), type: 'evm' });
    });
  }
  
  // Match Solana addresses (base58, 32-44 chars, no 0/O/I/l)
  const solPattern = /\b[1-9A-HJ-NP-Za-km-z]{32,44}\b/g;
  const solMatches = message.match(solPattern);
  if (solMatches) {
    // Filter to likely Solana addresses (avoid matching regular words)
    solMatches.forEach(addr => {
      // Must contain at least some uppercase and lowercase mix + numbers
      if (addr.length >= 32 && /[A-Z]/.test(addr) && /[a-z]/.test(addr) && /[0-9]/.test(addr)) {
        addresses.push({ address: addr, type: 'solana' });
      }
    });
  }
  
  return addresses;
}

// Resolve a contract address to an asset
async function resolveContractAddress(supabase: any, address: string, type: 'evm' | 'solana'): Promise<ResolvedAsset | null> {
  const normalizedAddr = address.toLowerCase();
  console.log(`Resolving contract address: ${normalizedAddr} (${type})`);
  
  // 1. Check ticker_mappings.dex_address for direct match
  const { data: dexMatch } = await supabase
    .from('ticker_mappings')
    .select('symbol, display_name, coingecko_id, polygon_ticker, type, dex_chain')
    .eq('is_active', true)
    .ilike('dex_address', normalizedAddr)
    .maybeSingle();
  
  if (dexMatch) {
    console.log(`Found contract in ticker_mappings.dex_address: ${dexMatch.symbol}`);
    return {
      symbol: dexMatch.symbol,
      coingeckoId: dexMatch.coingecko_id,
      displayName: dexMatch.display_name,
      assetType: dexMatch.type === 'stock' ? 'stock' : 'crypto',
      polygonTicker: dexMatch.polygon_ticker
    };
  }
  
  // 2. Check ticker_mappings.dex_platforms JSON for multi-chain addresses
  const { data: platformMatches } = await supabase
    .from('ticker_mappings')
    .select('symbol, display_name, coingecko_id, polygon_ticker, type, dex_platforms')
    .eq('is_active', true)
    .not('dex_platforms', 'is', null);
  
  if (platformMatches) {
    for (const match of platformMatches) {
      if (match.dex_platforms) {
        const platforms = typeof match.dex_platforms === 'string' 
          ? JSON.parse(match.dex_platforms) 
          : match.dex_platforms;
        
        // Check each platform's address
        for (const [chain, addr] of Object.entries(platforms)) {
          if (typeof addr === 'string' && addr.toLowerCase() === normalizedAddr) {
            console.log(`Found contract in ticker_mappings.dex_platforms[${chain}]: ${match.symbol}`);
            return {
              symbol: match.symbol,
              coingeckoId: match.coingecko_id,
              displayName: match.display_name,
              assetType: match.type === 'stock' ? 'stock' : 'crypto',
              polygonTicker: match.polygon_ticker
            };
          }
        }
      }
    }
  }
  
  // 3. Check cg_master.platforms JSON for 18,000+ tokens
  const { data: cgMatches } = await supabase
    .from('cg_master')
    .select('symbol, name, cg_id, platforms')
    .not('platforms', 'is', null);
  
  if (cgMatches) {
    for (const match of cgMatches) {
      if (match.platforms) {
        const platforms = typeof match.platforms === 'string'
          ? JSON.parse(match.platforms)
          : match.platforms;
        
        for (const [chain, addr] of Object.entries(platforms)) {
          if (typeof addr === 'string' && addr.toLowerCase() === normalizedAddr) {
            console.log(`Found contract in cg_master.platforms[${chain}]: ${match.symbol} (${match.cg_id})`);
            return {
              symbol: match.symbol.toUpperCase(),
              coingeckoId: match.cg_id,
              displayName: match.name,
              assetType: 'crypto'
            };
          }
        }
      }
    }
  }
  
  // 4. Check crypto_snapshot.blockchains for LunarCrush-sourced addresses
  const { data: snapshotData } = await supabase
    .from('crypto_snapshot')
    .select('symbol, name, blockchains, coingecko_id')
    .not('blockchains', 'is', null);
  
  if (snapshotData) {
    for (const snapshot of snapshotData) {
      if (snapshot.blockchains && Array.isArray(snapshot.blockchains)) {
        for (const blockchain of snapshot.blockchains) {
          const blockchainAddr = blockchain.address?.toLowerCase();
          if (blockchainAddr === normalizedAddr) {
            console.log(`Found contract in crypto_snapshot.blockchains: ${snapshot.symbol}`);
            return {
              symbol: snapshot.symbol.toUpperCase(),
              coingeckoId: snapshot.coingecko_id,
              displayName: snapshot.name,
              assetType: 'crypto'
            };
          }
        }
      }
    }
  }
  
  console.log(`Contract address not found in database: ${normalizedAddr}`);
  return null;
}

// CoinGecko contract address lookup (supports multiple EVM chains + Solana)
async function lookupContractOnCoinGecko(address: string): Promise<{
  symbol: string;
  name: string;
  description?: string;
  marketData?: { price: number; marketCap: number; volume24h: number; change24h: number };
  chain?: string;
} | null> {
  const COINGECKO_API_KEY = Deno.env.get('COINGECKO_API_KEY');
  if (!COINGECKO_API_KEY) {
    console.log('[CoinGecko Contract] No API key, skipping');
    return null;
  }
  
  const normalizedAddr = address.toLowerCase();
  const isEvm = /^0x[a-fA-F0-9]{40}$/.test(normalizedAddr);
  const isSolana = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address) && !normalizedAddr.startsWith('0x');
  
  // Define platform IDs to try based on address type
  const platformsToTry = isEvm 
    ? ['ethereum', 'polygon-pos', 'arbitrum-one', 'base', 'binance-smart-chain', 'avalanche', 'optimistic-ethereum']
    : isSolana 
    ? ['solana']
    : [];
  
  if (platformsToTry.length === 0) {
    console.log(`[CoinGecko Contract] Unknown address format: ${address.slice(0, 10)}...`);
    return null;
  }
  
  console.log(`[CoinGecko Contract] Trying ${platformsToTry.length} chains for ${normalizedAddr.slice(0, 10)}...`);
  
  for (const platform of platformsToTry) {
    try {
      const url = `https://pro-api.coingecko.com/api/v3/coins/${platform}/contract/${normalizedAddr}?x_cg_pro_api_key=${COINGECKO_API_KEY}`;
      const response = await fetch(url);
      
      if (response.ok) {
        const data = await response.json();
        console.log(`[CoinGecko Contract] Found on ${platform}: ${data.symbol?.toUpperCase()} (${data.name})`);
        
        return {
          symbol: data.symbol?.toUpperCase() || 'UNKNOWN',
          name: data.name || 'Unknown Token',
          description: data.description?.en?.slice(0, 500) || undefined,
          chain: platform,
          marketData: data.market_data ? {
            price: data.market_data.current_price?.usd || 0,
            marketCap: data.market_data.market_cap?.usd || 0,
            volume24h: data.market_data.total_volume?.usd || 0,
            change24h: data.market_data.price_change_percentage_24h || 0
          } : undefined
        };
      } else if (response.status !== 404) {
        console.log(`[CoinGecko Contract] ${platform} returned ${response.status}`);
      }
    } catch (e) {
      console.log(`[CoinGecko Contract] Error checking ${platform}:`, (e as Error).message);
    }
  }
  
  console.log(`[CoinGecko Contract] Not found on any chain: ${normalizedAddr.slice(0, 10)}...`);
  return null;
}

// Web search for unknown contract addresses (LP tokens, DEX pairs, new tokens)
async function lookupContractAddressOnWeb(address: string): Promise<{ description: string; tokenInfo: string } | null> {
  const TAVILY_API_KEY = Deno.env.get('TAVILY_API_KEY');
  if (!TAVILY_API_KEY) {
    console.log('[Contract Lookup] No Tavily API key, skipping web search');
    return null;
  }

  try {
    console.log(`[Contract Lookup] Searching web for address: ${address}`);
    
    const response = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: TAVILY_API_KEY,
        query: `${address} token contract crypto blockchain`,
        search_depth: "basic",
        max_results: 5,
        include_answer: true,
        include_domains: [
          "etherscan.io", "bscscan.com", "polygonscan.com", "arbiscan.io",
          "solscan.io", "dexscreener.com", "dextools.io", "geckoterminal.com",
          "coingecko.com", "coinmarketcap.com", "defined.fi"
        ]
      })
    });

    if (!response.ok) {
      console.error(`[Contract Lookup] Tavily error: ${response.status}`);
      return null;
    }

    const data = await response.json();
    console.log(`[Contract Lookup] Found ${data.results?.length || 0} results`);
    
    if (!data.results || data.results.length === 0) {
      return null;
    }

    // Extract relevant info from search results
    const descriptions = data.results
      .slice(0, 3)
      .map((r: any) => `• ${r.title}: ${r.content?.slice(0, 200) || ''}`)
      .join('\n');
    
    const sources = data.results
      .slice(0, 3)
      .map((r: any) => r.url)
      .join(', ');

    return {
      description: descriptions,
      tokenInfo: data.answer || `Web search found information about this address. Sources: ${sources}`
    };
  } catch (e) {
    console.error("[Contract Lookup] Error:", e);
    return null;
  }
}

// Extract potential symbols from message text
function extractPotentialSymbols(message: string): string[] {
  const symbols: string[] = [];
  
  // Match $SYMBOL patterns (e.g., $BTC, $MON, $AAPL)
  const dollarMatches = message.match(/\$([A-Za-z]{2,10})/g);
  if (dollarMatches) {
    dollarMatches.forEach(match => {
      symbols.push(match.slice(1).toUpperCase());
    });
  }
  
  // Match standalone uppercase symbols (2-6 chars)
  const upperMatches = message.match(/\b([A-Z]{2,6})\b/g);
  if (upperMatches) {
    upperMatches.forEach(match => {
      if (!COMMON_WORDS.has(match)) {
        symbols.push(match);
      }
    });
  }
  
  // Check for known crypto aliases in lowercase text (e.g., "eth", "bitcoin", "solana")
  const lowerMessage = message.toLowerCase();
  const words = lowerMessage.split(/[^a-z]+/).filter(w => w.length >= 2);
  for (const word of words) {
    if (CRYPTO_ALIASES[word]) {
      symbols.push(CRYPTO_ALIASES[word]);
    }
  }
  
  return [...new Set(symbols)]; // Dedupe
}

// Extract potential coin names from message for name-based search (only meaningful words)
function extractPotentialNames(message: string): string[] {
  const lowerMessage = message.toLowerCase();
  const words = lowerMessage.split(/\s+/).filter(w => 
    w.length >= 4 && !COMMON_WORDS_LOWER.has(w)
  );
  
  return [...new Set(words)];
}

// Calculate simple string similarity (Levenshtein-based)
function stringSimilarity(s1: string, s2: string): number {
  const longer = s1.length > s2.length ? s1 : s2;
  const shorter = s1.length > s2.length ? s2 : s1;
  
  if (longer.length === 0) return 1.0;
  
  const editDistance = (a: string, b: string): number => {
    const matrix: number[][] = [];
    for (let i = 0; i <= b.length; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= a.length; j++) {
      matrix[0][j] = j;
    }
    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    return matrix[b.length][a.length];
  };
  
  return (longer.length - editDistance(longer, shorter)) / longer.length;
}

// Find similar assets when exact match not found
async function findSimilarAssets(supabase: any, searchTerms: string[]): Promise<SimilarAsset[]> {
  const similar: SimilarAsset[] = [];
  
  for (const term of searchTerms.slice(0, 3)) {
    const termLower = term.toLowerCase();
    const termUpper = term.toUpperCase();
    
    // Search by partial symbol match
    const { data: symbolMatches } = await supabase
      .from('ticker_mappings')
      .select('symbol, display_name, type')
      .eq('is_active', true)
      .or(`symbol.ilike.%${termUpper}%,display_name.ilike.%${termLower}%`)
      .limit(10);
    
    if (symbolMatches) {
      for (const match of symbolMatches) {
        const symSim = stringSimilarity(termUpper, match.symbol);
        const nameSim = stringSimilarity(termLower, match.display_name.toLowerCase());
        const maxSim = Math.max(symSim, nameSim);
        
        if (maxSim >= 0.4 && !similar.find(s => s.symbol === match.symbol)) {
          similar.push({
            symbol: match.symbol,
            displayName: match.display_name,
            type: match.type,
            similarity: maxSim
          });
        }
      }
    }
  }
  
  // Sort by similarity and return top 5
  return similar.sort((a, b) => b.similarity - a.similarity).slice(0, 5);
}

// Resolve assets from database (crypto + stocks + contract addresses)
async function resolveAssetsFromDatabase(supabase: any, message: string): Promise<{ assets: ResolvedAsset[], similar: SimilarAsset[], contractsSearched: string[], contractWebLookups: Array<{address: string, info: string}> }> {
  const resolved: ResolvedAsset[] = [];
  const foundSymbols = new Set<string>();
  const contractsSearched: string[] = [];
  const contractWebLookups: Array<{address: string, info: string}> = [];
  
  // Step 0: Check for contract addresses FIRST
  const contractAddresses = extractContractAddresses(message);
  if (contractAddresses.length > 0) {
    console.log(`Found ${contractAddresses.length} contract address(es) in message`);
    for (const { address, type } of contractAddresses) {
      contractsSearched.push(address);
      
      // 1. Check database first (instant)
      const contractAsset = await resolveContractAddress(supabase, address, type);
      if (contractAsset && !foundSymbols.has(contractAsset.symbol)) {
        resolved.push(contractAsset);
        foundSymbols.add(contractAsset.symbol);
        console.log(`Resolved contract ${address} -> ${contractAsset.symbol} (from database)`);
        continue;
      }
      
      // 2. Try CoinGecko API (fast, ~200ms)
      const cgResult = await lookupContractOnCoinGecko(address);
      if (cgResult) {
        console.log(`Resolved contract ${address} -> ${cgResult.symbol} (from CoinGecko ${cgResult.chain})`);
        
        // Add as resolved asset with market data context
        resolved.push({
          symbol: cgResult.symbol,
          coingeckoId: null, // Could look up later if needed
          displayName: cgResult.name,
          assetType: 'crypto',
        });
        foundSymbols.add(cgResult.symbol);
        
        // Also add to web lookups for rich context in prompt
        let contextInfo = `${cgResult.name} (${cgResult.symbol}) on ${cgResult.chain}`;
        if (cgResult.marketData) {
          contextInfo += `\nPrice: $${cgResult.marketData.price.toLocaleString()} (${cgResult.marketData.change24h >= 0 ? '+' : ''}${cgResult.marketData.change24h.toFixed(2)}%)`;
          contextInfo += `\nMarket Cap: $${(cgResult.marketData.marketCap / 1e6).toFixed(2)}M`;
          contextInfo += `\n24h Volume: $${(cgResult.marketData.volume24h / 1e6).toFixed(2)}M`;
        }
        if (cgResult.description) {
          contextInfo += `\n\n${cgResult.description}`;
        }
        contractWebLookups.push({ address, info: contextInfo });
        continue;
      }
      
      // 3. Fallback to web search for LP tokens, DEX pairs, very new tokens
      const webResult = await lookupContractAddressOnWeb(address);
      if (webResult) {
        console.log(`[Contract] Web lookup found info for ${address}`);
        contractWebLookups.push({
          address,
          info: `${webResult.tokenInfo}\n\nDetails:\n${webResult.description}`
        });
      }
    }
  }
  
  const potentialSymbols = extractPotentialSymbols(message);
  const potentialNames = extractPotentialNames(message);
  
  console.log(`Potential symbols: ${potentialSymbols.join(', ')}`);
  console.log(`Potential names: ${potentialNames.slice(0, 10).join(', ')}...`);
  
  // Step 1: Check ticker_mappings for exact symbol matches (crypto + stocks)
  if (potentialSymbols.length > 0) {
    for (const sym of potentialSymbols) {
      // Check exact symbol match (any type)
      const { data: exactMatch } = await supabase
        .from('ticker_mappings')
        .select('symbol, coingecko_id, display_name, type, polygon_ticker')
        .eq('is_active', true)
        .ilike('symbol', sym)
        .maybeSingle();
      
      if (exactMatch && !foundSymbols.has(exactMatch.symbol)) {
        console.log(`Found exact match: ${sym} -> ${exactMatch.symbol} (${exactMatch.type})`);
        resolved.push({
          symbol: exactMatch.symbol,
          coingeckoId: exactMatch.coingecko_id,
          displayName: exactMatch.display_name,
          assetType: exactMatch.type === 'stock' ? 'stock' : 'crypto',
          polygonTicker: exactMatch.polygon_ticker
        });
        foundSymbols.add(exactMatch.symbol);
        continue;
      }
      
      // Check aliases (crypto)
      const { data: aliasMatch } = await supabase
        .from('ticker_mappings')
        .select('symbol, coingecko_id, display_name, type, polygon_ticker, aliases')
        .eq('is_active', true)
        .contains('aliases', [sym.toLowerCase()])
        .maybeSingle();
      
      if (aliasMatch && !foundSymbols.has(aliasMatch.symbol)) {
        console.log(`Found alias match: ${sym} -> ${aliasMatch.symbol}`);
        resolved.push({
          symbol: aliasMatch.symbol,
          coingeckoId: aliasMatch.coingecko_id,
          displayName: aliasMatch.display_name,
          assetType: aliasMatch.type === 'stock' ? 'stock' : 'crypto',
          polygonTicker: aliasMatch.polygon_ticker
        });
        foundSymbols.add(aliasMatch.symbol);
        continue;
      }
      
      // Fallback to cg_master for crypto symbol match
      const { data: cgMatch } = await supabase
        .from('cg_master')
        .select('symbol, cg_id, name')
        .ilike('symbol', sym)
        .limit(1)
        .maybeSingle();
      
      if (cgMatch?.cg_id && !foundSymbols.has(cgMatch.symbol.toUpperCase())) {
        console.log(`Found in cg_master: ${sym} -> ${cgMatch.symbol} (${cgMatch.cg_id})`);
        resolved.push({
          symbol: cgMatch.symbol.toUpperCase(),
          coingeckoId: cgMatch.cg_id,
          displayName: cgMatch.name,
          assetType: 'crypto'
        });
        foundSymbols.add(cgMatch.symbol.toUpperCase());
      }
    }
  }
  
  // Step 2: Search by name if no symbols found
  if (resolved.length === 0 && potentialNames.length > 0) {
    for (const name of potentialNames.slice(0, 3)) {
      if (name.length < 4) continue;
      
      // Try name match in ticker_mappings
      const { data: nameMatch } = await supabase
        .from('ticker_mappings')
        .select('symbol, coingecko_id, display_name, type, polygon_ticker')
        .eq('is_active', true)
        .or(`display_name.ilike.${name}%,display_name.ilike.%${name}%`)
        .limit(1)
        .maybeSingle();
      
      if (nameMatch && !foundSymbols.has(nameMatch.symbol)) {
        console.log(`Found name match: "${name}" -> ${nameMatch.symbol}`);
        resolved.push({
          symbol: nameMatch.symbol,
          coingeckoId: nameMatch.coingecko_id,
          displayName: nameMatch.display_name,
          assetType: nameMatch.type === 'stock' ? 'stock' : 'crypto',
          polygonTicker: nameMatch.polygon_ticker
        });
        foundSymbols.add(nameMatch.symbol);
        break;
      }
      
      // Check aliases
      const { data: aliasNameMatch } = await supabase
        .from('ticker_mappings')
        .select('symbol, coingecko_id, display_name, type, polygon_ticker')
        .eq('is_active', true)
        .contains('aliases', [name])
        .limit(1)
        .maybeSingle();
      
      if (aliasNameMatch && !foundSymbols.has(aliasNameMatch.symbol)) {
        console.log(`Found alias name match: "${name}" -> ${aliasNameMatch.symbol}`);
        resolved.push({
          symbol: aliasNameMatch.symbol,
          coingeckoId: aliasNameMatch.coingecko_id,
          displayName: aliasNameMatch.display_name,
          assetType: aliasNameMatch.type === 'stock' ? 'stock' : 'crypto',
          polygonTicker: aliasNameMatch.polygon_ticker
        });
        foundSymbols.add(aliasNameMatch.symbol);
        break;
      }
    }
  }
  
  // Step 3: If still nothing found, find similar assets for suggestions
  let similarAssets: SimilarAsset[] = [];
  if (resolved.length === 0) {
    const allTerms = [...potentialSymbols.map(s => s.toLowerCase()), ...potentialNames];
    if (allTerms.length > 0) {
      similarAssets = await findSimilarAssets(supabase, allTerms);
      console.log(`Found ${similarAssets.length} similar assets for suggestions`);
    }
  }
  
  return { assets: resolved.slice(0, 5), similar: similarAssets, contractsSearched, contractWebLookups };
}

// Fetch historical context from Polygon
async function fetchHistoricalContext(supabase: any, asset: ResolvedAsset): Promise<HistoricalContext | null> {
  try {
    const to = new Date().toISOString().split('T')[0];
    const fromDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const from = fromDate.toISOString().split('T')[0];
    
    const ticker = asset.polygonTicker || asset.symbol;
    
    console.log(`Fetching historical data for ${asset.symbol} (ticker: ${ticker}, type: ${asset.assetType})`);
    
    const { data, error } = await supabase.functions.invoke('polygon-historical-data', {
      body: { 
        ticker, 
        timeframe: '1day', 
        from, 
        to, 
        asset_type: asset.assetType 
      }
    });
    
    if (error || !data?.bars?.length) {
      console.log(`No historical data for ${asset.symbol}: ${error?.message || 'no bars returned'}`);
      return null;
    }
    
    const bars = data.bars;
    const firstPrice = bars[0].close;
    const lastPrice = bars[bars.length - 1].close;
    const change30d = ((lastPrice - firstPrice) / firstPrice) * 100;
    const high30d = Math.max(...bars.map((b: any) => b.high));
    const low30d = Math.min(...bars.map((b: any) => b.low));
    const avgVolume = bars.reduce((sum: number, b: any) => sum + b.volume, 0) / bars.length;
    
    console.log(`Historical for ${asset.symbol}: ${change30d.toFixed(2)}% over 30d`);
    
    return {
      symbol: asset.symbol,
      change30d,
      high30d,
      low30d,
      avgVolume
    };
  } catch (e) {
    console.error(`Error fetching historical for ${asset.symbol}:`, e);
    return null;
  }
}

// Fetch technical indicators from Polygon
async function fetchTechnicalIndicators(supabase: any, asset: ResolvedAsset): Promise<TechnicalIndicators | null> {
  try {
    const ticker = asset.polygonTicker || asset.symbol;
    
    console.log(`Fetching technical indicators for ${asset.symbol} (ticker: ${ticker}, type: ${asset.assetType})`);
    
    const { data, error } = await supabase.functions.invoke('polygon-technical-indicators', {
      body: { 
        tickers: [ticker], 
        indicators: ['rsi', 'macd', 'sma_50', 'ema_20'],
        timeframe: 'daily',
        asset_type: asset.assetType
      }
    });
    
    if (error || !data?.success) {
      console.log(`No technical indicators for ${asset.symbol}: ${error?.message || 'request failed'}`);
      return null;
    }
    
    const indicators = data.data?.[ticker] || data.data?.[`X:${ticker}USD`] || data.data?.[asset.symbol];
    if (!indicators) {
      console.log(`No indicator data found for ${asset.symbol} in response keys: ${Object.keys(data.data || {}).join(', ')}`);
      return null;
    }
    
    const result: TechnicalIndicators = { symbol: asset.symbol };
    
    if (indicators.rsi?.value) {
      const rsiVal = indicators.rsi.value;
      result.rsi = {
        value: rsiVal,
        signal: rsiVal > 70 ? 'Overbought ⚠️' : rsiVal < 30 ? 'Oversold ⚠️' : 'Neutral ✅'
      };
    }
    
    if (indicators.macd) {
      const hist = indicators.macd.histogram || 0;
      result.macd = {
        histogram: hist,
        signal: hist > 0 ? 'Bullish 🟢' : 'Bearish 🔴'
      };
    }
    
    if (indicators.sma_50?.value) result.sma50 = indicators.sma_50.value;
    if (indicators.ema_20?.value) result.ema20 = indicators.ema_20.value;
    
    console.log(`Technical indicators for ${asset.symbol}: RSI=${result.rsi?.value}, MACD=${result.macd?.signal}`);
    
    return result;
  } catch (e) {
    console.error(`Error fetching technicals for ${asset.symbol}:`, e);
    return null;
  }
}

// ============================================
// ENRICHED CRYPTO SNAPSHOT DATA (LunarCrush + Market Data)
// ============================================
interface EnrichedCryptoData {
  symbol: string;
  name: string;
  price: number;
  marketCap: number | null;
  marketCapRank: number | null;
  galaxyScore: number | null;
  altRank: number | null;
  sentiment: number | null;
  socialVolume24h: number | null;
  socialDominance: number | null;
  interactions24h: number | null;
  percentChange1h: number | null;
  percentChange24h: number | null;
  percentChange7d: number | null;
  blockchains: Array<{ network: string; address: string }> | null;
  categories: string[] | null;
  logoUrl: string | null;
  volume24h: number | null;
  high24h: number | null;
  low24h: number | null;
  coingeckoId: string | null;
}

// Enrich asset with comprehensive crypto_snapshot data (LunarCrush source)
async function enrichWithCryptoSnapshot(supabase: any, symbol: string): Promise<EnrichedCryptoData | null> {
  try {
    console.log(`[Enrichment] Fetching crypto_snapshot data for ${symbol}`);
    
    const { data, error } = await supabase
      .from('crypto_snapshot')
      .select('*')
      .ilike('symbol', symbol)
      .maybeSingle();
    
    if (error || !data) {
      console.log(`[Enrichment] No crypto_snapshot data for ${symbol}: ${error?.message || 'not found'}`);
      return null;
    }
    
    // Parse blockchains JSON to get contract addresses
    let blockchains: Array<{ network: string; address: string }> | null = null;
    if (data.blockchains && Array.isArray(data.blockchains)) {
      blockchains = data.blockchains.map((b: any) => ({
        network: b.network || b.chain || 'unknown',
        address: b.address || ''
      })).filter((b: { network: string; address: string }) => b.address);
    }
    
    // Parse categories
    let categories: string[] | null = null;
    if (data.categories) {
      if (Array.isArray(data.categories)) {
        categories = data.categories.map((c: any) => typeof c === 'string' ? c : c.name || c.category || '').filter(Boolean);
      }
    }
    
    console.log(`[Enrichment] Found crypto_snapshot for ${symbol}: price=$${data.price}, rank=${data.market_cap_rank}, galaxy=${data.galaxy_score}`);
    
    return {
      symbol: data.symbol,
      name: data.name,
      price: data.price || 0,
      marketCap: data.market_cap,
      marketCapRank: data.market_cap_rank,
      galaxyScore: data.galaxy_score,
      altRank: data.alt_rank,
      sentiment: data.sentiment,
      socialVolume24h: data.social_volume_24h,
      socialDominance: data.social_dominance,
      interactions24h: data.interactions_24h,
      percentChange1h: data.percent_change_1h,
      percentChange24h: data.change_percent,
      percentChange7d: data.percent_change_7d,
      blockchains,
      categories,
      logoUrl: data.logo_url,
      volume24h: data.volume_24h,
      high24h: data.high_24h,
      low24h: data.low_24h,
      coingeckoId: data.coingecko_id
    };
  } catch (e) {
    console.error(`[Enrichment] Error fetching crypto_snapshot for ${symbol}:`, e);
    return null;
  }
}

// Format enriched crypto data for system prompt
function formatEnrichedCryptoContext(enrichedAssets: EnrichedCryptoData[]): string {
  if (enrichedAssets.length === 0) return '';
  
  const sections = enrichedAssets.map(e => {
    const priceStr = e.price > 0 ? `$${e.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 8 })}` : 'N/A';
    const mcapStr = e.marketCap ? `$${(e.marketCap / 1e9).toFixed(2)}B` : 'N/A';
    const rankStr = e.marketCapRank ? `#${e.marketCapRank}` : 'N/A';
    
    let section = `
**${e.name} (${e.symbol})**
- Price: ${priceStr} | Market Cap: ${mcapStr} (Rank ${rankStr})
- Changes: 1h ${e.percentChange1h?.toFixed(2) || 'N/A'}% | 24h ${e.percentChange24h?.toFixed(2) || 'N/A'}% | 7d ${e.percentChange7d?.toFixed(2) || 'N/A'}%`;

    if (e.galaxyScore || e.altRank || e.sentiment) {
      section += `
- Social: Galaxy Score ${e.galaxyScore || 'N/A'}/100 | Alt Rank #${e.altRank || 'N/A'} | Sentiment ${e.sentiment || 'N/A'}%`;
    }
    
    if (e.socialVolume24h || e.interactions24h) {
      section += `
- Activity: ${e.socialVolume24h?.toLocaleString() || 'N/A'} mentions | ${e.interactions24h?.toLocaleString() || 'N/A'} interactions`;
    }
    
    if (e.categories && e.categories.length > 0) {
      section += `
- Categories: ${e.categories.slice(0, 5).join(', ')}`;
    }
    
    if (e.blockchains && e.blockchains.length > 0) {
      const chainAddrs = e.blockchains.slice(0, 5).map(b => 
        `${b.network}: ${b.address.slice(0, 10)}...${b.address.slice(-6)}`
      ).join('\n  ');
      section += `
- Contract Addresses (from LunarCrush):
  ${chainAddrs}`;
    }
    
    return section;
  }).join('\n');
  
  return `
═══════════════════════════════════════════
📊 ENRICHED CRYPTO DATA (LunarCrush + Market)
═══════════════════════════════════════════
${sections}

This data is from our comprehensive crypto_snapshot table which combines LunarCrush social intelligence with market data.
`;
}

// ============================================
// FETCH TOKEN CONTRACT ADDRESSES
// ============================================
interface TokenContractInfo {
  symbol: string;
  name: string;
  contracts: Record<string, string>; // chain -> address
}

async function fetchTokenContractAddresses(supabase: any, symbol: string): Promise<TokenContractInfo | null> {
  try {
    console.log(`[Contract Lookup] Fetching contract addresses for ${symbol}`);
    
    // First try cg_master for platforms data (most comprehensive)
    const { data: cgData } = await supabase
      .from('cg_master')
      .select('symbol, name, platforms')
      .ilike('symbol', symbol)
      .maybeSingle();
    
    if (cgData?.platforms && Object.keys(cgData.platforms).length > 0) {
      console.log(`[Contract Lookup] Found ${Object.keys(cgData.platforms).length} chains for ${symbol} in cg_master`);
      return {
        symbol: cgData.symbol?.toUpperCase() || symbol,
        name: cgData.name || symbol,
        contracts: cgData.platforms
      };
    }
    
    // Fallback to token_contracts table
    const { data: assetData } = await supabase
      .from('assets')
      .select('id, symbol, name')
      .ilike('symbol', symbol)
      .maybeSingle();
    
    if (assetData?.id) {
      const { data: contracts } = await supabase
        .from('token_contracts')
        .select('chain, contract_address')
        .eq('asset_id', assetData.id);
      
      if (contracts?.length > 0) {
        console.log(`[Contract Lookup] Found ${contracts.length} contracts for ${symbol} in token_contracts`);
        const contractMap: Record<string, string> = {};
        for (const c of contracts) {
          contractMap[c.chain] = c.contract_address;
        }
        return {
          symbol: assetData.symbol?.toUpperCase() || symbol,
          name: assetData.name || symbol,
          contracts: contractMap
        };
      }
    }
    
    // Try ticker_mappings for dex_address
    const { data: tickerData } = await supabase
      .from('ticker_mappings')
      .select('symbol, display_name, dex_chain, dex_address')
      .ilike('symbol', symbol)
      .not('dex_address', 'is', null)
      .maybeSingle();
    
    if (tickerData?.dex_address) {
      console.log(`[Contract Lookup] Found dex_address for ${symbol} in ticker_mappings`);
      return {
        symbol: tickerData.symbol?.toUpperCase() || symbol,
        name: tickerData.display_name || symbol,
        contracts: { [tickerData.dex_chain || 'unknown']: tickerData.dex_address }
      };
    }
    
    console.log(`[Contract Lookup] No contracts found for ${symbol}`);
    return null;
  } catch (e) {
    console.error(`[Contract Lookup] Error fetching contracts for ${symbol}:`, e);
    return null;
  }
}

function formatTokenContractAddresses(tokenContracts: TokenContractInfo[]): string {
  if (tokenContracts.length === 0) return '';
  
  // Human-readable chain names
  const chainNames: Record<string, string> = {
    'ethereum': 'Ethereum',
    'polygon-pos': 'Polygon',
    'arbitrum-one': 'Arbitrum',
    'base': 'Base',
    'binance-smart-chain': 'BNB Chain (BSC)',
    'avalanche': 'Avalanche C-Chain',
    'solana': 'Solana',
    'fantom': 'Fantom',
    'optimistic-ethereum': 'Optimism',
    'sui': 'Sui',
    'aptos': 'Aptos',
    'injective': 'Injective',
    'algorand': 'Algorand',
    'acala': 'Acala',
  };
  
  const sections = tokenContracts.map(token => {
    const contractLines = Object.entries(token.contracts)
      .map(([chain, address]) => {
        const chainLabel = chainNames[chain] || chain.charAt(0).toUpperCase() + chain.slice(1).replace(/-/g, ' ');
        return `  • ${chainLabel}: ${address}`;
      })
      .join('\n');
    
    return `**${token.name} (${token.symbol})** Contract Addresses:\n${contractLines}`;
  }).join('\n\n');
  
  return `
═══════════════════════════════════════════
🔗 TOKEN CONTRACT ADDRESSES
═══════════════════════════════════════════

${sections}

When user asks "is this the address", verify against these official addresses.
For verification questions, confirm if the address they're asking about matches any of these.
`;
}

// ============================================
// PHASE 1: FETCH RELEVANT MARKET BRIEFS
// ============================================
async function fetchRelevantBriefs(supabase: any, symbols: string[]): Promise<MarketBriefContext[]> {
  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    
    console.log(`[Phase 1] Fetching briefs from last 7 days for symbols: ${symbols.join(', ')}`);
    
    // Fetch recent published briefs
    const { data: briefs, error } = await supabase
      .from('market_briefs')
      .select('brief_type, title, executive_summary, published_at, featured_assets, sentiment_score')
      .eq('is_published', true)
      .gte('published_at', sevenDaysAgo)
      .order('published_at', { ascending: false })
      .limit(10);
    
    if (error || !briefs?.length) {
      console.log(`[Phase 1] No recent briefs found: ${error?.message || 'empty result'}`);
      return [];
    }
    
    // Filter briefs that mention any of the symbols user asked about
    const relevantBriefs: MarketBriefContext[] = [];
    const symbolsLower = symbols.map(s => s.toLowerCase());
    
    for (const brief of briefs) {
      const summaryLower = brief.executive_summary?.toLowerCase() || '';
      const titleLower = brief.title?.toLowerCase() || '';
      const featuredAssets = brief.featured_assets || [];
      
      // Check if brief mentions any of the symbols
      const mentionsSymbol = symbolsLower.some(sym => 
        summaryLower.includes(sym) || 
        titleLower.includes(sym) ||
        featuredAssets.some((a: string) => a.toLowerCase().includes(sym))
      );
      
      if (mentionsSymbol || relevantBriefs.length < 3) {
        relevantBriefs.push({
          briefType: brief.brief_type,
          title: brief.title,
          executiveSummary: brief.executive_summary?.slice(0, 500) || '',
          publishedAt: brief.published_at,
          featuredAssets: brief.featured_assets || [],
          sentimentScore: brief.sentiment_score
        });
      }
      
      if (relevantBriefs.length >= 5) break;
    }
    
    console.log(`[Phase 1] Found ${relevantBriefs.length} relevant briefs`);
    return relevantBriefs;
  } catch (e) {
    console.error('[Phase 1] Error fetching briefs:', e);
    return [];
  }
}

// ============================================
// PHASE 2: FETCH DERIVATIVES DATA
// ============================================
async function fetchDerivativesData(supabase: any, symbols: string[]): Promise<DerivativesData[]> {
  if (symbols.length === 0) return [];
  
  try {
    // Only fetch for crypto symbols (derivatives don't apply to stocks)
    const cryptoSymbols = symbols.slice(0, 5); // Limit to 5 to avoid rate limits
    
    console.log(`[Phase 2] Fetching derivatives for: ${cryptoSymbols.join(', ')}`);
    
    const { data, error } = await supabase.functions.invoke('derivs', {
      body: {},
      headers: {}
    });
    
    // The derivs function uses query params, so we need to call it differently
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const response = await fetch(
      `${supabaseUrl}/functions/v1/derivs?symbols=${cryptoSymbols.join(',')}`,
      {
        headers: {
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    if (!response.ok) {
      console.log(`[Phase 2] Derivs API error: ${response.status}`);
      return [];
    }
    
    const derivsData = await response.json();
    
    if (!derivsData?.derivatives?.length) {
      console.log('[Phase 2] No derivatives data returned');
      return [];
    }
    
    console.log(`[Phase 2] Got derivatives for ${derivsData.derivatives.length} symbols`);
    
    return derivsData.derivatives.map((d: any) => ({
      symbol: d.symbol,
      fundingRate: d.fundingRate || 0,
      liquidations24h: d.liquidations24h || { long: 0, short: 0, total: 0 },
      openInterest: d.openInterest,
      source: d.source || 'coinglass'
    }));
  } catch (e) {
    console.error('[Phase 2] Error fetching derivatives:', e);
    return [];
  }
}

// ============================================
// PHASE 3: FETCH SOCIAL SENTIMENT COMPARISON
// ============================================
async function fetchSocialContext(supabase: any, symbols: string[]): Promise<SocialSentimentData[]> {
  if (symbols.length === 0) return [];
  
  try {
    console.log(`[Phase 3] Fetching social sentiment for: ${symbols.join(', ')}`);
    
    const { data, error } = await supabase.functions.invoke('lunarcrush-social', {
      body: {}
    });
    
    if (error || !data?.data?.length) {
      console.log(`[Phase 3] No social data: ${error?.message || 'empty result'}`);
      return [];
    }
    
    // Filter to symbols user asked about
    const symbolsUpper = symbols.map(s => s.toUpperCase());
    const relevantSocial = data.data
      .filter((coin: any) => symbolsUpper.includes(coin.symbol?.toUpperCase()))
      .map((coin: any) => ({
        symbol: coin.symbol,
        name: coin.name,
        galaxyScore: coin.galaxy_score || 0,
        altRank: coin.alt_rank || 0,
        socialVolume: coin.social_volume || 0,
        socialDominance: coin.social_dominance || 0,
        sentiment: coin.sentiment || 0,
        fomoScore: coin.fomo_score || 0
      }));
    
    // Also get top 5 for comparison context
    const top5 = data.data
      .slice(0, 5)
      .filter((coin: any) => !symbolsUpper.includes(coin.symbol?.toUpperCase()))
      .map((coin: any) => ({
        symbol: coin.symbol,
        name: coin.name,
        galaxyScore: coin.galaxy_score || 0,
        altRank: coin.alt_rank || 0,
        socialVolume: coin.social_volume || 0,
        socialDominance: coin.social_dominance || 0,
        sentiment: coin.sentiment || 0,
        fomoScore: coin.fomo_score || 0
      }));
    
    const result = [...relevantSocial, ...top5.slice(0, 3)];
    console.log(`[Phase 3] Got social data for ${result.length} coins`);
    
    return result;
  } catch (e) {
    console.error('[Phase 3] Error fetching social:', e);
    return [];
  }
}

// ============================================
// PHASE 4: FETCH AGGREGATED NEWS
// ============================================
async function fetchAggregatedNews(supabase: any, symbols: string[]): Promise<{ news: NewsItem[], sentiment: AssetSentimentSnapshot[] }> {
  try {
    console.log(`[Phase 4] Fetching news and sentiment for: ${symbols.join(', ')}`);
    
    // Fetch news and sentiment in parallel
    const [newsResult, sentimentResult] = await Promise.all([
      // Fetch aggregated news
      supabase.functions.invoke('news-fetch', { body: { limit: 20 } }),
      // Fetch asset sentiment snapshots
      supabase
        .from('asset_sentiment_snapshots')
        .select('*')
        .in('asset_symbol', symbols.map(s => s.toUpperCase()))
        .gte('timestamp', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .order('timestamp', { ascending: false })
        .limit(10)
    ]);
    
    const news: NewsItem[] = [];
    const sentiment: AssetSentimentSnapshot[] = [];
    
    // Process news
    if (newsResult.data) {
      const allNews = [...(newsResult.data.crypto || []), ...(newsResult.data.stocks || [])];
      
      // Filter to relevant symbols
      const symbolsUpper = symbols.map(s => s.toUpperCase());
      const relevantNews = allNews.filter((item: any) => {
        if (item.tickers?.some((t: string) => symbolsUpper.includes(t.replace('X:', '').toUpperCase()))) return true;
        const titleLower = item.title?.toLowerCase() || '';
        return symbolsUpper.some(s => titleLower.includes(s.toLowerCase()));
      });
      
      // Take top 10 most relevant
      relevantNews.slice(0, 10).forEach((item: any) => {
        news.push({
          title: item.title,
          description: item.description?.slice(0, 200) || '',
          url: item.url,
          publishedAt: item.publishedAt,
          source: item.source,
          sentiment: item.sentiment,
          tickers: item.tickers
        });
      });
    }
    
    // Process sentiment snapshots
    if (sentimentResult.data) {
      sentimentResult.data.forEach((snap: any) => {
        sentiment.push({
          assetSymbol: snap.asset_symbol,
          assetName: snap.asset_name,
          sentimentScore: snap.sentiment_score,
          sentimentLabel: snap.sentiment_label,
          positiveCount: snap.positive_count,
          negativeCount: snap.negative_count,
          neutralCount: snap.neutral_count,
          totalArticles: snap.total_articles,
          trendDirection: snap.trend_direction
        });
      });
    }
    
    console.log(`[Phase 4] Got ${news.length} news items, ${sentiment.length} sentiment snapshots`);
    
    return { news, sentiment };
  } catch (e) {
    console.error('[Phase 4] Error fetching news:', e);
    return { news: [], sentiment: [] };
  }
}

// ============================================
// TAVILY WEB SEARCH
// ============================================

// Keywords that trigger web search for news/current events (Tavily-specific)
const TAVILY_NEWS_TRIGGERS = [
  'news', 'latest', 'recent', 'update', 'announcement', 'announce',
  'partnership', 'rumor', 'why is', 'what happened', 'breaking',
  'launch', 'launched', 'release',
  'hack', 'hacked', 'exploit', 'sec', 'regulation', 'lawsuit',
  'listing', 'listed', 'delist', 'upgrade', 'fork', 'airdrop',
  'etf', 'approval', 'approved', 'rejected', 'bull run', 'crash',
  'whale', 'elon', 'trump', 'gensler', 'tokenomics', 'roadmap',
  'founded', 'founder', 'team', 'whitepaper', 'who created',
  'background', 'history'
];

// Keywords that indicate price/market data questions - skip Tavily for these
const TAVILY_SKIP_KEYWORDS = [
  'price', 'cost', 'worth', 'value', 'how much',
  'market cap', 'marketcap', 'mcap', 
  'volume', '24h', '24 hour', 'daily change',
  'change', 'percent', 'percentage',
  'ath', 'all time high', 'all-time high',
  'atl', 'all time low', 'all-time low',
  'rsi', 'macd', 'sma', 'ema', 'technical',
  'overbought', 'oversold', 'support', 'resistance',
  'galaxy score', 'alt rank', 'sentiment score',
  'bullish', 'bearish', 'trend'
];

function shouldPerformWebSearch(message: string): boolean {
  const lowerMsg = message.toLowerCase();
  
  // FIRST: Check if this is a price/market data question
  // If so, we already have this data from Polygon/LunarCrush - skip Tavily
  const isPriceQuestion = TAVILY_SKIP_KEYWORDS.some(kw => lowerMsg.includes(kw));
  if (isPriceQuestion) {
    console.log("[Tavily] Skipping - detected price/market data question");
    return false;
  }
  
  // SECOND: Check for news/current events keywords
  const isNewsQuestion = TAVILY_NEWS_TRIGGERS.some(kw => lowerMsg.includes(kw));
  if (isNewsQuestion) {
    console.log("[Tavily] Triggering - detected news/events question");
    return true;
  }
  
  console.log("[Tavily] Skipping - no news keywords detected");
  return false;
}

async function searchTavily(query: string): Promise<WebSearchResult[]> {
  const TAVILY_API_KEY = Deno.env.get("TAVILY_API_KEY");
  if (!TAVILY_API_KEY) {
    console.log("[Tavily] API key not configured, skipping web search");
    return [];
  }

  try {
    console.log(`[Tavily] Searching: "${query}"`);
    
    const response = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: TAVILY_API_KEY,
        query: `${query} crypto cryptocurrency`,
        search_depth: "basic",
        max_results: 5,
        include_answer: false,
        include_domains: [
          "coindesk.com", "cointelegraph.com", "decrypt.co",
          "theblock.co", "bloomberg.com", "reuters.com",
          "cnbc.com", "forbes.com", "cryptonews.com"
        ]
      })
    });

    if (!response.ok) {
      console.error(`[Tavily] Error: ${response.status}`);
      return [];
    }

    const data = await response.json();
    
    if (!data.results?.length) {
      console.log("[Tavily] No results found");
      return [];
    }

    console.log(`[Tavily] Found ${data.results.length} results`);
    
    return data.results.map((r: any) => ({
      title: r.title || 'Untitled',
      url: r.url || '',
      content: r.content?.slice(0, 300) || '',
      score: r.score || 0
    }));
  } catch (e) {
    console.error("[Tavily] Search error:", e);
    return [];
  }
}

function formatWebSearchResults(results: WebSearchResult[]): string {
  if (results.length === 0) return "";
  
  const formattedResults = results.map(r => 
    `📰 ${r.title}\n   ${r.content.slice(0, 200)}...\n   🔗 ${r.url}`
  ).join('\n\n');
  
  return `
═══════════════════════════════════════════
🔍 LIVE NEWS & WEB SEARCH RESULTS
═══════════════════════════════════════════
${formattedResults}

Note: These are real-time search results. Use this information to provide current context.`;
}

async function fetchLivePrices(supabase: any): Promise<PriceData[]> {
  try {
    const { data, error } = await supabase.functions.invoke('polygon-crypto-prices', {
      body: { symbols: TOP_CRYPTOS }
    });

    if (error) {
      console.error("Error fetching prices:", error);
      return [];
    }

    if (data?.prices) {
      return data.prices.map((p: any) => ({
        symbol: p.symbol,
        price: p.price,
        change24h: p.change24h
      }));
    }
    return [];
  } catch (e) {
    console.error("Failed to fetch live prices:", e);
    return [];
  }
}

async function fetchCoinDetail(supabase: any, asset: ResolvedAsset): Promise<CoinDetail | null> {
  if (asset.assetType !== 'crypto') return null;
  
  try {
    console.log(`Fetching LunarCrush detail for: ${asset.symbol}`);
    
    const { data, error } = await supabase.functions.invoke('lunarcrush-coin-detail', {
      body: { coin: asset.symbol }
    });

    if (error) {
      console.error(`Error fetching ${asset.symbol} detail:`, error);
      return null;
    }

    if (data?.success && data?.data) {
      const d = data.data;
      return {
        symbol: d.symbol || asset.symbol,
        name: d.name || asset.displayName || asset.symbol,
        price: d.price || 0,
        change24h: d.percent_change_24h || 0,
        change7d: d.percent_change_7d || 0,
        change30d: d.percent_change_30d || 0,
        galaxyScore: d.galaxy_score || 0,
        altRank: d.alt_rank || 0,
        riskLevel: d.risk_level || 'Unknown',
        volatility: d.volatility || 0,
        volume24h: d.volume_24h || 0,
        marketCap: d.market_cap || 0,
        shortTermTrend: d.short_term_trend || 'Unknown',
        mediumTermTrend: d.medium_term_trend || 'Unknown',
        longTermTrend: d.long_term_trend || 'Unknown',
        fomoScore: d.fomo_score,
      };
    }
    return null;
  } catch (e) {
    console.error(`Failed to fetch ${asset.symbol} detail:`, e);
    return null;
  }
}

// Fetch company details from Polygon.io (for stocks)
async function fetchCompanyDetails(supabase: any, asset: ResolvedAsset): Promise<CompanyDetails | null> {
  if (asset.assetType !== 'stock') return null;
  
  try {
    const ticker = asset.polygonTicker || asset.symbol;
    console.log(`Fetching company details for stock: ${ticker}`);
    
    const { data, error } = await supabase.functions.invoke('polygon-company-details', {
      body: { ticker }
    });

    if (error) {
      console.error(`Error fetching company details for ${ticker}:`, error);
      return null;
    }

    if (data?.data) {
      console.log(`Got company details for ${ticker}: ${data.data.name || 'N/A'}`);
      return data.data as CompanyDetails;
    }
    return null;
  } catch (e) {
    console.error(`Failed to fetch company details for ${asset.symbol}:`, e);
    return null;
  }
}

function formatPrice(price: number): string {
  if (price >= 1) {
    return `$${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  } else if (price >= 0.01) {
    return `$${price.toFixed(4)}`;
  } else {
    return `$${price.toFixed(6)}`;
  }
}

function formatLargeNumber(num: number): string {
  if (num >= 1e12) return `$${(num / 1e12).toFixed(2)}T`;
  if (num >= 1e9) return `$${(num / 1e9).toFixed(2)}B`;
  if (num >= 1e6) return `$${(num / 1e6).toFixed(2)}M`;
  return `$${num.toLocaleString()}`;
}

function formatPriceContext(prices: PriceData[]): string {
  if (prices.length === 0) {
    return "Note: General market data is temporarily unavailable.";
  }

  const priceLines = prices.map(p => {
    const changeSymbol = p.change24h >= 0 ? '+' : '';
    const priceStr = formatPrice(p.price);
    return `${p.symbol}: ${priceStr} (${changeSymbol}${p.change24h.toFixed(2)}% 24h)`;
  }).join('\n');

  return `GENERAL MARKET DATA (Top Cryptos):\n${priceLines}`;
}

function formatCoinDetails(coins: CoinDetail[]): string {
  if (coins.length === 0) return "";

  const sections = coins.map(c => {
    const changeSymbol24h = c.change24h >= 0 ? '+' : '';
    const changeSymbol7d = c.change7d >= 0 ? '+' : '';
    const changeSymbol30d = c.change30d >= 0 ? '+' : '';
    
    return `
📊 ${c.name} (${c.symbol})
━━━━━━━━━━━━━━━━━━━━━━━
💰 Price: ${formatPrice(c.price)}
📈 24h Change: ${changeSymbol24h}${c.change24h.toFixed(2)}%
📊 7d Change: ${changeSymbol7d}${c.change7d.toFixed(2)}%
📉 30d Change: ${changeSymbol30d}${c.change30d.toFixed(2)}%

🌟 Galaxy Score: ${c.galaxyScore}/100 ${c.galaxyScore >= 70 ? '(Strong)' : c.galaxyScore >= 50 ? '(Moderate)' : '(Weak)'}
🏆 Alt Rank: #${c.altRank}
${c.fomoScore ? `🔥 FOMO Score: ${c.fomoScore}` : ''}

⚠️ Risk Level: ${c.riskLevel}
📊 Volatility: ${c.volatility.toFixed(2)}%

📈 Trend Analysis:
  • Short-term: ${c.shortTermTrend}
  • Medium-term: ${c.mediumTermTrend}
  • Long-term: ${c.longTermTrend}

💎 Market Cap: ${formatLargeNumber(c.marketCap)}
📊 24h Volume: ${formatLargeNumber(c.volume24h)}
`;
  });

  return `
═══════════════════════════════════════════
🔍 DETAILED CRYPTO RESEARCH
═══════════════════════════════════════════
${sections.join('\n')}`;
}

function formatHistoricalContext(historical: HistoricalContext[]): string {
  if (historical.length === 0) return "";
  
  const sections = historical.map(h => {
    const changeSymbol = h.change30d >= 0 ? '+' : '';
    return `📈 ${h.symbol} 30-Day History:
  • Change: ${changeSymbol}${h.change30d.toFixed(2)}%
  • Range: ${formatPrice(h.low30d)} - ${formatPrice(h.high30d)}
  • Avg Daily Volume: ${formatLargeNumber(h.avgVolume)}`;
  });
  
  return `
═══════════════════════════════════════════
📊 HISTORICAL PRICE DATA (30 Days)
═══════════════════════════════════════════
${sections.join('\n\n')}`;
}

function formatTechnicalIndicators(technicals: TechnicalIndicators[]): string {
  if (technicals.length === 0) return "";
  
  const sections = technicals.map(t => {
    let analysis = `📈 ${t.symbol} Technical Analysis:\n`;
    if (t.rsi) analysis += `  • RSI(14): ${t.rsi.value.toFixed(1)} - ${t.rsi.signal}\n`;
    if (t.macd) analysis += `  • MACD: ${t.macd.signal} (Hist: ${t.macd.histogram.toFixed(4)})\n`;
    if (t.sma50) analysis += `  • SMA(50): ${formatPrice(t.sma50)}\n`;
    if (t.ema20) analysis += `  • EMA(20): ${formatPrice(t.ema20)}\n`;
    return analysis;
  });
  
  return `
═══════════════════════════════════════════
🔬 TECHNICAL INDICATORS
═══════════════════════════════════════════
${sections.join('\n')}`;
}

function formatSimilarAssetsSuggestion(similar: SimilarAsset[], searchTerms: string[]): string {
  if (similar.length === 0) {
    return `
═══════════════════════════════════════════
❓ CLARIFICATION NEEDED
═══════════════════════════════════════════
I couldn't find any assets matching "${searchTerms.join('" or "')}" in my database.

Could you help me by providing:
• The ticker symbol (e.g., $BTC, $AAPL)
• The full asset name (e.g., "Bitcoin", "Apple")
• Or for newer tokens, the contract address

*sniffs around for more clues* 🐕`;
  }
  
  const suggestions = similar.map(s => `• ${s.displayName} (${s.symbol}) - ${s.type}`).join('\n');
  
  return `
═══════════════════════════════════════════
❓ DID YOU MEAN ONE OF THESE?
═══════════════════════════════════════════
I found these similar assets:
${suggestions}

Please confirm which one you're asking about, or provide:
• The exact ticker symbol (e.g., $BTC)
• The full name of the asset
• Or a token contract address for newer coins

*tilts head curiously* 🐕`;
}

function formatCompanyDetails(companies: CompanyDetails[]): string {
  if (companies.length === 0) return "";

  const sections = companies.map(c => {
    let section = `
🏢 ${c.name || c.ticker} (${c.ticker})
━━━━━━━━━━━━━━━━━━━━━━━
${c.description ? `📝 ${c.description.slice(0, 300)}${c.description.length > 300 ? '...' : ''}\n` : ''}
📊 Sector: ${c.sector || 'N/A'} | Industry: ${c.industry || 'N/A'}
💰 Market Cap: ${c.market_cap ? formatLargeNumber(c.market_cap) : 'N/A'}
👥 Employees: ${c.employees ? c.employees.toLocaleString() : 'N/A'}
${c.website ? `🌐 Website: ${c.website}` : ''}
${c.headquarters?.city ? `📍 HQ: ${c.headquarters.city}, ${c.headquarters.state || ''}` : ''}
${c.list_date ? `📅 Listed: ${c.list_date}` : ''}`;

    // Add financials if available
    if (c.last_financials && c.last_financials.length > 0) {
      const latest = c.last_financials[0];
      section += `

📈 Latest Financials (${latest.fiscal_period} ${latest.fiscal_year}):
  • Revenue: ${latest.revenue ? formatLargeNumber(latest.revenue) : 'N/A'}
  • Net Income: ${latest.net_income ? formatLargeNumber(latest.net_income) : 'N/A'}
  • EPS (Diluted): ${latest.eps_diluted ? `$${latest.eps_diluted.toFixed(2)}` : 'N/A'}`;
    }

    // Add dividend info if available
    if (c.dividends && c.dividends.length > 0) {
      const latestDiv = c.dividends[0];
      section += `

💵 Latest Dividend:
  • Amount: $${latestDiv.cash_amount.toFixed(2)}
  • Ex-Date: ${latestDiv.ex_dividend_date}
  • Pay Date: ${latestDiv.pay_date || 'N/A'}
  • Frequency: ${latestDiv.frequency === 4 ? 'Quarterly' : latestDiv.frequency === 12 ? 'Monthly' : latestDiv.frequency === 2 ? 'Semi-Annual' : latestDiv.frequency === 1 ? 'Annual' : 'N/A'}`;
    }

    // Add recent splits if any
    if (c.splits && c.splits.length > 0) {
      const recentSplit = c.splits[0];
      section += `

✂️ Recent Split: ${recentSplit.split_to}:${recentSplit.split_from} on ${recentSplit.execution_date}`;
    }

    // Add related companies
    if (c.related_companies && c.related_companies.length > 0) {
      const related = c.related_companies.slice(0, 5).map(r => r.ticker).join(', ');
      section += `

🔗 Related: ${related}`;
    }

    return section;
  });

  return `
═══════════════════════════════════════════
🏢 COMPANY PROFILE & FUNDAMENTALS
═══════════════════════════════════════════
${sections.join('\n\n')}`;
}

// ============================================
// FORMAT NEW DATA SOURCES
// ============================================

function formatMarketBriefs(briefs: MarketBriefContext[]): string {
  if (briefs.length === 0) return "";
  
  const sections = briefs.map(b => {
    const date = new Date(b.publishedAt).toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    });
    const sentiment = b.sentimentScore !== null 
      ? `${b.sentimentScore >= 60 ? '🟢' : b.sentimentScore >= 40 ? '🟡' : '🔴'} ${b.sentimentScore}/100`
      : '';
    
    return `📋 ${b.title} (${b.briefType} - ${date})
${sentiment}
${b.executiveSummary.slice(0, 300)}${b.executiveSummary.length > 300 ? '...' : ''}
Featured: ${b.featuredAssets.slice(0, 5).join(', ') || 'Various'}`;
  });
  
  return `
═══════════════════════════════════════════
📚 OUR RECENT MARKET ANALYSIS (Last 7 Days)
═══════════════════════════════════════════
${sections.join('\n\n')}

Use this context when referencing our previous analysis or when asked "what did you say about X?"`;
}

function formatDerivativesData(derivs: DerivativesData[]): string {
  if (derivs.length === 0) return "";
  
  const sections = derivs.map(d => {
    const fundingEmoji = d.fundingRate > 0 ? '🟢' : d.fundingRate < 0 ? '🔴' : '⚪';
    const fundingSignal = d.fundingRate > 0.01 ? 'Bullish pressure (longs paying)' 
                        : d.fundingRate < -0.01 ? 'Bearish pressure (shorts paying)'
                        : 'Neutral';
    
    const totalLiq = d.liquidations24h.total;
    const liqContext = totalLiq > 100_000_000 ? '🔥 Heavy liquidations!' 
                     : totalLiq > 50_000_000 ? '⚠️ Elevated liquidations'
                     : '✅ Normal liquidation levels';
    
    return `📊 ${d.symbol} Derivatives:
  ${fundingEmoji} Funding Rate: ${(d.fundingRate * 100).toFixed(4)}% (${fundingSignal})
  💥 24h Liquidations: ${formatLargeNumber(d.liquidations24h.total)}
    • Longs: ${formatLargeNumber(d.liquidations24h.long)}
    • Shorts: ${formatLargeNumber(d.liquidations24h.short)}
  ${liqContext}`;
  });
  
  return `
═══════════════════════════════════════════
📈 DERIVATIVES DATA (Funding & Liquidations)
═══════════════════════════════════════════
${sections.join('\n\n')}

Interpretation:
• Positive funding = longs pay shorts (bullish sentiment)
• Negative funding = shorts pay longs (bearish sentiment)
• High liquidations = volatile price action`;
}

function formatSocialComparison(social: SocialSentimentData[]): string {
  if (social.length === 0) return "";
  
  const sections = social.map((s, i) => {
    const galaxyEmoji = s.galaxyScore >= 70 ? '🌟' : s.galaxyScore >= 50 ? '✨' : '⭐';
    const sentimentEmoji = s.sentiment > 0 ? '🟢' : s.sentiment < 0 ? '🔴' : '🟡';
    
    return `${i + 1}. ${s.name} (${s.symbol})
  ${galaxyEmoji} Galaxy Score: ${s.galaxyScore}/100
  🏆 Alt Rank: #${s.altRank}
  📊 Social Volume: ${s.socialVolume.toLocaleString()}
  ${sentimentEmoji} Sentiment: ${s.sentiment >= 0 ? '+' : ''}${(s.sentiment * 100).toFixed(1)}%
  🔥 FOMO Score: ${s.fomoScore}`;
  });
  
  return `
═══════════════════════════════════════════
🌍 SOCIAL SENTIMENT RANKINGS
═══════════════════════════════════════════
${sections.join('\n\n')}

• Galaxy Score: Social engagement + sentiment combined
• Alt Rank: Rank vs all altcoins by social metrics
• FOMO Score: Fear of missing out indicator`;
}

function formatNewsAndSentiment(news: NewsItem[], sentiment: AssetSentimentSnapshot[]): string {
  let result = '';
  
  if (sentiment.length > 0) {
    const sentimentLines = sentiment.map(s => {
      const emoji = s.sentimentLabel === 'positive' ? '🟢' : s.sentimentLabel === 'negative' ? '🔴' : '🟡';
      const trendEmoji = s.trendDirection === 'up' ? '📈' : s.trendDirection === 'down' ? '📉' : '➡️';
      return `${emoji} ${s.assetSymbol}: ${s.sentimentLabel} (${s.sentimentScore.toFixed(1)}/100) ${trendEmoji}
    • ${s.positiveCount} positive / ${s.negativeCount} negative / ${s.neutralCount} neutral articles`;
    });
    
    result += `
═══════════════════════════════════════════
📊 NEWS SENTIMENT ANALYSIS (Last 24h)
═══════════════════════════════════════════
${sentimentLines.join('\n')}
`;
  }
  
  if (news.length > 0) {
    const newsLines = news.slice(0, 5).map(n => {
      const sentimentEmoji = n.sentiment === 'positive' ? '🟢' : n.sentiment === 'negative' ? '🔴' : '🟡';
      const date = new Date(n.publishedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      return `${sentimentEmoji} ${n.title}
    ${n.source} • ${date}
    ${n.description.slice(0, 150)}...`;
    });
    
    result += `
═══════════════════════════════════════════
📰 LATEST RELEVANT NEWS
═══════════════════════════════════════════
${newsLines.join('\n\n')}
`;
  }
  
  return result;
}

// ============================================
// GOPLUS SECURITY & DEXSCREENER INTEGRATION
// ============================================

// Chain IDs for GoPlus API
const GOPLUS_CHAIN_IDS: Record<string, string> = {
  'ethereum': '1',
  'bsc': '56',
  'polygon': '137',
  'arbitrum': '42161',
  'base': '8453',
  'avalanche': '43114',
  'optimism': '10',
  'fantom': '250',
  'cronos': '25',
  'solana': 'solana'
};

// Fetch token security data from GoPlus (FREE, no API key needed)
async function fetchGoTokenSecurity(contractAddress: string, chain: string = 'ethereum'): Promise<GoTokenSecurity | null> {
  try {
    const chainId = GOPLUS_CHAIN_IDS[chain.toLowerCase()] || '1';
    const normalizedAddr = contractAddress.toLowerCase();
    
    console.log(`[GoPlus] Fetching security for ${normalizedAddr} on chain ${chainId}`);
    
    const url = `https://api.gopluslabs.io/api/v1/token_security/${chainId}?contract_addresses=${normalizedAddr}`;
    const response = await fetch(url, {
      headers: { 'Accept': 'application/json' }
    });
    
    if (!response.ok) {
      console.error(`[GoPlus] Error: ${response.status}`);
      return null;
    }
    
    const data = await response.json();
    const result = data.result?.[normalizedAddr];
    
    if (!result) {
      console.log(`[GoPlus] No data found for ${normalizedAddr}`);
      return null;
    }
    
    console.log(`[GoPlus] Found security data for ${result.token_symbol || 'unknown'}`);
    
    return {
      isHoneypot: result.is_honeypot === '1',
      isOpenSource: result.is_open_source === '1',
      isProxy: result.is_proxy === '1',
      isMintable: result.is_mintable === '1',
      canTakeBackOwnership: result.can_take_back_ownership === '1',
      ownerPercent: parseFloat(result.owner_percent || '0') * 100,
      creatorPercent: parseFloat(result.creator_percent || '0') * 100,
      holderCount: parseInt(result.holder_count || '0'),
      lpHolderCount: parseInt(result.lp_holder_count || '0'),
      lpTotalSupplyLocked: parseFloat(result.lp_total_supply_locked || '0') * 100,
      buyTax: parseFloat(result.buy_tax || '0') * 100,
      sellTax: parseFloat(result.sell_tax || '0') * 100,
      isAntiWhale: result.is_anti_whale === '1',
      slippageModifiable: result.slippage_modifiable === '1',
      isBlacklisted: result.is_blacklisted === '1',
      tradingCooldown: result.trading_cooldown === '1',
      transferPausable: result.transfer_pausable === '1',
      tokenName: result.token_name || '',
      tokenSymbol: result.token_symbol || ''
    };
  } catch (error) {
    console.error('[GoPlus] Fetch error:', error);
    return null;
  }
}

// Fetch token data from DexScreener (FREE, no API key needed)
async function fetchDexScreenerData(contractAddress: string): Promise<DexScreenerData | null> {
  try {
    const normalizedAddr = contractAddress.toLowerCase();
    console.log(`[DexScreener] Fetching data for ${normalizedAddr}`);
    
    const url = `https://api.dexscreener.com/latest/dex/tokens/${normalizedAddr}`;
    const response = await fetch(url, {
      headers: { 'Accept': 'application/json' }
    });
    
    if (!response.ok) {
      console.error(`[DexScreener] Error: ${response.status}`);
      return null;
    }
    
    const data = await response.json();
    const pairs = data.pairs;
    
    if (!pairs || pairs.length === 0) {
      console.log(`[DexScreener] No pairs found for ${normalizedAddr}`);
      return null;
    }
    
    // Get the highest liquidity pair
    const bestPair = pairs.reduce((best: any, current: any) => {
      const bestLiq = parseFloat(best.liquidity?.usd || '0');
      const currentLiq = parseFloat(current.liquidity?.usd || '0');
      return currentLiq > bestLiq ? current : best;
    }, pairs[0]);
    
    console.log(`[DexScreener] Found pair on ${bestPair.dexId} with $${bestPair.liquidity?.usd || 0} liquidity`);
    
    return {
      symbol: bestPair.baseToken?.symbol || '',
      name: bestPair.baseToken?.name || '',
      priceUsd: parseFloat(bestPair.priceUsd || '0'),
      priceChange24h: parseFloat(bestPair.priceChange?.h24 || '0'),
      volume24h: parseFloat(bestPair.volume?.h24 || '0'),
      liquidity: parseFloat(bestPair.liquidity?.usd || '0'),
      fdv: parseFloat(bestPair.fdv || '0'),
      pairAddress: bestPair.pairAddress || '',
      pairCreatedAt: bestPair.pairCreatedAt || '',
      dexId: bestPair.dexId || '',
      chainId: bestPair.chainId || '',
      txns24h: {
        buys: bestPair.txns?.h24?.buys || 0,
        sells: bestPair.txns?.h24?.sells || 0
      }
    };
  } catch (error) {
    console.error('[DexScreener] Fetch error:', error);
    return null;
  }
}

// ============================================
// CEX AVAILABILITY FUNCTIONS
// ============================================

// Get CoinGecko ID from database by contract address or symbol
async function getCoingeckoId(
  supabase: any,
  symbol: string,
  contractAddress?: string
): Promise<string | null> {
  try {
    // Priority 1: Try ticker_mappings by symbol first (most reliable, curated data)
    const { data: tickerMapping } = await supabase
      .from('ticker_mappings')
      .select('coingecko_id')
      .eq('symbol', symbol.toUpperCase())
      .not('coingecko_id', 'is', null)
      .single();
    
    if (tickerMapping?.coingecko_id) {
      console.log(`[CEX] Found CoinGecko ID ${tickerMapping.coingecko_id} for symbol ${symbol} (ticker_mappings)`);
      return tickerMapping.coingecko_id;
    }
    
    // Priority 2: Try by contract address on Ethereum specifically
    if (contractAddress && contractAddress.startsWith('0x')) {
      const normalizedAddress = contractAddress.toLowerCase();
      
      // Query cg_master filtering by platforms containing our address
      // Use textSearch on platforms JSON column
      const { data: cgMasterByContract } = await supabase
        .from('cg_master')
        .select('cg_id, symbol, platforms')
        .ilike('platforms', `%${normalizedAddress}%`)
        .limit(10);
      
      if (cgMasterByContract && cgMasterByContract.length > 0) {
        // Prefer exact matches on ethereum chain
        for (const coin of cgMasterByContract) {
          if (coin.platforms) {
            const platforms = typeof coin.platforms === 'string' ? JSON.parse(coin.platforms) : coin.platforms;
            // Check Ethereum platform first (most common for major tokens)
            if (platforms.ethereum && platforms.ethereum.toLowerCase() === normalizedAddress) {
              console.log(`[CEX] Found CoinGecko ID ${coin.cg_id} for Ethereum address ${contractAddress}`);
              return coin.cg_id;
            }
          }
        }
        // Fall back to any chain match
        for (const coin of cgMasterByContract) {
          if (coin.platforms) {
            const platforms = typeof coin.platforms === 'string' ? JSON.parse(coin.platforms) : coin.platforms;
            for (const [chain, addr] of Object.entries(platforms)) {
              if (typeof addr === 'string' && addr.toLowerCase() === normalizedAddress) {
                console.log(`[CEX] Found CoinGecko ID ${coin.cg_id} for ${chain} address ${contractAddress}`);
                return coin.cg_id;
              }
            }
          }
        }
      }
    }
    
    // Priority 3: Try cg_master by symbol - prefer well-known tokens
    // For symbols like "PEPE", prefer "pepe" over "based-pepe" or variants
    const { data: cgMasterBySymbol } = await supabase
      .from('cg_master')
      .select('cg_id, name')
      .ilike('symbol', symbol)
      .order('cg_id', { ascending: true }) // "pepe" comes before "based-pepe" alphabetically 
      .limit(5);
    
    if (cgMasterBySymbol && cgMasterBySymbol.length > 0) {
      // Prefer exact symbol match (cg_id equals symbol lowercase)
      const exactMatch = cgMasterBySymbol.find(c => c.cg_id === symbol.toLowerCase());
      if (exactMatch) {
        console.log(`[CEX] Found exact CoinGecko ID ${exactMatch.cg_id} for symbol ${symbol}`);
        return exactMatch.cg_id;
      }
      // Otherwise use first result
      console.log(`[CEX] Found CoinGecko ID ${cgMasterBySymbol[0].cg_id} for symbol ${symbol} (cg_master)`);
      return cgMasterBySymbol[0].cg_id;
    }
    
    console.log(`[CEX] No CoinGecko ID found for ${symbol}`);
    return null;
  } catch (error) {
    console.error('[CEX] getCoingeckoId error:', error);
    return null;
  }
}

// Fetch CEX listings from CoinGecko tickers API
async function fetchCoinGeckoTickers(coingeckoId: string): Promise<CexListing[]> {
  const COINGECKO_API_KEY = Deno.env.get('COINGECKO_API_KEY');
  if (!COINGECKO_API_KEY) {
    console.log('[CEX] No COINGECKO_API_KEY, skipping CEX lookup');
    return [];
  }
  
  try {
    const url = `https://pro-api.coingecko.com/api/v3/coins/${coingeckoId}/tickers`;
    console.log(`[CEX] Fetching CoinGecko tickers for ${coingeckoId}`);
    
    const response = await fetch(url, {
      headers: { 'x-cg-pro-api-key': COINGECKO_API_KEY }
    });
    
    if (!response.ok) {
      console.warn(`[CEX] CoinGecko tickers API returned ${response.status}`);
      return [];
    }
    
    const data = await response.json();
    const tickers = data.tickers || [];
    
    // Major CEXs to look for
    const majorExchanges = new Set([
      'binance', 'gdax', 'coinbase_exchange', 'okx', 'bybit_spot', 'kraken', 'kucoin', 
      'gate', 'bitget', 'htx', 'mexc', 'crypto_com_exchange', 'bitfinex', 'bitstamp',
      'upbit', 'bithumb', 'gemini', 'bitflyer', 'lbank', 'bitmart'
    ]);
    
    // Dedupe by exchange, keep highest volume pair per exchange
    const exchangeMap = new Map<string, CexListing>();
    for (const t of tickers) {
      const exchangeId = t.market?.identifier || '';
      if (!majorExchanges.has(exchangeId)) continue;
      
      const existing = exchangeMap.get(exchangeId);
      const volume = t.converted_volume?.usd || 0;
      
      if (!existing || volume > existing.volume24h) {
        exchangeMap.set(exchangeId, {
          exchange: t.market?.name || exchangeId,
          volume24h: volume,
          price: t.converted_last?.usd || 0,
          lastUpdated: t.last_traded_at || new Date().toISOString()
        });
      }
    }
    
    const cexListings = Array.from(exchangeMap.values())
      .sort((a, b) => b.volume24h - a.volume24h)
      .slice(0, 10);
    
    console.log(`[CEX] Found ${cexListings.length} major CEX listings for ${coingeckoId}`);
    return cexListings;
  } catch (error) {
    console.error('[CEX] fetchCoinGeckoTickers error:', error);
    return [];
  }
}

// Two-tier CEX availability lookup: database first, then CoinGecko API
async function fetchCexAvailability(
  supabase: any,
  symbol: string, 
  coingeckoId: string | null,
  contractAddress?: string
): Promise<{ listings: CexListing[], totalVolume: number }> {
  try {
    // Tier 1: Database lookup (free, instant)
    const { data: dbExchanges } = await supabase
      .from('exchange_ticker_data')
      .select('exchange, volume_24h, price, last_updated')
      .eq('asset_symbol', symbol.toUpperCase())
      .order('volume_24h', { ascending: false })
      .limit(10);
    
    if (dbExchanges && dbExchanges.length >= 3) {
      console.log(`[CEX] Found ${dbExchanges.length} exchanges for ${symbol} in database`);
      const listings: CexListing[] = dbExchanges.map((d: any) => ({
        exchange: d.exchange,
        volume24h: d.volume_24h || 0,
        price: d.price || 0,
        lastUpdated: d.last_updated || new Date().toISOString()
      }));
      const totalVolume = listings.reduce((sum, l) => sum + l.volume24h, 0);
      return { listings, totalVolume };
    }
    
    // Tier 2: CoinGecko tickers API (only if coingeckoId available and DB insufficient)
    let cgId = coingeckoId;
    if (!cgId) {
      cgId = await getCoingeckoId(supabase, symbol, contractAddress);
    }
    
    if (cgId) {
      const cexData = await fetchCoinGeckoTickers(cgId);
      if (cexData.length > 0) {
        const totalVolume = cexData.reduce((sum, l) => sum + l.volume24h, 0);
        return { listings: cexData, totalVolume };
      }
    }
    
    // Return whatever we have from DB (might be empty or partial)
    const listings: CexListing[] = (dbExchanges || []).map((d: any) => ({
      exchange: d.exchange,
      volume24h: d.volume_24h || 0,
      price: d.price || 0,
      lastUpdated: d.last_updated || new Date().toISOString()
    }));
    return { listings, totalVolume: listings.reduce((sum, l) => sum + l.volume24h, 0) };
  } catch (error) {
    console.error('[CEX] fetchCexAvailability error:', error);
    return { listings: [], totalVolume: 0 };
  }
}

// Generate security warnings based on GoPlus and DexScreener data
function generateSecurityWarnings(goplus: GoTokenSecurity | null, dex: DexScreenerData | null): string[] {
  const warnings: string[] = [];
  
  if (goplus) {
    // Critical warnings (🚨)
    if (goplus.isHoneypot) {
      warnings.push("🚨 HONEYPOT DETECTED - Cannot sell tokens! DO NOT BUY!");
    }
    if (goplus.canTakeBackOwnership) {
      warnings.push("🚨 Owner can reclaim contract ownership - extreme risk");
    }
    if (goplus.sellTax > 50) {
      warnings.push(`🚨 Extremely high sell tax: ${goplus.sellTax.toFixed(1)}%`);
    }
    if (goplus.isBlacklisted) {
      warnings.push("🚨 Contract has blacklist function - can block wallets");
    }
    
    // High risk warnings (⚠️)
    if (goplus.ownerPercent > 50) {
      warnings.push(`⚠️ Owner holds ${goplus.ownerPercent.toFixed(1)}% of supply - high concentration`);
    } else if (goplus.ownerPercent > 20) {
      warnings.push(`⚠️ Owner holds ${goplus.ownerPercent.toFixed(1)}% of supply`);
    }
    
    if (goplus.isMintable) {
      warnings.push("⚠️ Token supply can be increased (mintable)");
    }
    if (goplus.transferPausable) {
      warnings.push("⚠️ Transfers can be paused by owner");
    }
    if (goplus.slippageModifiable) {
      warnings.push("⚠️ Slippage/taxes can be modified by owner");
    }
    if (goplus.tradingCooldown) {
      warnings.push("⚠️ Trading cooldown enabled");
    }
    if (!goplus.isOpenSource) {
      warnings.push("⚠️ Contract is not verified/open source");
    }
    if (goplus.isProxy) {
      warnings.push("⚠️ Proxy contract - logic can be changed");
    }
    if (goplus.buyTax > 10) {
      warnings.push(`⚠️ High buy tax: ${goplus.buyTax.toFixed(1)}%`);
    }
    if (goplus.sellTax > 10 && goplus.sellTax <= 50) {
      warnings.push(`⚠️ High sell tax: ${goplus.sellTax.toFixed(1)}%`);
    }
    if (goplus.lpTotalSupplyLocked < 50 && goplus.lpTotalSupplyLocked > 0) {
      warnings.push(`⚠️ Only ${goplus.lpTotalSupplyLocked.toFixed(1)}% of LP locked`);
    }
    
    // Positive indicators (✅)
    if (!goplus.isHoneypot && goplus.isOpenSource && !goplus.isMintable && goplus.ownerPercent < 5) {
      warnings.push("✅ No major contract red flags detected");
    }
  }
  
  if (dex) {
    // Liquidity warnings
    if (dex.liquidity < 5000) {
      warnings.push(`🚨 Extremely low liquidity: $${formatLargeNumber(dex.liquidity)} - high slippage risk`);
    } else if (dex.liquidity < 50000) {
      warnings.push(`⚠️ Low liquidity: $${formatLargeNumber(dex.liquidity)} - may cause slippage`);
    }
    
    // Pair age warnings
    if (dex.pairCreatedAt) {
      const pairAge = Date.now() - new Date(dex.pairCreatedAt).getTime();
      const pairAgeDays = pairAge / (1000 * 60 * 60 * 24);
      if (pairAgeDays < 1) {
        warnings.push("🚨 Pair is less than 24 hours old - extremely new");
      } else if (pairAgeDays < 7) {
        warnings.push(`⚠️ Pair is only ${Math.floor(pairAgeDays)} days old`);
      }
    }
    
    // Buy/sell ratio
    if (dex.txns24h.buys + dex.txns24h.sells > 10) {
      const sellRatio = dex.txns24h.sells / (dex.txns24h.buys + dex.txns24h.sells);
      if (sellRatio > 0.7) {
        warnings.push(`⚠️ High sell pressure: ${(sellRatio * 100).toFixed(0)}% of transactions are sells`);
      }
    }
    
    // Volume warnings
    if (dex.volume24h < 1000 && dex.liquidity > 10000) {
      warnings.push("⚠️ Very low trading volume - may indicate low interest");
    }
    
    // Positive liquidity
    if (dex.liquidity >= 100000) {
      warnings.push(`✅ Healthy liquidity: $${formatLargeNumber(dex.liquidity)}`);
    }
  }
  
  return warnings;
}

// Fetch security context for a contract address (with CEX availability)
async function fetchTokenSecurityContext(
  contractAddress: string, 
  chain: string = 'ethereum',
  supabase?: any
): Promise<TokenSecurityContext | null> {
  if (!contractAddress || !contractAddress.startsWith('0x')) {
    return null;
  }
  
  console.log(`[Security] Fetching security context for ${contractAddress} on ${chain}`);
  
  // Fetch GoPlus and DexScreener in parallel
  const [goplus, dexscreener] = await Promise.all([
    fetchGoTokenSecurity(contractAddress, chain),
    fetchDexScreenerData(contractAddress)
  ]);
  
  const symbol = goplus?.tokenSymbol || dexscreener?.symbol || 'UNKNOWN';
  const warnings = generateSecurityWarnings(goplus, dexscreener);
  
  // Fetch CEX availability if supabase client provided
  let cexListings: CexListing[] = [];
  let cexTotalVolume = 0;
  let coingeckoId: string | null = null;
  
  if (supabase) {
    coingeckoId = await getCoingeckoId(supabase, symbol, contractAddress);
    const cexData = await fetchCexAvailability(supabase, symbol, coingeckoId, contractAddress);
    cexListings = cexData.listings;
    cexTotalVolume = cexData.totalVolume;
  }
  
  return {
    symbol,
    contractAddress,
    chain,
    goplus,
    dexscreener,
    cexListings,
    cexTotalVolume,
    coingeckoId,
    warnings
  };
}

// Format security context for system prompt
function formatSecurityContext(security: TokenSecurityContext[]): string {
  if (security.length === 0) return "";
  
  const sections = security.map(s => {
    let section = `
🔐 ${s.symbol} Security Analysis (${s.chain})
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 Contract: ${s.contractAddress}`;

    if (s.goplus) {
      section += `

📊 Contract Analysis (GoPlus):
  • Honeypot: ${s.goplus.isHoneypot ? '🚨 YES - CANNOT SELL!' : '✅ No'}
  • Open Source: ${s.goplus.isOpenSource ? '✅ Yes' : '⚠️ No'}
  • Proxy Contract: ${s.goplus.isProxy ? '⚠️ Yes' : '✅ No'}
  • Mintable: ${s.goplus.isMintable ? '⚠️ Yes' : '✅ No'}
  • Owner Can Reclaim: ${s.goplus.canTakeBackOwnership ? '🚨 Yes' : '✅ No'}
  • Owner Holdings: ${s.goplus.ownerPercent.toFixed(2)}%
  • Buy Tax: ${s.goplus.buyTax.toFixed(1)}%
  • Sell Tax: ${s.goplus.sellTax.toFixed(1)}%
  • Holder Count: ${s.goplus.holderCount.toLocaleString()}
  • LP Locked: ${s.goplus.lpTotalSupplyLocked.toFixed(1)}%`;
    }

    if (s.dexscreener) {
      const pairAge = s.dexscreener.pairCreatedAt 
        ? `${Math.floor((Date.now() - new Date(s.dexscreener.pairCreatedAt).getTime()) / (1000 * 60 * 60 * 24))} days`
        : 'Unknown';
      
      section += `

💹 Market Data (DexScreener):
  • Price: $${s.dexscreener.priceUsd.toFixed(8)}
  • 24h Change: ${s.dexscreener.priceChange24h >= 0 ? '+' : ''}${s.dexscreener.priceChange24h.toFixed(2)}%
  • Liquidity: $${formatLargeNumber(s.dexscreener.liquidity)}
  • 24h Volume: $${formatLargeNumber(s.dexscreener.volume24h)}
  • FDV: $${formatLargeNumber(s.dexscreener.fdv)}
  • Pair Age: ${pairAge}
  • DEX: ${s.dexscreener.dexId} on ${s.dexscreener.chainId}
  • 24h Txns: ${s.dexscreener.txns24h.buys} buys / ${s.dexscreener.txns24h.sells} sells`;
    }

    // CEX Availability Section
    if (s.cexListings && s.cexListings.length > 0) {
      const exchangeNames = s.cexListings.slice(0, 5).map(c => c.exchange).join(', ');
      const moreCount = s.cexListings.length > 5 ? s.cexListings.length - 5 : 0;
      
      section += `

🏦 CEX Availability (Centralized Exchanges):
  • Listed on: ${s.cexListings.length} major exchanges
  • Exchanges: ${exchangeNames}${moreCount > 0 ? ` (+${moreCount} more)` : ''}
  • Combined CEX 24h Volume: $${formatLargeNumber(s.cexTotalVolume)}
  
  ⚠️ DEX vs CEX Context:
  - DexScreener shows DEX (on-chain) liquidity only: $${formatLargeNumber(s.dexscreener?.liquidity || 0)}
  - CEX volume is typically 10-100x higher for established tokens
  - For tokens like PEPE, DOGE, SHIB - most trading happens on CEXs`;
    } else if (s.dexscreener && s.dexscreener.liquidity > 0) {
      section += `

🏦 CEX Availability:
  • No major CEX listings found in database
  • ⚠️ DEX-only tokens may have lower liquidity and higher slippage
  • Trading appears limited to on-chain DEXs`;
    }

    if (s.warnings.length > 0) {
      section += `

🚦 SECURITY WARNINGS:
${s.warnings.map(w => `  ${w}`).join('\n')}`;
    } else {
      section += `

🚦 No significant security warnings detected.`;
    }

    return section;
  });
  
  return `
═══════════════════════════════════════════
🛡️ TOKEN SECURITY & ON-CHAIN ANALYSIS
═══════════════════════════════════════════
${sections.join('\n\n')}

⚠️ IMPORTANT CONTEXT FOR AI:
• High social volume does NOT mean bullish - check if the buzz is about a hack, scam, or whale dump
• Galaxy Score measures ENGAGEMENT, not whether sentiment is positive or negative
• Always combine social metrics with on-chain data for a complete picture
• If security warnings exist, prominently display them to the user
• Never recommend buying tokens with honeypot or high-risk flags`;
}

function buildSystemPrompt(
  priceContext: string, 
  coinDetails: string,
  historicalContext: string,
  technicalContext: string,
  similarSuggestion: string,
  webSearchContext: string = "",
  companyContext: string = "",
  contractAddressContext: string = "",
  marketBriefsContext: string = "",
  derivativesContext: string = "",
  socialContext: string = "",
  newsContext: string = "",
  securityContext: string = "",
  enrichedCryptoContext: string = ""
): string {
  const currentDate = new Date().toLocaleDateString('en-US', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });
  const currentYear = new Date().getFullYear();
  
  return `
═══════════════════════════════════════════════════════════════════════════════
                    ZOMBIEDOG AI ASSISTANT - SYSTEM PROMPT v2.1
                    XRayCrypto's Intelligent Crypto Research Assistant
                    Last Updated: December 11, 2025
═══════════════════════════════════════════════════════════════════════════════

📅 CURRENT DATE: ${currentDate}
⚠️ We are in ${currentYear}. Any predictions about past dates are OUTDATED. Focus on LIVE data below.

═══════════════════════════════════════════
🧟🐕 IDENTITY
═══════════════════════════════════════════

You are **ZombieDog** 🧟🐕 - the AI-powered crypto research assistant for XRayCrypto (xraycrypto.io). You're not just another chatbot - you're a battle-tested market analyst with access to real-time social intelligence, on-chain security data, and deep market metrics that most traders never see.

**Personality:**
- Conversational but data-driven - you back up opinions with numbers
- No-BS attitude - you call out scams, honeypots, and red flags directly
- Slightly edgy humor (you're a zombie dog, after all)
- Educational - you explain the "why" behind your analysis
- Never give financial advice, but you DO give hard data and risk assessments

**Voice Examples:**
- "This token's Galaxy Score just dropped 15 points while social volume spiked - classic dump incoming pattern."
- "Honeypot detected. Contract has a 100% sell tax. Don't even think about it."
- "Sentiment's at 89% bullish but only 12 creators are talking about it - smells like coordinated shilling."

**Language:** Respond in the SAME LANGUAGE the user writes in. If they speak Spanish, reply in Spanish. If German, reply in German. Mirror their language while keeping your ZombieDog personality intact.

═══════════════════════════════════════════
🤖 AI PROVIDERS (Cost-Optimized Fallback Chain)
═══════════════════════════════════════════

You are powered by a smart fallback chain optimized for cost and reliability:

| Priority | Provider      | Model            | Use Case                   |
|----------|---------------|------------------|----------------------------|
| 1        | Lovable AI    | Gemini 2.5 Flash | Primary - included in plan |
| 2        | OpenAI        | GPT-4o-mini      | Fallback - low cost        |
| 3        | Anthropic     | Claude Haiku     | Fallback - low cost        |

This ensures you're always available while keeping operational costs minimal (~$25-50/month AI spend).

═══════════════════════════════════════════
📊 AVAILABLE DATA SOURCES
═══════════════════════════════════════════

### 1. LUNARCRUSH (Primary Social Intelligence)
Rate Limit: 10/min | Data Freshness: ~5-15 minutes

Available Metrics:
- galaxy_score: 0-100 overall health (>60 = healthy, <40 = weak)
- alt_rank: Performance vs all coins (1 = best)
- sentiment: 0-100 bullish/bearish ratio (>70 = bullish, <30 = bearish)
- social_volume_24h: Total mentions
- social_dominance: % of total crypto chatter
- interactions_24h: Engagements (likes, shares, comments)
- percent_change_1h/24h/7d: Price movements

⚠️ CRITICAL: High social volume does NOT mean bullish! Check if buzz is positive or negative.

### 2. GOPLUS SECURITY API (Contract Safety)
Rate Limit: 30/min | FREE

Security Checks:
- is_honeypot: TRUE = Cannot sell 🚨
- buy_tax/sell_tax: >10% suspicious, >50% scam
- is_mintable: TRUE = Can dilute supply
- is_proxy: TRUE = Contract can change
- owner_change_balance: TRUE = Owner can modify balances
- top10_holder_percent: >80% = whale controlled
- lp_holder_count: <3 = rug risk

Chain IDs: 1=Ethereum, 56=BSC, 137=Polygon, 42161=Arbitrum, 8453=Base, 43114=Avalanche

### 3. DEXSCREENER (DEX Liquidity & Trading)
Rate Limit: 300/min | FREE

Liquidity Risk Levels:
- <$10K = EXTREME RISK (can be drained in one tx)
- $10K-$50K = HIGH RISK
- $50K-$250K = MODERATE RISK
- $250K-$1M = LOWER RISK
- >$1M = Relatively safe

⚠️ CRITICAL CONTEXT - DEX vs CEX LIQUIDITY:
DexScreener shows ONLY decentralized exchange (DEX) liquidity - NOT the full picture!

**What DexScreener shows:** Uniswap, PancakeSwap, Raydium pools
**What it DOESN'T show:** Binance, Coinbase, OKX, Bybit, Kraken volume

For established tokens (BTC, ETH, PEPE, DOGE, SHIB, etc.):
- DEX liquidity might show $5-50M
- But CEX volume can be $100M-1B+ daily
- ALWAYS mention this distinction when reporting liquidity!

**Example response format:**
"DEX liquidity is $34M on Uniswap, but most PEPE trading happens on centralized exchanges 
with $400M+ daily volume across Binance, OKX, Coinbase and others."

### 4. TAVILY (Real-Time Web Search)
Use When: Breaking news, recent events, "why is X pumping/dumping?"
Capabilities: Real-time web search, regulatory news, project announcements

### 5. POLYGON.IO (Stocks + Technical Analysis)
Rate Limit: UNLIMITED

Technical Indicators:
- RSI: >70 overbought, <30 oversold
- MACD: Crossovers signal trend changes
- SMA/EMA: Price above = bullish, below = bearish

⚠️ Note: 91% failure rate for altcoins - use LunarCrush for crypto prices.

### 6. DERIVATIVES DATA (Funding & Open Interest)
- Funding Rate: Positive = longs paying shorts (bullish bias), Negative = bearish bias
- High positive funding (>0.1%) = Potential long squeeze
- High negative funding (<-0.1%) = Potential short squeeze
- OI divergence from price = Trend exhaustion signal

### 7. COMPANY DETAILS (For Stocks)
Source: Polygon.io
Data: Market cap, employees, sector, industry, financials, dividends, splits

### 8. XRAYCRYPTO MARKET BRIEFS (Last 7 Days)
Use: Reference what we said before - "In our morning brief, we noted..."

### 9. SUPABASE DATABASE (Internal)
Tables: crypto_snapshot (~3,000+ tokens), assets (17,466 records), token_contracts

### 10. COINGECKO (Supplementary)
Use For: Token metadata, historical prices, exchange listings

═══════════════════════════════════════════
📈 LIVE DATA CONTEXT
═══════════════════════════════════════════

${priceContext}
${coinDetails}
${companyContext}
${historicalContext}
${technicalContext}
${derivativesContext}
${socialContext}
${marketBriefsContext}
${newsContext}
${securityContext}
${webSearchContext}
${contractAddressContext}
${similarSuggestion}

═══════════════════════════════════════════
🔍 ANALYSIS FRAMEWORKS
═══════════════════════════════════════════

### Quick Token Analysis (When user asks "What do you think about X?")

1. PRICE CHECK
   - Current price, 24h/7d change
   - Market cap rank
   - Volume vs market cap ratio (healthy = 10-30%)

2. SOCIAL PULSE (LunarCrush)
   - Galaxy Score (>60 = healthy, <40 = weak)
   - Sentiment (>70 = bullish, <30 = bearish)
   - Social volume trend (rising/falling)
   - Creator count (organic if >100 unique)

3. SECURITY SCAN (GoPlus) - If contract address known
   - Honeypot check
   - Tax levels
   - Ownership status
   - Top holder concentration

4. LIQUIDITY CHECK (DexScreener) - For DEX tokens
   - Total liquidity
   - Buy/sell ratio
   - Pair age

5. VERDICT
   - Summarize key findings
   - Highlight red flags
   - Note positive signals
   - NEVER say "buy" or "sell" - present data, let user decide

### Deep Dive Analysis (When user asks for full research)

All Quick Analysis points, PLUS:
- Technical Analysis: RSI, MACD, support/resistance
- Derivatives Analysis: Funding rates, OI trends, liquidations
- Recent Context: What happened this week (from Market Briefs)
- Comparative Analysis: vs similar tokens in category
- Risk Assessment: Overall risk score (1-10)

═══════════════════════════════════════════
📝 RESPONSE PATTERNS
═══════════════════════════════════════════

### Token Analysis Format:
\`\`\`
🔍 **$TOKEN Analysis**

**Price Action:**
$X.XX | +X.X% (24h) | -X.X% (7d)
Market Cap: $X.XB (#XX) | Vol/MCap: XX% ✅/⚠️

**Social Intelligence:**
🌟 Galaxy Score: XX/100 (Strong/Weak)
😊 Sentiment: XX% Bullish/Bearish
📢 24h Mentions: XX.XK (+X%)
👥 Creators: X,XXX (Organic ✅ / Suspicious ⚠️)

**Security:** ✅/⚠️/🚨
- [Key findings]

**TL;DR:** [One sentence summary with key insight]
\`\`\`

### Security Scan Format:
\`\`\`
🔒 **Security Scan: $TOKEN**

🚨 **RED FLAGS DETECTED:** (if any)
- ⚠️ [Issue 1]
- ⚠️ [Issue 2]

✅ **Passed:**
- [Positive finding 1]

**Risk Level: HIGH/MEDIUM/LOW** 🔴/🟡/🟢
\`\`\`

### Market Trends Format:
\`\`\`
📊 **Market Pulse - [Date]**

**Overall Sentiment:** XX% Bullish
**This Week's Context:** (from Market Briefs)
- [Key event 1]
- [Key event 2]

**Hot Categories:**
1. 🤖 AI Tokens - Galaxy Score avg: XX
2. 🎮 Gaming - Galaxy Score avg: XX

**Derivatives Signal:**
- BTC funding: +X.XX% ([interpretation])
\`\`\`

═══════════════════════════════════════════
⚠️ SAFETY RULES
═══════════════════════════════════════════

1. **NEVER give financial advice** - Present data, not recommendations
2. **NEVER say "buy", "sell", "invest"** - Say "the data shows…" or "historically…"
3. **ALWAYS disclose data freshness** - "As of X minutes ago…"
4. **ALWAYS warn about risks** for low-cap tokens
5. **NEVER shill** - Even if sentiment is 100% bullish, present balanced view
6. **FLAG suspicious patterns** - Coordinated pumps, bot activity, etc.
7. **Always remind users to DYOR** (do your own research)

═══════════════════════════════════════════
🚨 ERROR HANDLING
═══════════════════════════════════════════

**Data unavailable:**
"I couldn't pull the security data for this token - it might be too new or on a chain I don't support yet. Here's what I DO have from social metrics..."

**Token not found:**
"I don't have data on $OBSCURE - it might be too small to track. Try giving me the contract address and chain, and I can run a security scan."

**Stock vs crypto:**
"That's a stock, not a crypto token. I can pull basic price data and technicals from Polygon, but my social intelligence is crypto-focused. Want me to check anyway?"

**Tavily no results:**
"I couldn't find recent news on that topic. Here's what I know from my other data sources..."

═══════════════════════════════════════════
👋 CONVERSATION STARTER
═══════════════════════════════════════════

When user says hi or asks what you can do:

"Hey! I'm ZombieDog 🧟🐕 - XRayCrypto's AI research assistant.

I can help you with:
• **Token Analysis** - "What do you think about $SOL?"
• **Security Scans** - "Is this contract safe?" + paste address
• **Social Intelligence** - "What's trending?" or "Who's talking about $BTC?"
• **Market Pulse** - "How's the market looking?"
• **Deep Dives** - "Give me full research on $ETH"
• **Breaking News** - "What's the latest on [topic]?"
• **Stock Data** - "How's $NVDA doing?" (limited)

I've got real-time data from LunarCrush (social), GoPlus (security), DexScreener (liquidity), Tavily (news), and more. What do you want to dig into?"

═══════════════════════════════════════════
📋 DATA SOURCE QUICK REFERENCE
═══════════════════════════════════════════

| Question Type       | Primary Source             | Backup Source            |
|---------------------|----------------------------|--------------------------|
| Token price/metrics | crypto_snapshot (Supabase) | LunarCrush MCP           |
| Social sentiment    | LunarCrush                 | -                        |
| Contract security   | GoPlus                     | -                        |
| DEX liquidity       | DexScreener                | -                        |
| Breaking news       | Tavily                     | LunarCrush news endpoint |
| Stock data          | Polygon.io                 | -                        |
| Technical analysis  | Polygon.io                 | -                        |
| Derivatives/funding | Derivatives API            | -                        |
| Recent context      | Market Briefs              | Tavily                   |

═══════════════════════════════════════════
💰 COST MANAGEMENT
═══════════════════════════════════════════

| Service                  | Monthly Cost |
|--------------------------|--------------|
| Supabase Pro             | $25          |
| Polygon Massive          | $84.59       |
| LunarCrush Individual    | $30          |
| CoinGecko Basic          | $29          |
| Tavily                   | Variable     |
| AI (Lovable + fallbacks) | ~$25-50      |
| **Total**                | ~$200-225/mo |

═══════════════════════════════════════════

${enrichedCryptoContext}

Remember: You're a battle-tested market analyst with comprehensive intelligence. Use ALL the data above! Never say you don't have access when data is provided. Be direct, be data-driven, and call out red flags without hesitation. 🧟🐕`;
}

// ============================================
// AI PROVIDER IMPLEMENTATIONS
// ============================================

// Call Lovable AI (Gemini 2.5 Flash via gateway)
async function callLovableAI(messages: any[], systemPrompt: string): Promise<Response> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) {
    throw new Error("LOVABLE_API_KEY not configured");
  }

  // Apply hybrid compression to messages
  const preparedMessages = prepareMessagesForAI(messages);
  console.log("[Lovable AI] Calling Gemini 2.5 Flash...");

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: systemPrompt },
        ...preparedMessages,
      ],
      stream: true,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[Lovable AI] Error:", response.status, errorText);
    throw new Error(`Lovable AI error: ${response.status}`);
  }

  return response;
}

// Call OpenAI (gpt-4o-mini)
async function callOpenAI(messages: any[], systemPrompt: string): Promise<Response> {
  const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
  if (!OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY not configured");
  }

  // Apply hybrid compression to messages
  const preparedMessages = prepareMessagesForAI(messages);
  console.log("[OpenAI] Calling GPT-4o-mini...");

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        ...preparedMessages,
      ],
      stream: true,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[OpenAI] Error:", response.status, errorText);
    throw new Error(`OpenAI error: ${response.status}`);
  }

  return response;
}

// Call Anthropic (Claude Haiku)
async function callAnthropic(messages: any[], systemPrompt: string): Promise<Response> {
  const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
  if (!ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY not configured");
  }

  // Apply hybrid compression to messages
  const preparedMessages = prepareMessagesForAI(messages);
  console.log("[Anthropic] Calling Claude Haiku...");

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-3-5-haiku-20241022",
      max_tokens: 1024,
      system: systemPrompt,
      messages: preparedMessages.map((m: any) => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content,
      })),
      stream: true,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[Anthropic] Error:", response.status, errorText);
    throw new Error(`Anthropic error: ${response.status}`);
  }

  return response;
}

// Transform OpenAI/Lovable stream to match what frontend expects
function transformOpenAIStream(response: Response): ReadableStream {
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffer = '';

  return new ReadableStream({
    async pull(controller) {
      const { done, value } = await reader.read();
      
      if (done) {
        controller.close();
        return;
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') {
            controller.enqueue(encoder.encode('event: message_stop\ndata: {}\n\n'));
            continue;
          }
          
          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              // Transform to Anthropic-like format for frontend
              const event = {
                type: 'content_block_delta',
                delta: { type: 'text_delta', text: content }
              };
              controller.enqueue(encoder.encode(`event: content_block_delta\ndata: ${JSON.stringify(event)}\n\n`));
            }
          } catch {
            // Skip malformed JSON
          }
        }
      }
    }
  });
}

// Try providers in order with fallback
async function callAIWithFallback(messages: any[], systemPrompt: string): Promise<{ 
  response: Response; 
  provider: AIProvider; 
  needsTransform: boolean;
  fallbackUsed: boolean;
  fallbackFrom: string | null;
}> {
  const providers: { name: AIProvider; fn: () => Promise<Response>; needsTransform: boolean }[] = [
    { name: 'lovable', fn: () => callLovableAI(messages, systemPrompt), needsTransform: true },
    { name: 'openai', fn: () => callOpenAI(messages, systemPrompt), needsTransform: true },
    { name: 'anthropic', fn: () => callAnthropic(messages, systemPrompt), needsTransform: false },
  ];

  let fallbackFrom: string | null = null;
  
  for (let i = 0; i < providers.length; i++) {
    const provider = providers[i];
    try {
      console.log(`[AI Fallback] Trying ${provider.name}...`);
      const response = await provider.fn();
      console.log(`[AI Fallback] ✅ ${provider.name} succeeded`);
      return { 
        response, 
        provider: provider.name, 
        needsTransform: provider.needsTransform,
        fallbackUsed: i > 0,
        fallbackFrom
      };
    } catch (error) {
      console.error(`[AI Fallback] ❌ ${provider.name} failed:`, error);
      if (i === 0) fallbackFrom = provider.name;
      continue;
    }
  }

  throw new Error("All AI providers failed");
}

// ============================================
// MAIN SERVER
// ============================================

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  // Get client IP for rate limiting
  const clientIp = getClientIP(req);
  console.log(`[Request] Client IP: ${clientIp}`);

  try {
    const body = await req.json();
    
    // Handle usage count request (for frontend to display remaining messages)
    if (body.action === 'get_usage') {
      const isAdmin = await isAdminUser(req, supabase);
      if (isAdmin) {
        return new Response(JSON.stringify({ 
          count: 0, 
          limit: -1, // -1 indicates unlimited
          remaining: -1,
          isAdmin: true 
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      const count = await getUsageCount(supabase, clientIp);
      return new Response(JSON.stringify({ 
        count, 
        limit: DAILY_MESSAGE_LIMIT,
        remaining: Math.max(0, DAILY_MESSAGE_LIMIT - count),
        isAdmin: false
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    const { messages } = body;

    console.log(`ZombieDog chat request with ${messages?.length || 0} messages`);
    
    // Check if user is admin (unlimited messages)
    const isAdmin = await isAdminUser(req, supabase);
    
    if (!isAdmin) {
      // Rate limiting for non-admin users
      const { allowed, remaining, resetTime } = await checkRateLimit(supabase, clientIp);
      
      if (!allowed) {
        console.log(`[Rate Limit] BLOCKED - IP ${clientIp} exceeded daily limit`);
        return new Response(JSON.stringify({ 
          error: 'rate_limit_exceeded',
          message: `Daily limit of ${DAILY_MESSAGE_LIMIT} messages reached. Resets at ${resetTime}.`,
          remaining: 0,
          resetTime 
        }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      console.log(`[Rate Limit] Allowed - ${remaining} messages remaining today`);
    } else {
      console.log(`[Rate Limit] Admin user - unlimited messages`);
    }

    // Get the latest user message to extract asset mentions
    const latestUserMessage = messages?.filter((m: any) => m.role === 'user').pop();
    const userQuery = latestUserMessage?.content || '';
    
    // 🔧 FIX: Extract recently discussed assets from conversation history
    const recentAssets = extractRecentAssets(messages || []);
    if (recentAssets.length > 0) {
      console.log(`[Context] Recently discussed assets: ${recentAssets.slice(0, 5).join(', ')}`);
    }
    
    // PHASE 5: AI-Powered Question Understanding (Gemini)
    // This replaces keyword-based matching with intelligent parsing
    // Pass conversation history AND recent assets to handle clarification follow-ups
    let questionUnderstanding = await understandQuestion(userQuery, messages || [], recentAssets);
    
    // 🔧 FIX: Database fallback - override clarification if we find a valid ticker in the message
    if (questionUnderstanding?.needsClarification) {
      // Check if there's an obvious ticker in the user's message
      const tickerMatch = userQuery.match(/\b([A-Z]{2,10})\b/);
      if (tickerMatch) {
        const potentialTicker = tickerMatch[1];
        // Filter out common non-ticker words
        const commonWords = ['THE', 'AND', 'FOR', 'NOT', 'YOU', 'ARE', 'BUT', 'CAN', 'NOW', 'HOW', 'WHY', 'WHO',
          'DEX', 'CEX', 'API', 'USD', 'EUR', 'NFT', 'DAO', 'TVL', 'APY', 'APR', 'ATH', 'ATL', 'ABOUT', 'THIS', 'THAT'];
        
        if (!commonWords.includes(potentialTicker)) {
          // Try direct database lookup
          const { data: tickerData } = await supabase
            .from('ticker_mappings')
            .select('symbol, display_name')
            .eq('symbol', potentialTicker)
            .single();
          
          if (tickerData) {
            console.log(`[Context Fix] Overrode AI clarification - found ${potentialTicker} in database`);
            questionUnderstanding = {
              ...questionUnderstanding,
              needsClarification: false,
              clarificationMessage: null,
              assets: [{
                symbol: tickerData.symbol,
                name: tickerData.display_name || tickerData.symbol,
                type: 'crypto',
                confidence: 0.9,
                contractAddress: null
              }]
            };
          }
        }
      }
      
      // 🔧 FIX: If still needs clarification but we have recent assets, use those
      if (questionUnderstanding?.needsClarification && recentAssets.length > 0) {
        // Check if user is asking a follow-up question (contains "this", "it", "that", or is a request)
        const isFollowUp = /\b(this|it|that|about|make|write|post|tweet|safe|buy|sell)\b/i.test(userQuery);
        if (isFollowUp) {
          // Look up the most recent asset in database
          const { data: recentTickerData } = await supabase
            .from('ticker_mappings')
            .select('symbol, display_name')
            .eq('symbol', recentAssets[0])
            .single();
          
          if (recentTickerData) {
            console.log(`[Context Fix] Using recent asset ${recentAssets[0]} for follow-up question`);
            questionUnderstanding = {
              ...questionUnderstanding,
              needsClarification: false,
              clarificationMessage: null,
              assets: [{
                symbol: recentTickerData.symbol,
                name: recentTickerData.display_name || recentTickerData.symbol,
                type: 'crypto',
                confidence: 0.85,
                contractAddress: null
              }]
            };
          }
        }
      }
    }
    
    // Handle clarification requests from AI (only if we couldn't resolve via database fallback)
    if (questionUnderstanding?.needsClarification && questionUnderstanding?.clarificationMessage) {
      console.log(`[Question Understanding] Clarification needed: ${questionUnderstanding.clarificationMessage}`);
      // Return clarification as a simple response without full AI call
      const clarificationResponse = `*tilts head curiously* 🐕\n\n${questionUnderstanding.clarificationMessage}\n\nPlease let me know which one you're asking about! *wags tail*`;
      
      // Log minimal usage for clarification
      await logAIUsage(supabase, 'lovable', 50, 30, 100, {
        questionTypes: ['clarification'],
        assetsQueried: [],
        dataSourcesUsed: ['gemini_understanding'],
        userMessagePreview: userQuery,
        clientIp,
      }).catch(e => console.error('[AI Usage] Background log failed:', e));
      
      // Return as SSE stream format for frontend compatibility
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        start(controller) {
          const event = {
            type: 'content_block_delta',
            delta: { type: 'text_delta', text: clarificationResponse }
          };
          controller.enqueue(encoder.encode(`event: content_block_delta\ndata: ${JSON.stringify(event)}\n\n`));
          controller.enqueue(encoder.encode('event: message_stop\ndata: {}\n\n'));
          controller.close();
        }
      });
      
      return new Response(stream, {
        headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
      });
    }
    
    // Use AI-parsed assets if available, otherwise fall back to database resolution
    let resolvedAssets: ResolvedAsset[] = [];
    let similarAssets: SimilarAsset[] = [];
    let contractsSearched: string[] = [];
    let contractWebLookups: Array<{address: string, info: string}> = [];
    
    if (questionUnderstanding && questionUnderstanding.assets.length > 0) {
      // AI identified assets - resolve them from database for full details
      console.log(`[AI Understanding] Assets identified: ${questionUnderstanding.assets.map(a => a.symbol).join(', ')}`);
      
      // Still use database resolution to get full asset details, but use AI-identified symbols
      const aiSymbols = questionUnderstanding.assets.map(a => a.symbol).join(' ');
      const dbResult = await resolveAssetsFromDatabase(supabase, aiSymbols);
      resolvedAssets = dbResult.assets;
      similarAssets = dbResult.similar;
      contractsSearched = dbResult.contractsSearched;
      contractWebLookups = dbResult.contractWebLookups;
      
      // If AI found assets but database didn't, create basic entries from AI understanding
      if (resolvedAssets.length === 0 && questionUnderstanding.assets.length > 0) {
        for (const aiAsset of questionUnderstanding.assets) {
          if (aiAsset.confidence >= 0.7) {
            resolvedAssets.push({
              symbol: aiAsset.symbol,
              coingeckoId: null,
              displayName: aiAsset.name,
              assetType: aiAsset.type === 'stock' ? 'stock' : 'crypto',
            });
          }
        }
        console.log(`[AI Understanding] Created ${resolvedAssets.length} assets from AI understanding`);
      }
    } else {
      // Fallback to traditional database resolution
      const dbResult = await resolveAssetsFromDatabase(supabase, userQuery);
      resolvedAssets = dbResult.assets;
      similarAssets = dbResult.similar;
      contractsSearched = dbResult.contractsSearched;
      contractWebLookups = dbResult.contractWebLookups;
    }
    
    console.log(`Resolved ${resolvedAssets.length} assets: ${resolvedAssets.map(a => `${a.symbol}(${a.assetType})`).join(', ') || 'none'}`);
    if (contractsSearched.length > 0) {
      console.log(`Contract addresses searched: ${contractsSearched.join(', ')}`);
    }
    if (contractWebLookups.length > 0) {
      console.log(`Found web info for ${contractWebLookups.length} contract(s)`);
    }
    
    // Extract symbols for data sources
    let cryptoSymbols = resolvedAssets.filter(a => a.assetType === 'crypto').map(a => a.symbol);
    const stockSymbols = resolvedAssets.filter(a => a.assetType === 'stock').map(a => a.symbol);
    let allSymbols = resolvedAssets.map(a => a.symbol);
    
    // 🔧 FIX: For general market questions with no specific assets, use TOP_CRYPTOS as default
    const isGeneralMarketQuestion = questionUnderstanding?.intent !== 'greeting' && 
      resolvedAssets.length === 0 &&
      /\b(market|crypto|trending|today|overall|general|how('s|s| is)|what('s|s| is)|pumping|movers|gainers|losers)\b/i.test(userQuery);

    if (isGeneralMarketQuestion) {
      console.log(`[General Market] No specific assets found - using TOP_CRYPTOS as default`);
      cryptoSymbols = TOP_CRYPTOS.slice(0, 10); // Top 10 for social/derivatives data
      allSymbols = [...cryptoSymbols];
    }
    
    const hasCrypto = cryptoSymbols.length > 0;
    const hasStocks = stockSymbols.length > 0;
    
    // SMART ROUTING: Use AI understanding if available, otherwise fall back to keywords
    let questionTypes: Set<QuestionType>;
    let routeConfig: SmartRouteConfigExtended;
    
    if (questionUnderstanding) {
      // AI-powered routing - more accurate, fewer unnecessary API calls
      questionTypes = understandingToQuestionTypes(questionUnderstanding);
      routeConfig = getSmartRouteConfigFromUnderstanding(questionUnderstanding);
      console.log(`[Smart Route] AI-powered - Intent: ${questionUnderstanding.intent}, Types: ${Array.from(questionTypes).join(', ')}`);
    } else {
      // Fallback to keyword-based routing
      questionTypes = detectQuestionTypesKeyword(userQuery);
      const baseConfig = getSmartRouteConfig(questionTypes, hasCrypto, hasStocks);
      routeConfig = { ...baseConfig, fetchSecurityCheck: false };
      console.log(`[Smart Route] Keyword-based - Types: ${Array.from(questionTypes).join(', ')}`);
    }
    console.log(`[Smart Route] Config: technicals=${routeConfig.fetchTechnicals}, derivs=${routeConfig.fetchDerivatives}, social=${routeConfig.fetchSocial}, news=${routeConfig.fetchNews}, briefs=${routeConfig.fetchBriefs}, webSearch=${routeConfig.fetchWebSearch}, security=${routeConfig.fetchSecurityCheck}`);
    
    // 🔧 FIX: For general market questions, enable social/derivatives even if AI didn't specify
    if (isGeneralMarketQuestion) {
      routeConfig.fetchSocial = true;
      routeConfig.fetchDerivatives = true;
      routeConfig.fetchBriefs = true;
      routeConfig.fetchNews = true;
      console.log(`[Smart Route] General market question - enabling all data sources`);
    }
    
    // Check if we should perform web search for news/current events
    const needsWebSearch = routeConfig.fetchWebSearch && shouldPerformWebSearch(userQuery);
    console.log(`Web search needed: ${needsWebSearch}`);
    
    // Extract contract addresses from resolved assets or user query for security checks
    const contractAddresses = extractContractAddresses(userQuery);
    const assetContractAddresses = resolvedAssets
      .filter(a => a.assetType === 'crypto')
      .map(a => {
        // Try to get contract address from the asset if available
        const aiAsset = questionUnderstanding?.assets?.find(ai => ai.symbol === a.symbol);
        return aiAsset?.contractAddress || null;
      })
      .filter((addr): addr is string => addr !== null && addr.startsWith('0x'));
    
    const allContractAddresses = [...new Set([
      ...contractAddresses.filter(c => c.type === 'evm').map(c => c.address),
      ...assetContractAddresses
    ])];
    
    // Fetch data in parallel - SMART ROUTING skips unnecessary calls
    const [
      prices, 
      coinDetails, 
      companyDetails, 
      historicalData, 
      technicalData, 
      webSearchResults,
      // Phase 1-4 data (conditionally fetched based on question type)
      relevantBriefs,
      derivativesData,
      socialData,
      newsData,
      // Phase 5: Security data (for safety questions)
      securityData
    ] = await Promise.all([
      // Always fetch: prices are cheap and always useful
      fetchLivePrices(supabase),
      // Always fetch for resolved crypto assets
      Promise.all(resolvedAssets.filter(a => a.assetType === 'crypto').map(a => fetchCoinDetail(supabase, a))),
      // Always fetch for resolved stock assets
      Promise.all(resolvedAssets.filter(a => a.assetType === 'stock').map(a => fetchCompanyDetails(supabase, a))),
      // Historical: fetch if technicals requested
      routeConfig.fetchTechnicals 
        ? Promise.all(resolvedAssets.map(a => fetchHistoricalContext(supabase, a)))
        : Promise.resolve([]),
      // Technicals: RSI, MACD - only for technical/price questions
      routeConfig.fetchTechnicals
        ? Promise.all(resolvedAssets.map(a => fetchTechnicalIndicators(supabase, a)))
        : Promise.resolve([]),
      // Web search: only for news questions
      needsWebSearch ? searchTavily(userQuery) : Promise.resolve([]),
      // Phase 1: Market briefs - for news/general questions
      routeConfig.fetchBriefs
        ? fetchRelevantBriefs(supabase, allSymbols)
        : Promise.resolve([]),
      // Phase 2: Derivatives - for derivatives/price questions on crypto
      routeConfig.fetchDerivatives
        ? fetchDerivativesData(supabase, cryptoSymbols)
        : Promise.resolve([]),
      // Phase 3: Social sentiment - for social/news questions on crypto
      routeConfig.fetchSocial
        ? fetchSocialContext(supabase, cryptoSymbols)
        : Promise.resolve([]),
      // Phase 4: News - for news questions
      routeConfig.fetchNews
        ? fetchAggregatedNews(supabase, allSymbols)
        : Promise.resolve({ news: [], sentiment: [] }),
      // Phase 5: Security - for safety questions with contract addresses (now includes CEX availability)
      (routeConfig.fetchSecurityCheck && allContractAddresses.length > 0)
        ? Promise.all(allContractAddresses.map(addr => fetchTokenSecurityContext(addr, 'ethereum', supabase)))
        : Promise.resolve([])
    ]);
    
    const validCoinDetails = coinDetails.filter((c): c is CoinDetail => c !== null);
    const validCompanyDetails = companyDetails.filter((c): c is CompanyDetails => c !== null);
    const validHistorical = historicalData.filter((h): h is HistoricalContext => h !== null);
    const validTechnicals = technicalData.filter((t): t is TechnicalIndicators => t !== null);
    
    // 🔧 NEW: Enrich all crypto assets with comprehensive crypto_snapshot data
    // This provides LunarCrush social metrics + contract addresses from our unified database
    const cryptoAssetSymbols = resolvedAssets.filter(a => a.assetType === 'crypto').map(a => a.symbol);
    const enrichmentPromises = cryptoAssetSymbols.map(sym => enrichWithCryptoSnapshot(supabase, sym));
    const enrichmentResults = await Promise.all(enrichmentPromises);
    const validEnrichedData = enrichmentResults.filter((e): e is EnrichedCryptoData => e !== null);
    
    console.log(`[Enrichment] Successfully enriched ${validEnrichedData.length}/${cryptoAssetSymbols.length} crypto assets with crypto_snapshot data`);
    
    // Calculate API calls saved
    const callsSkipped = [
      !routeConfig.fetchTechnicals ? 'technicals' : null,
      !routeConfig.fetchDerivatives ? 'derivatives' : null,
      !routeConfig.fetchSocial ? 'social' : null,
      !routeConfig.fetchNews ? 'news' : null,
      !routeConfig.fetchBriefs ? 'briefs' : null,
      !needsWebSearch ? 'webSearch' : null
    ].filter(Boolean);
    
    console.log(`Fetched: ${prices.length} prices, ${validCoinDetails.length} crypto details, ${validCompanyDetails.length} company details, ${validHistorical.length} historical, ${validTechnicals.length} technicals, ${webSearchResults.length} web results`);
    console.log(`Phase 1-4: ${relevantBriefs.length} briefs, ${derivativesData.length} derivs, ${socialData.length} social, ${newsData.news.length} news, ${newsData.sentiment.length} sentiment`);
    console.log(`[Smart Route] Skipped API calls: ${callsSkipped.length > 0 ? callsSkipped.join(', ') : 'none (general question)'}`);

    // Build context strings (original)
    const priceContext = formatPriceContext(prices);
    const coinDetailContext = formatCoinDetails(validCoinDetails);
    const companyContext = formatCompanyDetails(validCompanyDetails);
    const historicalContext = formatHistoricalContext(validHistorical);
    const technicalContext = formatTechnicalIndicators(validTechnicals);
    const webSearchContext = formatWebSearchResults(webSearchResults);
    
    // 🔧 NEW: Format enriched crypto data context
    const enrichedCryptoContext = formatEnrichedCryptoContext(validEnrichedData);
    
    // Build NEW context strings (Phases 1-4)
    const marketBriefsContext = formatMarketBriefs(relevantBriefs);
    const derivativesContext = formatDerivativesData(derivativesData);
    const socialContext = formatSocialComparison(socialData);
    const newsContext = formatNewsAndSentiment(newsData.news, newsData.sentiment);
    
    // 🔧 DEBUG: Log context lengths to diagnose "dumb" responses
    console.log(`[Context Debug] Price: ${priceContext.length} chars, Coin: ${coinDetailContext.length} chars, Social: ${socialContext.length} chars`);
    console.log(`[Context Debug] Derivatives: ${derivativesContext.length} chars, News: ${newsContext.length} chars, Briefs: ${marketBriefsContext.length} chars`);
    
    if (priceContext.length < 50 && coinDetailContext.length < 50 && socialContext.length < 50) {
      console.warn(`[Context Warning] Very little data being passed to AI! This may cause generic responses.`);
    }
    
    // Build Phase 5: Security context
    const validSecurityData = securityData.filter((s): s is TokenSecurityContext => s !== null);
    const securityContext = formatSecurityContext(validSecurityData);
    if (validSecurityData.length > 0) {
      console.log(`[Security] Fetched security data for ${validSecurityData.length} contract(s)`);
    }
    
    // Generate suggestions if no assets found
    const searchTerms = [...extractPotentialSymbols(userQuery), ...extractPotentialNames(userQuery)];
    const similarSuggestion = resolvedAssets.length === 0 && searchTerms.length > 0 
      ? formatSimilarAssetsSuggestion(similarAssets, searchTerms)
      : '';
    
    // Format contract address context
    let contractAddressContext = '';
    
    // 🔧 NEW: Fetch official contract addresses for resolved crypto assets
    // Especially important for verification questions ("is this the address of X?")
    const isVerificationQuestion = questionUnderstanding?.intent === 'verification' || 
      /\b(is this|verify|confirm|correct|right|address of)\b/i.test(userQuery);
    
    if (resolvedAssets.filter(a => a.assetType === 'crypto').length > 0 || isVerificationQuestion) {
      const cryptoAssets = resolvedAssets.filter(a => a.assetType === 'crypto');
      const contractInfoPromises = cryptoAssets.map(a => fetchTokenContractAddresses(supabase, a.symbol));
      const contractInfoResults = await Promise.all(contractInfoPromises);
      const validContractInfo = contractInfoResults.filter((c): c is TokenContractInfo => c !== null);
      
      if (validContractInfo.length > 0) {
        contractAddressContext = formatTokenContractAddresses(validContractInfo);
        console.log(`[Contract Addresses] Found official addresses for ${validContractInfo.length} token(s)`);
      }
    }
    
    // Add web lookup results if any
    if (contractWebLookups.length > 0) {
      const lookupResults = contractWebLookups.map(l => 
        `📋 Contract: ${l.address}\n${l.info}`
      ).join('\n\n');
      contractAddressContext += `
═══════════════════════════════════════════
🔗 CONTRACT ADDRESS LOOKUP RESULTS
═══════════════════════════════════════════
${lookupResults}

Use this information to tell the user what this contract address is (token, LP pair, DEX pool, etc.).
If it's a liquidity pool or DEX pair, explain which tokens are paired.
`;
    } else if (contractsSearched.length > 0 && resolvedAssets.length === 0) {
      // Contract searched but nothing found in DB or web
      contractAddressContext += `
═══════════════════════════════════════════
📋 CONTRACT ADDRESS SEARCH
═══════════════════════════════════════════
User searched for contract address(es): ${contractsSearched.join(', ')}
Result: Could not find these contract(s) in our database or via web search.

Please let the user know you couldn't identify this contract address. Suggest they:
1. Double-check the address is correct
2. Tell you the token name or symbol instead
3. Check block explorers like Etherscan, Solscan directly
4. The token/pool might be very new or unlisted
`;
    }
    
    // Build system prompt with ALL contexts
    const systemPrompt = buildSystemPrompt(
      priceContext, 
      coinDetailContext, 
      historicalContext, 
      technicalContext, 
      similarSuggestion, 
      webSearchContext, 
      companyContext, 
      contractAddressContext,
      // NEW: Phase 1-4 contexts
      marketBriefsContext,
      derivativesContext,
      socialContext,
      newsContext,
      // NEW: Phase 5 security context
      securityContext,
      // NEW: Enriched crypto data context (from crypto_snapshot)
      enrichedCryptoContext
    );

    // Track timing for latency measurement
    const aiStartTime = Date.now();
    
    // Estimate input tokens (system prompt + messages)
    const messagesText = messages.map((m: any) => m.content || '').join(' ');
    const inputTokens = estimateTokens(systemPrompt + messagesText);

    // Call AI with fallback chain
    const { response, provider, needsTransform, fallbackUsed, fallbackFrom } = await callAIWithFallback(messages, systemPrompt);

    const latencyMs = Date.now() - aiStartTime;
    console.log(`Streaming response from ${provider} (latency: ${latencyMs}ms)`);
    
    // Collect data sources used for logging
    const dataSourcesUsed: string[] = [];
    if (prices.length > 0) dataSourcesUsed.push('polygon_prices');
    if (validCoinDetails.length > 0) dataSourcesUsed.push('lunarcrush');
    if (validCompanyDetails.length > 0) dataSourcesUsed.push('polygon_company');
    if (validHistorical.length > 0) dataSourcesUsed.push('polygon_historical');
    if (validTechnicals.length > 0) dataSourcesUsed.push('polygon_technicals');
    if (webSearchResults.length > 0) dataSourcesUsed.push('tavily');
    if (relevantBriefs.length > 0) dataSourcesUsed.push('market_briefs');
    if (derivativesData.length > 0) dataSourcesUsed.push('derivatives');
    if (socialData.length > 0) dataSourcesUsed.push('social_sentiment');
    if (newsData.news.length > 0) dataSourcesUsed.push('news');
    
    // Create a stream wrapper to count output tokens and log after completion
    const originalStream = needsTransform ? transformOpenAIStream(response) : response.body;
    let outputText = '';
    
    const loggingStream = new ReadableStream({
      async start(controller) {
        const reader = originalStream!.getReader();
        const decoder = new TextDecoder();
        
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) {
              // Stream complete - log usage
              const outputTokens = estimateTokens(outputText);
              
              // Log in background (don't await) - include client IP for rate limiting
              logAIUsage(supabase, provider, inputTokens, outputTokens, latencyMs, {
                questionTypes: Array.from(questionTypes),
                assetsQueried: allSymbols,
                dataSourcesUsed,
                fallbackUsed,
                fallbackFrom: fallbackFrom || undefined,
                userMessagePreview: userQuery,
                clientIp,
              }).catch(e => console.error('[AI Usage] Background log failed:', e));
              
              controller.close();
              break;
            }
            
            // Capture text from stream for token counting
            const chunk = decoder.decode(value, { stream: true });
            // Extract text content from SSE events for accurate token counting
            const textMatch = chunk.match(/"text":"([^"]+)"/g);
            if (textMatch) {
              textMatch.forEach(m => {
                const text = m.replace(/"text":"/, '').replace(/"$/, '');
                outputText += text;
              });
            }
            
            controller.enqueue(value);
          }
        } catch (err) {
          controller.error(err);
        }
      }
    });

    return new Response(loggingStream, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (error) {
    console.error("ZombieDog chat error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
