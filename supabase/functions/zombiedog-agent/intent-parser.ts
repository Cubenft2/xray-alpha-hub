// LLM-based Intent Parser for ZombieDog
// Uses shared Zod schemas for strict validation

import { ParsedIntentSchema, type ParsedIntent } from "../_shared/validation-schemas.ts";

// Re-export for backwards compatibility
export { ParsedIntentSchema, type ParsedIntent };

const INTENT_SYSTEM_PROMPT = `You are an intent parser for ZombieDog, a crypto AND stock market assistant. Analyze the user's question and return JSON only.

## INTENTS (pick one):
- "market_overview": General CRYPTO market questions. Examples: "how's the market", "what's crypto doing today", "market update"
- "stock_market_overview": General STOCK market questions (no specific tickers). Examples: "how did stocks do", "stock market today", "how's the S&P", "market close", "trading day", "equity markets"
- "sector_analysis": Questions about a specific crypto sector. Examples: "AI coins", "meme tokens pumping", "how's DeFi"
- "token_lookup": Questions about specific crypto token(s). Examples: "how's BTC", "tell me about Solana", "ETH price"
- "stock_lookup": Questions about specific stock(s). Examples: "how's NVDA", "tell me about Apple", "TSLA price", "what's Tesla doing"
- "comparison": Comparing multiple assets. Examples: "BTC vs ETH", "compare NVDA and AMD"
- "trending": What's hot/moving. Examples: "top gainers", "what's pumping", "biggest losers"
- "news": News requests. Examples: "any news", "latest on Bitcoin"
- "general_chat": Greetings, thanks, meta questions. Examples: "hi", "thanks", "who are you"

## STOCK MARKET KEYWORDS (recognize as assetType: "stock", intent: "stock_market_overview"):
- "stock market", "stocks today", "market close", "trading day", "how did stocks", "equity market", "equities"
- "S&P 500", "S&P", "SP500", "SPX" → Default tickers: ["SPY", "QQQ", "DIA"]
- "Nasdaq", "Nasdaq 100", "QQQ" → Default tickers: ["QQQ"]
- "Dow Jones", "Dow", "DJI", "DIA" → Default tickers: ["DIA"]
- "NYSE", "indices", "close bell" → Default tickers: ["SPY", "QQQ", "DIA"]
- IMPORTANT: If query mentions "stock market" or "stocks" without crypto keywords (bitcoin, crypto, eth, token, coin, defi, web3), set assetType: "stock" and intent: "stock_market_overview"

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
- "forex": Question is about forex pairs or precious metals (gold, silver, EUR/USD, XAU, XAG)
- "mixed": Question involves multiple types or is unclear

## FOREX/COMMODITY KEYWORDS (recognize as assetType: "forex"):
### Precious Metals:
- Gold/XAU/XAUUSD → ticker: "XAUUSD"
- Silver/XAG/XAGUSD → ticker: "XAGUSD"
- Platinum/XPT/XPTUSD → ticker: "XPTUSD"
- Palladium/XPD/XPDUSD → ticker: "XPDUSD"
- "precious metals" / "metals" → tickers: ["XAUUSD", "XAGUSD", "XPTUSD", "XPDUSD"] (ALL 4 metals)

### Major Currency Pairs:
- EUR/USD, EURUSD, Euro → ticker: "EURUSD"
- GBP/USD, GBPUSD, Pound, Sterling → ticker: "GBPUSD"
- USD/JPY, USDJPY, Yen → ticker: "USDJPY"
- USD/CAD, USDCAD, Loonie → ticker: "USDCAD"
- AUD/USD, AUDUSD, Aussie → ticker: "AUDUSD"
- NZD/USD, NZDUSD, Kiwi → ticker: "NZDUSD"
- USD/CHF, USDCHF, Swissy → ticker: "USDCHF"
- "forex market" / "major forex" / "currency pairs" / "majors" → tickers: ["EURUSD", "GBPUSD", "USDJPY", "USDCAD", "AUDUSD"]
- Precious metals, commodities, forex, currency pairs → assetType: "forex"

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

## DEPTH (for analysis detail level):
- "normal": Standard response (default)
- "deep": Comprehensive analysis with ALL data sources

**Deep analysis triggers** (set depth: "deep"):
- "full analysis", "complete analysis", "comprehensive analysis"
- "deep dive", "detailed analysis", "everything about"
- "tell me everything", "full report", "breakdown"
- "liquidations", "derivatives", "funding rate" (specific data requests)

## RULES:
1. Return ONLY valid JSON - no markdown, no backticks
2. ALWAYS include assetType field ("crypto", "stock", or "mixed")
3. Use stock_lookup for stock questions, token_lookup for crypto
4. If unclear whether crypto or stock, use assetType: "mixed"
5. Include brief "summary" explaining interpretation
6. Set depth: "deep" when user wants comprehensive analysis

## EXAMPLES:
"How's NVDA doing?" → {"intent":"stock_lookup","sector":null,"stockSector":"tech","tickers":["NVDA"],"assetType":"stock","timeframe":"24h","action":null,"summary":"User asking about Nvidia stock","depth":"normal"}
"What's Tesla's price?" → {"intent":"stock_lookup","sector":null,"stockSector":"auto","tickers":["TSLA"],"assetType":"stock","timeframe":"24h","action":null,"summary":"User asking about Tesla stock price","depth":"normal"}
"Compare AAPL and MSFT" → {"intent":"comparison","sector":null,"stockSector":"tech","tickers":["AAPL","MSFT"],"assetType":"stock","timeframe":"24h","action":null,"summary":"Comparing Apple and Microsoft stocks","depth":"normal"}
"Top tech stocks" → {"intent":"stock_lookup","sector":null,"stockSector":"tech","tickers":[],"assetType":"stock","timeframe":"24h","action":"gainers","summary":"User wants top tech stocks","depth":"normal"}
"How's BTC doing?" → {"intent":"token_lookup","sector":null,"stockSector":null,"tickers":["BTC"],"assetType":"crypto","timeframe":"24h","action":null,"summary":"User asking about Bitcoin","depth":"normal"}
"What meme coins are pumping?" → {"intent":"sector_analysis","sector":"meme","stockSector":null,"tickers":[],"assetType":"crypto","timeframe":"24h","action":"gainers","summary":"User wants top meme coins","depth":"normal"}
"How's the market?" → {"intent":"market_overview","sector":null,"stockSector":null,"tickers":[],"assetType":"crypto","timeframe":"24h","action":null,"summary":"General crypto market overview","depth":"normal"}
"How did the stock market close today?" → {"intent":"stock_market_overview","sector":null,"stockSector":null,"tickers":["SPY","QQQ","DIA"],"assetType":"stock","timeframe":"24h","action":null,"summary":"User asking about stock market close","depth":"normal"}
"What happened in stocks today?" → {"intent":"stock_market_overview","sector":null,"stockSector":null,"tickers":["SPY","QQQ","DIA","AAPL","MSFT","NVDA"],"assetType":"stock","timeframe":"24h","action":null,"summary":"User asking about stock market performance","depth":"normal"}
"Give me a breakdown of the S&P 500, Nasdaq, and Dow" → {"intent":"stock_market_overview","sector":null,"stockSector":null,"tickers":["SPY","QQQ","DIA"],"assetType":"stock","timeframe":"24h","action":null,"summary":"User wants major indices performance","depth":"normal"}
"What's gold doing?" → {"intent":"token_lookup","sector":null,"stockSector":null,"tickers":["XAUUSD"],"assetType":"forex","timeframe":"24h","action":null,"summary":"User asking about gold price","depth":"normal"}
"Give me a full analysis of ZEC" → {"intent":"token_lookup","sector":"privacy","stockSector":null,"tickers":["ZEC"],"assetType":"crypto","timeframe":"24h","action":null,"summary":"User wants comprehensive ZEC analysis","depth":"deep"}
"Deep dive on ETH with liquidation data" → {"intent":"token_lookup","sector":"l1","stockSector":null,"tickers":["ETH"],"assetType":"crypto","timeframe":"24h","action":null,"summary":"User wants deep ETH analysis with derivatives","depth":"deep"}
"Tell me everything about Solana" → {"intent":"token_lookup","sector":"l1","stockSector":null,"tickers":["SOL"],"assetType":"crypto","timeframe":"24h","action":null,"summary":"User wants full Solana report","depth":"deep"}
"Give me a forex update" → {"intent":"market_overview","sector":null,"stockSector":null,"tickers":["EURUSD","GBPUSD","USDJPY","USDCAD","AUDUSD","XAUUSD","XAGUSD"],"assetType":"forex","timeframe":"24h","action":null,"summary":"User wants forex and metals overview","depth":"normal"}`;

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
    case 'stock_market_overview':
    case 'sector_analysis':
    case 'trending':
      return { ...base, fetchPrices: true, fetchSocial: true };
      
    case 'token_lookup':
    case 'stock_lookup':
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
