import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Top cryptos to fetch general prices for
const TOP_CRYPTOS = ['BTC', 'ETH', 'SOL', 'XRP', 'ADA', 'DOGE', 'LINK', 'AVAX', 'DOT', 'MATIC', 'SHIB', 'UNI', 'LTC', 'BCH', 'ATOM'];

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

interface ResolvedCoin {
  symbol: string;
  coingeckoId: string | null;
  displayName: string;
}

// Common words to filter out from symbol/name extraction
const COMMON_WORDS = new Set([
  // Common uppercase words
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
  'MARKET', 'BUY', 'SELL', 'HOLD', 'MOON', 'PUMP', 'DUMP'
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
  'very', 'want', 'year', 'your', 'some', 'many', 'much', 'most'
]);

// Extract potential symbols from message text
function extractPotentialSymbols(message: string): string[] {
  const symbols: string[] = [];
  
  // Match $SYMBOL patterns (e.g., $BTC, $MON)
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

// Resolve coins from database using ticker_mappings and cg_master
async function resolveCoinsFromDatabase(supabase: any, message: string): Promise<ResolvedCoin[]> {
  const resolved: ResolvedCoin[] = [];
  const foundSymbols = new Set<string>();
  
  const potentialSymbols = extractPotentialSymbols(message);
  const potentialNames = extractPotentialNames(message);
  
  console.log(`Potential symbols: ${potentialSymbols.join(', ')}`);
  console.log(`Potential names: ${potentialNames.slice(0, 10).join(', ')}...`);
  
  // Step 1: Check ticker_mappings for exact symbol matches and aliases
  if (potentialSymbols.length > 0) {
    for (const sym of potentialSymbols) {
      // Check exact symbol match
      const { data: exactMatch } = await supabase
        .from('ticker_mappings')
        .select('symbol, coingecko_id, display_name, aliases')
        .eq('is_active', true)
        .eq('type', 'crypto')
        .ilike('symbol', sym)
        .maybeSingle();
      
      if (exactMatch?.coingecko_id && !foundSymbols.has(exactMatch.symbol)) {
        console.log(`Found exact match in ticker_mappings: ${sym} -> ${exactMatch.symbol} (${exactMatch.coingecko_id})`);
        resolved.push({
          symbol: exactMatch.symbol,
          coingeckoId: exactMatch.coingecko_id,
          displayName: exactMatch.display_name
        });
        foundSymbols.add(exactMatch.symbol);
        continue;
      }
      
      // Check aliases
      const { data: aliasMatch } = await supabase
        .from('ticker_mappings')
        .select('symbol, coingecko_id, display_name, aliases')
        .eq('is_active', true)
        .eq('type', 'crypto')
        .contains('aliases', [sym])
        .maybeSingle();
      
      if (aliasMatch?.coingecko_id && !foundSymbols.has(aliasMatch.symbol)) {
        console.log(`Found alias match in ticker_mappings: ${sym} -> ${aliasMatch.symbol} (${aliasMatch.coingecko_id})`);
        resolved.push({
          symbol: aliasMatch.symbol,
          coingeckoId: aliasMatch.coingecko_id,
          displayName: aliasMatch.display_name
        });
        foundSymbols.add(aliasMatch.symbol);
        continue;
      }
      
      // Fallback to cg_master for symbol match
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
          displayName: cgMatch.name
        });
        foundSymbols.add(cgMatch.symbol.toUpperCase());
      }
    }
  }
  
  // Step 2: Only search by name if no symbols were found (prevents over-matching)
  if (resolved.length === 0 && potentialNames.length > 0) {
    for (const name of potentialNames.slice(0, 3)) {
      if (name.length < 4) continue;
      
      // Try exact prefix match first (e.g., "monad" matches "Monad" or "monat" matches "mon...")
      const { data: nameMatch } = await supabase
        .from('ticker_mappings')
        .select('symbol, coingecko_id, display_name, aliases')
        .eq('is_active', true)
        .eq('type', 'crypto')
        .or(`display_name.ilike.${name}%,display_name.ilike.%${name}%`)
        .limit(1)
        .maybeSingle();
      
      if (nameMatch?.coingecko_id && !foundSymbols.has(nameMatch.symbol)) {
        console.log(`Found name match in ticker_mappings: "${name}" -> ${nameMatch.symbol} (${nameMatch.coingecko_id})`);
        resolved.push({
          symbol: nameMatch.symbol,
          coingeckoId: nameMatch.coingecko_id,
          displayName: nameMatch.display_name
        });
        foundSymbols.add(nameMatch.symbol);
        break; // Found one, stop searching
      }
      
      // Also check aliases for fuzzy matching (e.g., "monat" in aliases)
      const { data: aliasNameMatch } = await supabase
        .from('ticker_mappings')
        .select('symbol, coingecko_id, display_name, aliases')
        .eq('is_active', true)
        .eq('type', 'crypto')
        .contains('aliases', [name])
        .limit(1)
        .maybeSingle();
      
      if (aliasNameMatch?.coingecko_id && !foundSymbols.has(aliasNameMatch.symbol)) {
        console.log(`Found alias name match: "${name}" -> ${aliasNameMatch.symbol}`);
        resolved.push({
          symbol: aliasNameMatch.symbol,
          coingeckoId: aliasNameMatch.coingecko_id,
          displayName: aliasNameMatch.display_name
        });
        foundSymbols.add(aliasNameMatch.symbol);
        break;
      }
    }
  }
  
  // Step 3: Fallback to cg_master name search if still nothing
  if (resolved.length === 0 && potentialNames.length > 0) {
    for (const name of potentialNames.slice(0, 3)) {
      if (name.length < 4) continue;
      
      const { data: cgNameMatch } = await supabase
        .from('cg_master')
        .select('symbol, cg_id, name')
        .ilike('name', `${name}%`)
        .limit(1)
        .maybeSingle();
      
      if (cgNameMatch?.cg_id && !foundSymbols.has(cgNameMatch.symbol.toUpperCase())) {
        console.log(`Found name match in cg_master: "${name}" -> ${cgNameMatch.symbol} (${cgNameMatch.cg_id})`);
        resolved.push({
          symbol: cgNameMatch.symbol.toUpperCase(),
          coingeckoId: cgNameMatch.cg_id,
          displayName: cgNameMatch.name
        });
        foundSymbols.add(cgNameMatch.symbol.toUpperCase());
        break;
      }
    }
  }
  
  return resolved.slice(0, 5);
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

