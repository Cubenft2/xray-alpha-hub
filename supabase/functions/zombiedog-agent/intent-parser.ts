// LLM-based Intent Parser for ZombieDog
// Replaces regex-based routing with OpenAI understanding

export interface ParsedIntent {
  intent: 'market_overview' | 'sector_analysis' | 'token_lookup' | 'comparison' | 'trending' | 'news' | 'general_chat';
  sector: 'ai' | 'defi' | 'meme' | 'gaming' | 'l1' | 'l2' | 'nft' | 'privacy' | 'storage' | 'rwa' | 'btc_eco' | null;
  tickers: string[];
  timeframe: 'now' | 'today' | '24h' | 'week' | 'month';
  action: 'gainers' | 'losers' | 'movers' | 'volume' | null;
  summary: string;
}

const INTENT_SYSTEM_PROMPT = `You are an intent parser for ZombieDog, a crypto market assistant. Analyze the user's question and return JSON only.

## INTENTS (pick one):
- "market_overview": General market questions. Examples: "how's the market", "what's crypto doing today", "market update", "what's happening in crypto"
- "sector_analysis": Questions about a specific sector/category. Examples: "AI coins", "meme tokens pumping", "how's DeFi", "L1 comparison"
- "token_lookup": Questions about specific token(s). Examples: "how's BTC", "tell me about Solana", "ETH price", "what's WLFI doing"
- "comparison": Comparing multiple tokens. Examples: "BTC vs ETH", "compare SOL and AVAX", "which is better"
- "trending": What's hot/moving/gaining/losing. Examples: "top gainers", "what's pumping", "biggest losers", "what should I watch"
- "news": News/headlines requests. Examples: "any news", "latest on Bitcoin", "what happened with ETH"
- "general_chat": Greetings, thanks, meta questions. Examples: "hi", "thanks", "who are you", "what can you do"

## SECTORS (if mentioned, else null):
- "ai": AI, artificial intelligence, machine learning, ML tokens (FET, TAO, RENDER, LINK, AGIX, OCEAN, AKT, NEAR, GRT, THETA)
- "defi": DeFi, decentralized finance, yield, lending, DEX (AAVE, UNI, SUSHI, CRV, MKR, COMP)
- "meme": Meme coins, dog coins, community tokens (DOGE, SHIB, PEPE, FLOKI, BONK, WIF)
- "gaming": Gaming, metaverse, play-to-earn, GameFi (AXS, SAND, MANA, IMX, GALA, ENJ)
- "l1": Layer 1, alt L1s, base chains (ETH, SOL, AVAX, ADA, DOT, NEAR, ATOM)
- "l2": Layer 2, rollups, scaling (ARB, OP, MATIC, BASE, ZK)
- "nft": NFT-related tokens
- "privacy": Privacy coins, anonymous, untraceable, confidential (XMR, ZEC, DASH, SCRT, ZEN, XVG, Monero, Zcash)
- "storage": Storage, decentralized storage, data, file sharing (FIL, AR, SC, STORJ, BTT)
- "rwa": Real world assets, tokenization, RWA (ONDO, PENDLE, MKR)
- "btc_eco": Bitcoin ecosystem, ordinals, BRC-20, runes (STX, RUNE, ORDI, SATS)

## TICKERS: Extract any crypto/stock symbols. Convert names to symbols:
- Bitcoin/BTC → BTC
- Ethereum/ETH → ETH
- Solana/SOL → SOL
- Fetch.ai/Fetch → FET
- Bittensor → TAO
- Render/RNDR → RENDER
- Chainlink → LINK
- World Liberty Financial/WLFI → WLFI
- Dogecoin → DOGE
- Nvidia → NVDA
- Coinbase → COIN

## TIMEFRAME: now, today, 24h (default), week, month

## ACTION (for trending/sector intent):
- "gainers": up, green, pumping, ripping, mooning
- "losers": down, red, dumping, crashing, bleeding, rekt
- "movers": moving, volatile, action
- "volume": volume, trading, liquidity

## RULES:
1. Return ONLY valid JSON - no markdown, no backticks, no explanation
2. If intent is unclear, default to "market_overview"
3. Be liberal with sector detection - "AI crypto", "artificial intelligence tokens", "ML coins" all = "ai"
4. Crypto slang counts: "pumping" = gainers, "dumping" = losers, "rekt" = losers
5. Include a brief "summary" field explaining your interpretation

## EXAMPLES:
"How is the AI crypto market today?" → {"intent":"sector_analysis","sector":"ai","tickers":[],"timeframe":"today","action":null,"summary":"User asking about AI sector performance today"}
"What's BTC doing?" → {"intent":"token_lookup","sector":null,"tickers":["BTC"],"timeframe":"24h","action":null,"summary":"User asking about Bitcoin price/status"}
"Top gainers" → {"intent":"trending","sector":null,"tickers":[],"timeframe":"24h","action":"gainers","summary":"User wants top performing tokens"}
"What meme coins are pumping?" → {"intent":"sector_analysis","sector":"meme","tickers":[],"timeframe":"24h","action":"gainers","summary":"User wants top gaining meme coins"}
"Compare SOL and AVAX" → {"intent":"comparison","sector":null,"tickers":["SOL","AVAX"],"timeframe":"24h","action":null,"summary":"User wants comparison of Solana vs Avalanche"}
"Yo what's good" → {"intent":"general_chat","sector":null,"tickers":[],"timeframe":"24h","action":null,"summary":"Casual greeting"}
"What's happening with artificial intelligence tokens?" → {"intent":"sector_analysis","sector":"ai","tickers":[],"timeframe":"24h","action":null,"summary":"User asking about AI sector"}
"Give me the rundown on Fetch and Bittensor" → {"intent":"token_lookup","sector":"ai","tickers":["FET","TAO"],"timeframe":"24h","action":null,"summary":"User wants info on specific AI tokens"}
"What AI coins are pumping today?" → {"intent":"sector_analysis","sector":"ai","tickers":[],"timeframe":"today","action":"gainers","summary":"User wants top AI sector gainers today"}`;

const DEFAULT_INTENT: ParsedIntent = {
  intent: 'market_overview',
  sector: null,
  tickers: [],
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
    
    const parsed = JSON.parse(jsonStr);
    
    const result: ParsedIntent = {
      intent: parsed.intent || 'market_overview',
      sector: parsed.sector || null,
      tickers: (parsed.tickers || []).map((t: string) => t.toUpperCase()),
      timeframe: parsed.timeframe || '24h',
      action: parsed.action || null,
      summary: parsed.summary || 'Parsed successfully'
    };
    
    console.log(`[intent-parser] Result (${latencyMs}ms): intent=${result.intent}, sector=${result.sector}, tickers=[${result.tickers.join(',')}], action=${result.action}`);
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
