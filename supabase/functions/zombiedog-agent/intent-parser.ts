// LLM-based Intent Parser for ZombieDog
// Uses Zod for strict validation of AI responses

import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

// ============= Zod Schema for ParsedIntent =============
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
  assetType: z.enum(['crypto', 'stock', 'mixed']).default('crypto'),
  timeframe: z.enum(['now', 'today', '24h', 'week', 'month']).default('24h'),
  action: z.enum(['gainers', 'losers', 'movers', 'volume']).nullable().default(null),
  summary: z.string().default('Parsed successfully'),
});

// Derive TypeScript type from schema (single source of truth)
export type ParsedIntent = z.infer<typeof ParsedIntentSchema>;

const INTENT_SYSTEM_PROMPT = `You are an intent parser for ZombieDog, a crypto AND stock market assistant. Analyze the user's question and return JSON only.

## INTENTS (pick one):
- "market_overview": General market questions. Examples: "how's the market", "what's crypto doing today", "market update"
- "sector_analysis": Questions about a specific crypto sector. Examples: "AI coins", "meme tokens pumping", "how's DeFi"
- "token_lookup": Questions about specific crypto token(s). Examples: "how's BTC", "tell me about Solana", "ETH price"
- "stock_lookup": Questions about specific stock(s). Examples: "how's NVDA", "tell me about Apple", "TSLA price", "what's Tesla doing"
- "comparison": Comparing multiple assets. Examples: "BTC vs ETH", "compare NVDA and AMD"
- "trending": What's hot/moving. Examples: "top gainers", "what's pumping", "biggest losers"
- "news": News requests. Examples: "any news", "latest on Bitcoin"
- "general_chat": Greetings, thanks, meta questions. Examples: "hi", "thanks", "who are you"

## CRYPTO SECTORS (sector field, null if not crypto sector):
- "ai": AI tokens (FET, TAO, RENDER, LINK, AGIX, OCEAN)
- "defi": DeFi (AAVE, UNI, SUSHI, CRV, MKR)
- "meme": Meme coins (DOGE, SHIB, PEPE, FLOKI, BONK, WIF)
- "gaming": Gaming/metaverse (AXS, SAND, MANA, IMX, GALA)
- "l1": Layer 1 chains (ETH, SOL, AVAX, ADA, DOT)
- "l2": Layer 2 (ARB, OP, MATIC)
- "nft": NFT tokens
- "privacy": Privacy coins (XMR, ZEC, DASH)
- "storage": Storage (FIL, AR, SC)
- "rwa": Real world assets (ONDO, PENDLE)
- "btc_eco": Bitcoin ecosystem (STX, RUNE, ORDI)

## STOCK SECTORS (stockSector field, null if not stock sector):
- "tech": Technology, software, semiconductors (NVDA, AAPL, MSFT, GOOG, META, AMD, INTC)
- "healthcare": Pharmaceuticals, biotech, medical (LLY, UNH, JNJ, PFE, ABBV, MRK)
- "finance": Banks, insurance, fintech (JPM, BAC, GS, V, MA, COIN)
- "energy": Oil, gas, energy (XOM, CVX, COP, SLB)
- "retail": Retail, e-commerce (AMZN, WMT, COST, TGT, HD)
- "auto": Automotive (TSLA, F, GM, RIVN)
- "aerospace": Aerospace, defense (BA, LMT, RTX, NOC)
- "utilities": Electric, utilities (NEE, DUK, SO)
- "communications": Telecom, media (VZ, T, CMCSA, DIS)

## ASSET TYPE (assetType field - REQUIRED):
- "crypto": Question is about cryptocurrency (BTC, ETH, SOL, etc.)
- "stock": Question is about stocks (NVDA, AAPL, TSLA, etc.)
- "mixed": Question involves both or is unclear

## COMMON STOCK SYMBOLS (recognize these as stocks):
- Apple/AAPL → AAPL (stock)
- Nvidia/NVDA → NVDA (stock)
- Tesla/TSLA → TSLA (stock)
- Microsoft/MSFT → MSFT (stock)
- Google/Alphabet/GOOG/GOOGL → GOOG (stock)
- Amazon/AMZN → AMZN (stock)
- Meta/Facebook/META → META (stock)
- Coinbase/COIN → COIN (stock)
- AMD → AMD (stock)
- Intel/INTC → INTC (stock)

## COMMON CRYPTO SYMBOLS (recognize these as crypto):
- Bitcoin/BTC → BTC (crypto)
- Ethereum/ETH → ETH (crypto)
- Solana/SOL → SOL (crypto)
- Dogecoin/DOGE → DOGE (crypto)

## TIMEFRAME: now, today, 24h (default), week, month

## ACTION (for trending/sector):
- "gainers": up, green, pumping, mooning
- "losers": down, red, dumping, crashing
- "movers": moving, volatile
- "volume": volume, trading

## RULES:
1. Return ONLY valid JSON - no markdown, no backticks
2. ALWAYS include assetType field ("crypto", "stock", or "mixed")
3. Use stock_lookup for stock questions, token_lookup for crypto
4. If unclear whether crypto or stock, use assetType: "mixed"
5. Include brief "summary" explaining interpretation

## EXAMPLES:
"How's NVDA doing?" → {"intent":"stock_lookup","sector":null,"stockSector":"tech","tickers":["NVDA"],"assetType":"stock","timeframe":"24h","action":null,"summary":"User asking about Nvidia stock"}
"What's Tesla's price?" → {"intent":"stock_lookup","sector":null,"stockSector":"auto","tickers":["TSLA"],"assetType":"stock","timeframe":"24h","action":null,"summary":"User asking about Tesla stock price"}
"Compare AAPL and MSFT" → {"intent":"comparison","sector":null,"stockSector":"tech","tickers":["AAPL","MSFT"],"assetType":"stock","timeframe":"24h","action":null,"summary":"Comparing Apple and Microsoft stocks"}
"Top tech stocks" → {"intent":"stock_lookup","sector":null,"stockSector":"tech","tickers":[],"assetType":"stock","timeframe":"24h","action":"gainers","summary":"User wants top tech stocks"}
"How's BTC doing?" → {"intent":"token_lookup","sector":null,"stockSector":null,"tickers":["BTC"],"assetType":"crypto","timeframe":"24h","action":null,"summary":"User asking about Bitcoin"}
"What meme coins are pumping?" → {"intent":"sector_analysis","sector":"meme","stockSector":null,"tickers":[],"assetType":"crypto","timeframe":"24h","action":"gainers","summary":"User wants top meme coins"}
"How's the market?" → {"intent":"market_overview","sector":null,"stockSector":null,"tickers":[],"assetType":"mixed","timeframe":"24h","action":null,"summary":"General market overview"}`;