async function fetchCoinDetail(supabase: any, coin: ResolvedCoin): Promise<CoinDetail | null> {
  try {
    // LunarCrush expects the symbol (e.g., "BTC", "MON"), not the CoinGecko ID
    const lookupId = coin.symbol;
    console.log(`Fetching LunarCrush detail for: ${coin.symbol} (display: ${coin.displayName})`);
    
    const { data, error } = await supabase.functions.invoke('lunarcrush-coin-detail', {
      body: { coin: lookupId }
    });

    if (error) {
      console.error(`Error fetching ${coin.symbol} detail:`, error);
      return null;
    }

    if (data?.success && data?.data) {
      const d = data.data;
      return {
        symbol: d.symbol || coin.symbol,
        name: d.name || coin.displayName || coin.symbol,
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
    console.error(`Failed to fetch ${coin.symbol} detail:`, e);
    return null;
  }
}

async function fetchMultipleCoinDetails(supabase: any, coins: ResolvedCoin[]): Promise<CoinDetail[]> {
  const results: CoinDetail[] = [];
  
  // Fetch in parallel but with a small delay to avoid rate limits
  const promises = coins.map(async (coin, index) => {
    await new Promise(resolve => setTimeout(resolve, index * 100));
    return fetchCoinDetail(supabase, coin);
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
    
    // Resolve coins from database (19K+ coins available!)
    const resolvedCoins = await resolveCoinsFromDatabase(supabase, userQuery);
    console.log(`Resolved ${resolvedCoins.length} coins from database: ${resolvedCoins.map(c => c.symbol).join(', ') || 'none'}`);

    // Fetch data in parallel
    const [prices, coinDetails] = await Promise.all([
      fetchLivePrices(supabase),
      resolvedCoins.length > 0 ? fetchMultipleCoinDetails(supabase, resolvedCoins) : Promise.resolve([])
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
