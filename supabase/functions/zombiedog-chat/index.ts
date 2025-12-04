import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Top cryptos to fetch general prices for
const TOP_CRYPTOS = ['BTC', 'ETH', 'SOL', 'XRP', 'ADA', 'DOGE', 'LINK', 'AVAX', 'DOT', 'MATIC', 'SHIB', 'UNI', 'LTC', 'BCH', 'ATOM'];

// Common crypto name mappings (names/nicknames -> symbol)
const CRYPTO_NAME_MAP: Record<string, string> = {
  // Major coins
  'bitcoin': 'BTC', 'btc': 'BTC', 'corn': 'BTC', 'sats': 'BTC',
  'ethereum': 'ETH', 'eth': 'ETH', 'ether': 'ETH',
  'solana': 'SOL', 'sol': 'SOL',
  'ripple': 'XRP', 'xrp': 'XRP',
  'cardano': 'ADA', 'ada': 'ADA',
  'bnb': 'BNB', 'binance': 'BNB', 'binance coin': 'BNB',
  'litecoin': 'LTC', 'ltc': 'LTC', 'lite': 'LTC',
  'polkadot': 'DOT', 'dot': 'DOT',
  'polygon': 'MATIC', 'matic': 'MATIC',
  'chainlink': 'LINK', 'link': 'LINK',
  'avalanche': 'AVAX', 'avax': 'AVAX',
  'uniswap': 'UNI', 'uni': 'UNI',
  'cosmos': 'ATOM', 'atom': 'ATOM',
  
  // Memecoins
  'dogecoin': 'DOGE', 'doge': 'DOGE', 'dogie': 'DOGE', 'the doge': 'DOGE',
  'shiba': 'SHIB', 'shib': 'SHIB', 'shiba inu': 'SHIB', 'shib inu': 'SHIB', 'shibu': 'SHIB',
  'pepe': 'PEPE', 'pepe coin': 'PEPE', 'pepecoin': 'PEPE', 'the frog': 'PEPE',
  'bonk': 'BONK', 'bonk inu': 'BONK',
  'floki': 'FLOKI', 'floki inu': 'FLOKI',
  'wif': 'WIF', 'dogwifhat': 'WIF', 'dog wif hat': 'WIF', 'dog with hat': 'WIF',
  'brett': 'BRETT', 'based brett': 'BRETT',
  'mog': 'MOG', 'mog coin': 'MOG',
  'popcat': 'POPCAT', 'pop cat': 'POPCAT',
  'andy': 'ANDY',
  'turbo': 'TURBO',
  'cat in dogs world': 'MEW', 'mew': 'MEW',
  'book of meme': 'BOME', 'bome': 'BOME',
  'neiro': 'NEIRO',
  
  // Layer 2s & Alt L1s
  'arbitrum': 'ARB', 'arb': 'ARB',
  'optimism': 'OP', 'op': 'OP',
  'base': 'BASE',
  'sui': 'SUI',
  'aptos': 'APT', 'apt': 'APT',
  'sei': 'SEI',
  'near': 'NEAR', 'near protocol': 'NEAR',
  'celestia': 'TIA', 'tia': 'TIA',
  'injective': 'INJ', 'inj': 'INJ',
  'toncoin': 'TON', 'ton': 'TON', 'telegram coin': 'TON',
  'monad': 'MON', 'mon': 'MON', 'mon protocol': 'MON',
  'kaspa': 'KAS', 'kas': 'KAS',
  'mantle': 'MNT', 'mnt': 'MNT',
  'starknet': 'STRK', 'strk': 'STRK',
  'zksync': 'ZK', 'zk': 'ZK',
  
  // AI coins
  'render': 'RNDR', 'rndr': 'RNDR', 'render token': 'RNDR',
  'fetch': 'FET', 'fet': 'FET', 'fetch ai': 'FET', 'fetchai': 'FET',
  'worldcoin': 'WLD', 'wld': 'WLD', 'world coin': 'WLD',
  'bittensor': 'TAO', 'tao': 'TAO',
  'akash': 'AKT', 'akt': 'AKT', 'akash network': 'AKT',
  'ocean': 'OCEAN', 'ocean protocol': 'OCEAN',
  'singularitynet': 'AGIX', 'agix': 'AGIX',
  
  // DeFi
  'aave': 'AAVE',
  'maker': 'MKR', 'mkr': 'MKR', 'makerdao': 'MKR',
  'compound': 'COMP', 'comp': 'COMP',
  'curve': 'CRV', 'crv': 'CRV', 'curve finance': 'CRV',
  'synthetix': 'SNX', 'snx': 'SNX',
  'lido': 'LDO', 'ldo': 'LDO', 'lido dao': 'LDO',
  'pancakeswap': 'CAKE', 'cake': 'CAKE', 'pancake': 'CAKE',
  'sushiswap': 'SUSHI', 'sushi': 'SUSHI',
  'jupiter': 'JUP', 'jup': 'JUP',
  'raydium': 'RAY', 'ray': 'RAY',
  'orca': 'ORCA',
  'gmx': 'GMX',
  'pendle': 'PENDLE',
  'eigenlayer': 'EIGEN', 'eigen': 'EIGEN',
  
  // Gaming/Metaverse
  'sandbox': 'SAND', 'sand': 'SAND', 'the sandbox': 'SAND',
  'decentraland': 'MANA', 'mana': 'MANA',
  'axie': 'AXS', 'axs': 'AXS', 'axie infinity': 'AXS',
  'gala': 'GALA', 'gala games': 'GALA',
  'immutable': 'IMX', 'imx': 'IMX', 'immutable x': 'IMX',
  'enjin': 'ENJ', 'enj': 'ENJ',
  'illuvium': 'ILV', 'ilv': 'ILV',
  
  // Stablecoins (for reference)
  'tether': 'USDT', 'usdt': 'USDT',
  'usdc': 'USDC', 'usd coin': 'USDC',
  'dai': 'DAI',
  
  // Other popular
  'hedera': 'HBAR', 'hbar': 'HBAR',
  'algorand': 'ALGO', 'algo': 'ALGO',
  'vechain': 'VET', 'vet': 'VET',
  'filecoin': 'FIL', 'fil': 'FIL',
  'theta': 'THETA',
  'tezos': 'XTZ', 'xtz': 'XTZ',
  'eos': 'EOS',
  'iota': 'IOTA', 'miota': 'IOTA',
  'monero': 'XMR', 'xmr': 'XMR',
  'zcash': 'ZEC', 'zec': 'ZEC',
  'stellar': 'XLM', 'xlm': 'XLM', 'lumens': 'XLM',
  'internet computer': 'ICP', 'icp': 'ICP',
  'the graph': 'GRT', 'grt': 'GRT',
  'quant': 'QNT', 'qnt': 'QNT',
  'cronos': 'CRO', 'cro': 'CRO',
  'kucoin': 'KCS', 'kcs': 'KCS',
  'okb': 'OKB',
  'leo': 'LEO', 'unus sed leo': 'LEO',
  'pyth': 'PYTH', 'pyth network': 'PYTH',
  'jito': 'JTO', 'jto': 'JTO',
  'wormhole': 'W',
  'ethena': 'ENA', 'ena': 'ENA',
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

// Extract coin symbols mentioned in user message
function extractCoinMentions(message: string): string[] {
  const symbols = new Set<string>();
  const upperMessage = message.toUpperCase();
  const lowerMessage = message.toLowerCase();
  
  // Match $SYMBOL patterns (e.g., $BTC, $MON)
  const dollarMatches = message.match(/\$([A-Za-z]{2,10})/g);
  if (dollarMatches) {
    dollarMatches.forEach(match => {
      symbols.add(match.slice(1).toUpperCase());
    });
  }
  
  // Match standalone uppercase symbols (2-6 chars to avoid false positives)
  const upperMatches = message.match(/\b([A-Z]{2,6})\b/g);
  if (upperMatches) {
    upperMatches.forEach(match => {
      // Filter out common words that might be uppercase
      const commonWords = ['THE', 'AND', 'FOR', 'ARE', 'BUT', 'NOT', 'YOU', 'ALL', 'CAN', 'HER', 'WAS', 'ONE', 'OUR', 'OUT', 'DAY', 'HAD', 'HOW', 'ITS', 'MAY', 'NEW', 'NOW', 'OLD', 'SEE', 'WAY', 'WHO', 'BOY', 'DID', 'GET', 'HAS', 'HIM', 'HIS', 'LET', 'PUT', 'SAY', 'TOO', 'USE', 'WHY'];
      if (!commonWords.includes(match)) {
        symbols.add(match);
      }
    });
  }
  
  // Match full crypto names
  for (const [name, symbol] of Object.entries(CRYPTO_NAME_MAP)) {
    if (lowerMessage.includes(name)) {
      symbols.add(symbol);
    }
  }
  
  return Array.from(symbols).slice(0, 5); // Limit to 5 coins
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

async function fetchCoinDetail(supabase: any, symbol: string): Promise<CoinDetail | null> {
  try {
    console.log(`Fetching LunarCrush detail for: ${symbol}`);
    const { data, error } = await supabase.functions.invoke('lunarcrush-coin-detail', {
      body: { coin: symbol }
    });

    if (error) {
      console.error(`Error fetching ${symbol} detail:`, error);
      return null;
    }

    if (data?.success && data?.data) {
      const d = data.data;
      return {
        symbol: d.symbol || symbol,
        name: d.name || symbol,
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
    console.error(`Failed to fetch ${symbol} detail:`, e);
    return null;
  }
}

async function fetchMultipleCoinDetails(supabase: any, symbols: string[]): Promise<CoinDetail[]> {
  const results: CoinDetail[] = [];
  
  // Fetch in parallel but with a small delay to avoid rate limits
  const promises = symbols.map(async (symbol, index) => {
    // Small stagger to avoid hitting rate limits
    await new Promise(resolve => setTimeout(resolve, index * 100));
    return fetchCoinDetail(supabase, symbol);
  });
  
  const details = await Promise.all(promises);
  
  for (const detail of details) {
    if (detail) {
      results.push(detail);
    }
  }
  
  return results;
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
  if (coins.length === 0) {
    return "";
  }

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
🔍 DETAILED RESEARCH ON COINS USER ASKED ABOUT
═══════════════════════════════════════════
${sections.join('\n')}`;
}

function buildSystemPrompt(priceContext: string, coinDetails: string): string {
  return `You are ZombieDog 🧟🐕, the undead crypto market assistant for XRayCrypto™. You're a friendly, knowledgeable zombie dog who helps users understand crypto markets.

Your personality:
- Playful and approachable, using occasional dog and zombie references ("woof", "sniffing out deals", "digging up data", "my undead instincts", "*wags undead tail*")
- Knowledgeable about crypto markets, trading, blockchain technology, DeFi, NFTs, and market analysis
- Helpful and educational, explaining concepts clearly
- Use emojis sparingly but appropriately (🧟🐕 💀 🦴 📈 📉 💰)

${priceContext}
${coinDetails}

═══════════════════════════════════════════
📜 CRITICAL INSTRUCTIONS FOR ANSWERING
═══════════════════════════════════════════

1. **USE THE DATA ABOVE!** You have REAL, LIVE market data. Don't say you don't have access to real-time data!

2. When users ask about a specific coin:
   - Quote the EXACT price, changes, and metrics from the data above
   - Discuss the Galaxy Score and what it means for social momentum
   - Mention the risk level and volatility
   - Analyze the short/medium/long term trends
   - Reference the Alt Rank if notable

3. **Format your analysis like a pro:**
   - Lead with the current price and key change metrics
   - Discuss sentiment (Galaxy Score, FOMO if available)
   - Analyze trends (are short and long term aligned or diverging?)
   - Mention risk factors if elevated
   - Provide context on market cap and volume

4. **Be specific, not generic:**
   ❌ DON'T: "I don't have real-time data for MON"
   ✅ DO: "MON is currently at $0.0102 (+1.19% today), but down -43.85% over 30 days..."

5. **Interpret the trends:**
   - If short-term bullish but long-term bearish: "Short-term relief rally within a broader downtrend"
   - If all trends aligned bullish: "Strong momentum across all timeframes"
   - If Galaxy Score low + bearish trends: "Weak social momentum compounds the bearish pressure"

6. Keep responses concise but data-rich (2-4 paragraphs max)
7. Always remind users to DYOR (do your own research)
8. Never give financial advice

Remember: You're a helpful undead pup with REAL market data - use it! 🐕💀`;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages } = await req.json();
    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    
    if (!ANTHROPIC_API_KEY) {
      console.error("ANTHROPIC_API_KEY is not configured");
      throw new Error("ANTHROPIC_API_KEY is not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log(`ZombieDog chat request with ${messages?.length || 0} messages`);

    // Get the latest user message to extract coin mentions
    const latestUserMessage = messages?.filter((m: any) => m.role === 'user').pop();
    const userQuery = latestUserMessage?.content || '';
    
    // Extract coin symbols from user message
    const mentionedCoins = extractCoinMentions(userQuery);
    console.log(`Extracted coin mentions: ${mentionedCoins.join(', ') || 'none'}`);

    // Fetch data in parallel
    const [prices, coinDetails] = await Promise.all([
      fetchLivePrices(supabase),
      mentionedCoins.length > 0 ? fetchMultipleCoinDetails(supabase, mentionedCoins) : Promise.resolve([])
    ]);
    
    console.log(`Fetched ${prices.length} general prices, ${coinDetails.length} detailed coin reports`);

    // Build system prompt with all context
    const priceContext = formatPriceContext(prices);
    const coinDetailContext = formatCoinDetails(coinDetails);
    const systemPrompt = buildSystemPrompt(priceContext, coinDetailContext);

    // Convert messages format for Anthropic API
    const anthropicMessages = messages.map((m: { role: string; content: string }) => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: m.content,
    }));

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1024,
        system: systemPrompt,
        messages: anthropicMessages,
        stream: true,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Anthropic API error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 401) {
        return new Response(JSON.stringify({ error: "API authentication failed." }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      return new Response(JSON.stringify({ error: "AI service temporarily unavailable" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("Streaming response from Anthropic API");
    
    return new Response(response.body, {
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