const DEFAULT_INTENT: ParsedIntent = {
  intent: 'market_overview',
  sector: null,
  stockSector: null,
  tickers: [],
  assetType: 'crypto',
  timeframe: '24h',
  action: null,
  summary: 'Fallback to market overview'
};

export async function parseIntent(query: string): Promise<ParsedIntent> {
  const openAIKey = Deno.env.get('OPENAI_API_KEY');
  
  if (!openAIKey) {
    console.error('[intent-parser] OPENAI_API_KEY not found!');
    return DEFAULT_INTENT;
  }

  try {
    console.log(`[intent-parser] Parsing: "${query}"`);
    const startTime = Date.now();
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        max_tokens: 200,
        temperature: 0,
        messages: [
          { role: 'system', content: INTENT_SYSTEM_PROMPT },
          { role: 'user', content: query }
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[intent-parser] OpenAI error: ${response.status} ${response.statusText} - ${errorText}`);
      return DEFAULT_INTENT;
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    const latencyMs = Date.now() - startTime;
    
    if (!content) {
      console.error('[intent-parser] No content in response');
      return DEFAULT_INTENT;
    }

    // Parse JSON - handle potential markdown wrapping
    let jsonStr = content.trim();
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
    }
    
    const rawParsed = JSON.parse(jsonStr);
    
    // Validate with Zod - safeParse won't throw
    const validation = ParsedIntentSchema.safeParse(rawParsed);
    
    if (!validation.success) {
      console.error(`[intent-parser] Zod validation failed:`, {
        rawResponse: jsonStr.slice(0, 500),
        issues: validation.error.issues.map(i => `${i.path.join('.')}: ${i.message}`),
      });
      return DEFAULT_INTENT;
    }
    
    // Normalize tickers to uppercase
    const result: ParsedIntent = {
      ...validation.data,
      tickers: validation.data.tickers.map(t => t.toUpperCase()),
    };
    
    console.log(`[intent-parser] Result (${latencyMs}ms): intent=${result.intent}, sector=${result.sector}, stockSector=${result.stockSector}, tickers=[${result.tickers.join(',')}], assetType=${result.assetType}, action=${result.action}`);
    console.log(`[intent-parser] Summary: ${result.summary}`);
    
    return result;
    
  } catch (err) {
    console.error(`[intent-parser] Error: ${err}`);
    return DEFAULT_INTENT;
  }
}

// Map ParsedIntent to RouteConfig-compatible format for backwards compatibility
export function mapIntentToRouteConfig(intent: ParsedIntent): {
  fetchPrices: boolean;
  fetchSocial: boolean;
  fetchDerivs: boolean;
  fetchSecurity: boolean;
  fetchNews: boolean;
  fetchCharts: boolean;
  fetchDetails: boolean;
} {
  const base = {
    fetchPrices: false,
    fetchSocial: false,
    fetchDerivs: false,
    fetchSecurity: false,
    fetchNews: false,
    fetchCharts: false,
    fetchDetails: false,
  };

  switch (intent.intent) {
    case 'market_overview':
    case 'sector_analysis':
    case 'trending':
      return { ...base, fetchPrices: true, fetchSocial: true };
      
    case 'token_lookup':
      return { ...base, fetchPrices: true, fetchSocial: true, fetchCharts: true, fetchDetails: true };
      
    case 'comparison':
      return { ...base, fetchPrices: true, fetchSocial: true, fetchCharts: true };
      
    case 'news':
      return { ...base, fetchNews: true, fetchPrices: true };
      
    case 'general_chat':
    default:
      return base;
  }
}
