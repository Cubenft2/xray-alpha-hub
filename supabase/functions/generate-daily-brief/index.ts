import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';
import { toZonedTime, format } from 'https://esm.sh/date-fns-tz@3.2.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const openaiApiKey = Deno.env.get('OPENAI_API_KEY')!;
const coingeckoApiKey = Deno.env.get('COINGECKO_API_KEY')!;
const lunarcrushApiKey = Deno.env.get('LUNARCRUSH_API_KEY')!;
const polygonApiKey = Deno.env.get('POLYGON_API_KEY')!;
const cronSecret = Deno.env.get('CRON_SECRET');

// ===================================================================
// SENTENCE-LEVEL DEDUPLICATION UTILITY
// ===================================================================

/**
 * Remove duplicate sentences from text content
 * This catches AI-generated repetition at the sentence level
 */
function deduplicateContent(text: string): string {
  // Split into sentences (handle multiple punctuation marks)
  const sentences = text.split(/(?<=[.!?])\s+/);
  
  // Track seen sentences (normalized for comparison)
  const seen = new Set<string>();
  const unique: string[] = [];
  
  for (const sentence of sentences) {
    // Normalize: lowercase, trim, remove extra whitespace
    const normalized = sentence.toLowerCase().trim().replace(/\s+/g, ' ');
    
    // Skip if we've seen this exact sentence (or it's too short to matter)
    if (!seen.has(normalized) && normalized.length > 10) {
      seen.add(normalized);
      unique.push(sentence);
    } else if (normalized.length > 10) {
      console.log(`🗑️ Removed duplicate sentence: "${sentence.substring(0, 60)}..."`);
    }
  }
  
  return unique.join(' ');
}

interface CoinGeckoData {
  id: string;
  symbol: string;
  name: string;
  current_price: number;
  market_cap: number;
  market_cap_rank: number;
  price_change_percentage_24h: number;
  price_change_percentage_7d_in_currency: number;
  total_volume: number;
  high_24h: number;
  low_24h: number;
}

interface LunarCrushAsset {
  id: string;
  symbol: string;
  name: string;
  galaxy_score: number;
  alt_rank: number;
  social_volume: number;
  social_dominance: number;
  sentiment: number;
  fomo_score: number;
}

// ===================================================================
// MODULAR SECTION GENERATION SYSTEM
// ===================================================================

interface SectionDefinition {
  title: string;
  guidelines: string;
  dataScope: string[];
  minWords: number;
}

// Define section structures for daily and weekly briefs
const DAILY_SECTIONS: SectionDefinition[] = [
  {
    title: 'Market Overview',
    guidelines: 'Lead with biggest story using ONLY exact numbers from canonicalSnapshot. Use placeholders: BTC (${{BTC_PRICE}} {{BTC_CHANGE}}%), ETH (${{ETH_PRICE}} {{ETH_CHANGE}}%), Market Cap ${{MARKET_CAP}}B, Volume ${{VOLUME_24H}}B. DO NOT invent or round numbers beyond 2 decimals. If data missing, write "data temporarily unavailable" - never substitute. FORMAT: One paragraph per major asset. Start "AssetName (SYM):" then 2-3 sentences. Blank line between assets.',
    dataScope: ['canonicalSnapshot', 'marketCap', 'volume', 'fearGreed', 'btc', 'eth', 'topMover'],
    minWords: 150
  },
  {
    title: 'Cryptocurrency Movers',
    guidelines: 'Deep dive into top 24h gainers and losers with context. DO NOT repeat price changes already mentioned in Market Overview - ADD NEW CONTEXT (on-chain, social, exchange data). FORMAT STRICTLY: One paragraph per asset. Start each with "AssetName (SYM):" then 2-3 sentences. Insert blank line between assets. Do NOT repeat any asset.',
    dataScope: ['topGainers', 'topLosers', 'coingeckoData', 'trendingCoins'],
    minWords: 150
  },
  {
    title: 'Traditional Markets',
    guidelines: 'Focus on stock movements using ONLY live Polygon data from canonicalSnapshot.stocks. Use placeholders: CompanyName (TICKER ${{TICKER_PRICE}} {{TICKER_CHANGE}}%). Cover SPY, QQQ, COIN, MSTR, and other tech stocks. DO NOT invent prices or percentages. Keep crypto OUT of this section. FORMAT: One paragraph per stock. If stock data missing, write "Traditional market data temporarily unavailable" - do not analyze without numbers.',
    dataScope: ['canonicalSnapshot', 'newsStocks', 'stockExchangeContext'],
    minWords: 80
  },
  {
    title: 'Derivatives & Flows',
    guidelines: 'Funding rates, liquidations, open interest, exchange flows. Include technical indicators (RSI, MACD, SMA) when available. Technical analysis only - no price repetition from earlier sections. FORMAT STRICTLY: One paragraph per asset. Start each with "AssetName (SYM):" then 2-3 sentences. Insert blank line between assets.',
    dataScope: ['derivsData', 'exchangeData', 'technicalData'],
    minWords: 100
  },
  {
    title: 'What\'s Next',
    guidelines: 'Forward-looking: upcoming events, key levels to watch, potential catalysts. CRITICAL PRICE REQUIREMENTS: 1) Use EXACT CURRENT PRICES from the data (BTC current price will be provided). 2) Calculate support as current * 0.95 and resistance as current * 1.05. 3) NEVER use generic/outdated levels. 4) If BTC is below $100k, DO NOT mention $120k+ levels. 5) Verify any price you mention against the provided data. For stocks, mention themes/catalysts but DO NOT mention specific price levels (we don\'t have real-time stock data). 1-2 paragraphs.',
    dataScope: ['economicCalendar', 'upcomingEvents', 'btc', 'eth', 'marketCap', 'coingeckoData'],
    minWords: 80
  }
];

const WEEKLY_SECTIONS: SectionDefinition[] = [
  {
    title: 'Weekly Hook',
    guidelines: 'Lead with the biggest story of the week backed by real numbers. Make it compelling and set the stage. FORMAT STRICTLY: One paragraph per major asset. Start each with "AssetName (SYM):" then 2-3 sentences. Insert blank line between assets.',
    dataScope: ['weeklyTopMover', 'marketCap', 'volume'],
    minWords: 150
  },
  {
    title: 'What Happened Last Week',
    guidelines: 'Comprehensive 7-day recap with macro events, policy moves, ETF flows, regulatory news. FORMAT STRICTLY: One paragraph per major theme or asset. Start each with "AssetName (SYM):" or "Theme:" then 2-3 sentences. Insert blank line between paragraphs.',
    dataScope: ['newsAll', 'macroEvents', 'fearGreedWeekly'],
    minWords: 200
  },
  {
    title: 'Weekly Performance Breakdown',
    guidelines: 'Deep dive into top weekly gainers/losers with reasons. NO price repetition from Hook - ADD NEW CONTEXT. FORMAT STRICTLY: One paragraph per asset. Start each with "AssetName (SYM):" then 2-3 sentences. Insert blank line between assets. Do NOT repeat any asset.',
    dataScope: ['weeklyGainers', 'weeklyLosers', 'coingeckoData'],
    minWords: 200
  },
  {
    title: 'Exchange Dynamics',
    guidelines: 'Weekly volume patterns, price variance across venues, new listings, liquidity changes. FORMAT STRICTLY: One paragraph per asset or exchange. Start each with "AssetName (SYM):" or "Exchange:" then 2-3 sentences. Insert blank line between paragraphs.',
    dataScope: ['exchangeData', 'volumePatterns'],
    minWords: 150
  },
  {
    title: 'Derivatives & Leverage',
    guidelines: 'Funding rates, liquidations, open interest changes over the week. Technical focus. FORMAT STRICTLY: One paragraph per asset. Start each with "AssetName (SYM):" then 2-3 sentences. Insert blank line between assets.',
    dataScope: ['derivsData', 'weeklyLiquidations'],
    minWords: 150
  },
  {
    title: 'Macro Context & Institutional Moves',
    guidelines: 'Fed policy, inflation data, ETF flows, institutional adoption news. 2 paragraphs.',
    dataScope: ['macroData', 'institutionalFlows'],
    minWords: 150
  },
  {
    title: 'Technical Landscape',
    guidelines: 'Weekly chart patterns, key support/resistance levels tested, technical setups. 2 paragraphs.',
    dataScope: ['technicalData', 'chartPatterns'],
    minWords: 150
  },
  {
    title: 'What\'s Coming Next Week',
    guidelines: 'Calendar events, earnings, policy announcements, potential catalysts. 2 paragraphs.',
    dataScope: ['economicCalendar', 'upcomingEvents'],
    minWords: 150
  },
  {
    title: 'Closing Thoughts',
    guidelines: 'Wrap up the week with perspective and wisdom. 1-2 paragraphs.',
    dataScope: ['all'],
    minWords: 100
  }
];

// Dynamic style selection based on time of day
function getWritingStyle(): string {
  try {
    const hour = new Date().getHours();
    if (hour >= 6 && hour < 12) return 'DIRECT_TRADER';
    if (hour >= 12 && hour < 18) return 'MARKET_PSYCHOLOGIST';
    return 'DATA_DETECTIVE';
  } catch (error) {
    console.error('⚠️ Error in getWritingStyle:', error);
    return 'DIRECT_TRADER'; // Fallback
  }
}

// Rotating metaphor themes to prevent repetition
function getMetaphorTheme(): string {
  try {
    const themes = ['sports', 'weather', 'architecture', 'music', 'food', 'travel'];
    const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
    return themes[dayOfYear % themes.length];
  } catch (error) {
    console.error('⚠️ Error in getMetaphorTheme:', error);
    return 'travel'; // Fallback to original theme
  }
}

// Enhanced system persona with backstory and dynamic style - Generated per request
function getXRayCryptoPersona(): string {
  const writingStyle = getWritingStyle();
  const metaphorTheme = getMetaphorTheme();
  
  console.log(`📝 Generated persona: Style=${writingStyle}, Metaphor=${metaphorTheme}`);
  
  return `🚨 CRITICAL ANTI-REPETITION RULES (HIGHEST PRIORITY):
1. NEVER repeat the same sentence twice - even in different sections
2. NEVER duplicate paragraphs or large chunks of text
3. Each asset analysis must contain completely UNIQUE sentences
4. If you've made a specific point once, DO NOT make it again
5. Constantly vary your sentence structure and word choice
6. Read what you've already written before writing more
7. Each section should have fresh information, not recycled content

You are XRayCrypto (internal name: Xavier Rodriguez), 38 years old, trading since 2013. You survived Mt. Gox, lost 80% in the 2018 crash, rebuilt your portfolio through discipline and data. Your philosophy: "I've been wrecked, made it, lost it, made it again. The market doesn't care about your feelings."

**YOUR WRITING STYLE TODAY: ${writingStyle}**

DIRECT_TRADER: Short, punchy sentences. Military precision. "BTC broke $95K. Volume confirms. Institutions are positioning." Show the data, skip the fluff.

MARKET_PSYCHOLOGIST: Medium sentences, conversational flow. "Here's what the crowd's missing about Ethereum (ETH). While everyone's watching price, smart money is accumulating. The volume pattern suggests..."

DATA_DETECTIVE: Mix short + long sentences. Detective uncovering clues. "Bitcoin (BTC) rallied 8% today. But here's the interesting part: derivatives data shows..." Build the case piece by piece.

**METAPHOR THEME TODAY: ${metaphorTheme}**
Use fresh ${metaphorTheme}-based metaphors naturally. Rotate daily to prevent staleness.

**BANNED OVERUSED PHRASES:**
❌ "making waves" ❌ "riding the wave" ❌ "wind in sails" ❌ "hot destination" ❌ "setting sail"

**FRESH ALTERNATIVES:**
✅ "positioning" ✅ "accumulating" ✅ "volume confirms" ✅ "data shows" ✅ "pattern suggests" ✅ "breaking key level"

**CRITICAL FORMATTING RULES:**
1. When mentioning any cryptocurrency or stock, ALWAYS format it as "Name (SYMBOL)" - for example: "Bitcoin (BTC)", "Ethereum (ETH)", "Apple (AAPL)"
2. For stocks, include the exchange: "Apple (AAPL) - NASDAQ"
3. Use HTML <h2> tags for section headings: <h2>Section Title</h2>
4. Write 2-3 substantial paragraphs per section (150-250 words minimum)
5. VARY SENTENCE LENGTH: Mix short (5-10 words), medium (11-20 words), and long (21-35 words) sentences

**ASSET TYPE CLASSIFICATION - NEVER MIX THESE:**
🚨 CRYPTOCURRENCIES: BTC, ETH, SOL, XRP, DOGE, ADA, AVAX, MATIC, DOT, LINK, UNI, ATOM, ALGO, HYPE, ASTER (crypto)
🚨 STOCKS: COIN (Coinbase-NASDAQ), MSTR (MicroStrategy-NASDAQ), NVDA (NVIDIA-NASDAQ), TSLA (Tesla-NASDAQ), AAPL (Apple-NASDAQ), MSFT (Microsoft-NASDAQ), GOOGL (Google-NASDAQ), AMZN (Amazon-NASDAQ), RIOT (RIOT-NASDAQ), MARA (Marathon-NASDAQ)

**ANTI-REPETITION RULES:**
1. Each asset gets ONE primary analysis with full context
2. Later mentions must add NEW information ONLY (derivatives, social, macro) in ≤15 words
3. NEVER repeat price data without new angle
4. Each section delivers UNIQUE insights - vary wording completely

**EDUCATIONAL APPROACH (CRITICAL):**
- This is ANALYSIS, not advice. Show the data, explain context, teach analytical thinking.
- NEVER say "you should buy/sell" - instead: "The data suggests...", "Volume could indicate...", "This pattern might mean..."
- Acknowledge uncertainty: Use "could", "might", "suggests", "appears", "potentially"
- Educational disclaimer tone: "This is analysis, not advice. Your money, your decision."
- SHOW, don't tell: Present evidence, explain reasoning, let readers decide`;
}

// Track facts mentioned across sections to prevent repetition
interface FactTracker {
  assetPrimaryAnalyses: Set<string>;
  numericFacts: Map<string, Set<string>>;
  themes: Set<string>;
}

/**
 * Calculate similarity between two strings (0-1 range)
 */
function calculateSimilarity(str1: string, str2: string): number {
  const words1 = new Set(str1.toLowerCase().split(/\s+/));
  const words2 = new Set(str2.toLowerCase().split(/\s+/));
  const intersection = new Set([...words1].filter(x => words2.has(x)));
  const union = new Set([...words1, ...words2]);
  return intersection.size / union.size;
}

/**
 * Deduplicate and format asset-focused sections (per-asset paragraphs)
 */
function cleanAssetSection(text: string, sectionTitle: string): string {
  console.log(`🧹 Cleaning ${sectionTitle} section...`);
  
  // STEP 1: Detect and remove paragraph-level duplicates FIRST
  // Split by asset blocks (e.g., "Bitcoin (BTC): ..." to next asset)
  const assetBlockRegex = /([A-Za-z0-9\s]+\s*\([A-Z0-9]+\):.*?)(?=(?:[A-Za-z0-9\s]+\s*\([A-Z0-9]+\):)|$)/gs;
  const assetBlocks = text.match(assetBlockRegex) || [];
  
  const seenBlocks = new Set<string>();
  const uniqueBlocks: string[] = [];
  let paragraphDuplicates = 0;
  
  assetBlocks.forEach(block => {
    const normalized = block.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
    
    // Check if we've seen this block before (>90% similar)
    let isDuplicate = false;
    for (const seenBlock of seenBlocks) {
      if (calculateSimilarity(normalized, seenBlock) > 0.90) {
        console.log(`  🗑️ Removed duplicate paragraph (${Math.round(calculateSimilarity(normalized, seenBlock) * 100)}% similar): "${block.substring(0, 60)}..."`);
        paragraphDuplicates++;
        isDuplicate = true;
        break;
      }
    }
    
    if (!isDuplicate) {
      uniqueBlocks.push(block);
      seenBlocks.add(normalized);
    }
  });
  
  // Rejoin unique blocks
  const dedupedText = uniqueBlocks.join(' ');
  
  // STEP 2: Now do sentence-level deduplication on the cleaned text
  const sentences = dedupedText.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 0);
  const seen = new Set<string>();
  const normalized = new Map<string, string>();
  let sentenceDuplicates = 0;
  
  // Detect exact duplicates (case-insensitive, normalized)
  const uniqueSentences = sentences.filter(sentence => {
    const norm = sentence.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ');
    if (seen.has(norm)) {
      console.log(`  ❌ Removed exact duplicate sentence: "${sentence.substring(0, 50)}..."`);
      sentenceDuplicates++;
      return false;
    }
    seen.add(norm);
    normalized.set(sentence, norm);
    return true;
  });
  
  // Detect near-duplicates using similarity threshold (85%)
  const deduplicatedSentences: string[] = [];
  for (const sentence of uniqueSentences) {
    let isDuplicate = false;
    for (const existing of deduplicatedSentences) {
      if (calculateSimilarity(sentence, existing) > 0.85) {
        console.log(`  ⚠️ Removed near-duplicate sentence (${Math.round(calculateSimilarity(sentence, existing) * 100)}% similar): "${sentence.substring(0, 50)}..."`);
        sentenceDuplicates++;
        isDuplicate = true;
        break;
      }
    }
    if (!isDuplicate) {
      deduplicatedSentences.push(sentence);
    }
  }
  
  // Group by asset or theme (detect "AssetName (SYM):" or "Theme:" pattern)
  const assetParagraphs = new Map<string, string[]>();
  let currentAsset: string | null = null;
  
  deduplicatedSentences.forEach(sentence => {
    // Match "AssetName (SYM):" or "Exchange:" or "Theme:"
    const assetMatch = sentence.match(/^([A-Za-z0-9\s]+)\s*\(([A-Z0-9]+)\):/);
    const themeMatch = sentence.match(/^(Exchange|Theme):/i);
    
    if (assetMatch) {
      currentAsset = assetMatch[2]; // Use symbol as key
      if (!assetParagraphs.has(currentAsset)) {
        assetParagraphs.set(currentAsset, []);
      }
      assetParagraphs.get(currentAsset)!.push(sentence);
    } else if (themeMatch) {
      currentAsset = themeMatch[1]; // Use "Exchange" or "Theme" as key
      if (!assetParagraphs.has(currentAsset)) {
        assetParagraphs.set(currentAsset, []);
      }
      assetParagraphs.get(currentAsset)!.push(sentence);
    } else if (currentAsset && sentence.length > 10) {
      // Add to current asset's paragraph
      assetParagraphs.get(currentAsset)!.push(sentence);
    }
  });
  
  // Merge duplicate asset entries
  const mergedParagraphs = new Map<string, string[]>();
  assetParagraphs.forEach((sentences, key) => {
    if (!mergedParagraphs.has(key)) {
      mergedParagraphs.set(key, sentences);
    } else {
      // Asset mentioned multiple times - merge sentences
      const existing = mergedParagraphs.get(key)!;
      sentences.forEach(s => {
        // Only add if not similar to existing sentences
        const isUnique = !existing.some(e => calculateSimilarity(s, e) > 0.85);
        if (isUnique) {
          existing.push(s);
        }
      });
    }
  });
  
  // Build final output: one paragraph per asset/theme, max 3 sentences, blank line between
  const paragraphs: string[] = [];
  mergedParagraphs.forEach((sentences, key) => {
    const para = sentences.slice(0, 3).join('. ') + '.';
    paragraphs.push(para);
    console.log(`  ✅ ${key}: ${sentences.length} sentence(s) → kept first ${Math.min(3, sentences.length)}`);
  });
  
  console.log(`  📊 ${sectionTitle} cleaned: ${paragraphDuplicates} paragraph duplicates + ${sentenceDuplicates} sentence duplicates removed, ${mergedParagraphs.size} unique items`);
  
  // Return as separate paragraphs (NO <p> tags here - will be added later)
  return paragraphs.join('\n\n');
}

/**
 * Build Traditional Markets section deterministically from stock snapshot
 */
function buildTraditionalMarketsSection(stockData: Record<string, { price: number; change: number; volume: number }>): string {
  if (!stockData || Object.keys(stockData).length === 0) {
    return '<p>Traditional market data temporarily unavailable.</p>';
  }
  
  const stockDescriptions: Record<string, string> = {
    SPY: "S&P 500 ETF",
    QQQ: "Nasdaq-100 ETF",
    COIN: "Coinbase Global Inc",
    MSTR: "MicroStrategy Inc",
    NVDA: "NVIDIA Corp",
    TSLA: "Tesla Inc",
    AAPL: "Apple Inc",
    GOOGL: "Alphabet Inc"
  };
  
  const paragraphs: string[] = [];
  
  Object.entries(stockData).forEach(([ticker, data]) => {
    const sign = data.change >= 0 ? '+' : '';
    const description = stockDescriptions[ticker] || "Market Indicator";
    paragraphs.push(
      `<p><strong>${description} (${ticker} $${data.price.toFixed(2)} ${sign}${data.change.toFixed(2)}%)</strong></p>`
    );
  });
  
  console.log(`🧱 TM-FALLBACK engaged: built ${paragraphs.length} stock entries`);
  return paragraphs.join('\n');
}

/**
 * Validate if Traditional Markets section is empty or placeholder
 */
function isTraditionalMarketsEmpty(content: string): boolean {
  if (!content || content.trim().length === 0) return true;
  
  // Check for placeholder patterns
  const placeholderPatterns = [
    /\[Content needed for this section\.\]/i,
    /\[To be added\]/i,
    /temporarily unavailable/i,
    /no data available/i
  ];
  
  if (placeholderPatterns.some(pattern => pattern.test(content))) {
    return true;
  }
  
  // Check if section has any meaningful stock ticker mentions
  const stockTickers = ['SPY', 'QQQ', 'COIN', 'MSTR', 'NVDA', 'TSLA', 'AAPL', 'GOOGL'];
  const hasStockMention = stockTickers.some(ticker => content.includes(ticker));
  
  // If no stock tickers and very short content, consider it empty
  if (!hasStockMention && content.replace(/<[^>]*>/g, '').trim().length < 50) {
    return true;
  }
  
  return false;
}

/**
 * Generate a single section using section-specific prompts
 */
async function generateSection(
  sectionDef: SectionDefinition,
  allData: any,
  previousContent: string,
  factTracker: FactTracker,
  isWeekly: boolean
): Promise<string> {
  console.log(`\n📝 Generating section: ${sectionDef.title}`);
  
  // For Social Sentiment, select specific assets to cover
  let topAssets: string[] = [];
  if (sectionDef.title === 'Social Sentiment' && allData.lunarcrushData?.data?.length > 0) {
    topAssets = allData.lunarcrushData.data.slice(0, 4).map((a: any) => `${a.name} (${a.symbol})`);
    console.log(`  🎯 Selected assets to cover: ${topAssets.join(', ')}`);
  }
  
  // Filter data relevant to this section
  const relevantData = filterDataForSection(sectionDef.dataScope, allData);
  
  // Build context from previous sections
  const previousAssets = Array.from(factTracker.assetPrimaryAnalyses).join(', ');
  const contextNote = previousAssets 
    ? `\nAssets already analyzed in previous sections: ${previousAssets}. If mentioning these again, add NEW context only (derivatives/social/macro) in ≤15 words.`
    : '';
  
  // Special case for Social Sentiment section - extra strict anti-repetition
  const socialSentimentNote = sectionDef.title === 'Social Sentiment' && previousAssets
    ? `\n\n⚠️ CRITICAL: ${previousAssets} were already analyzed. DO NOT repeat their price movements or gains/losses. ONLY discuss social metrics: trending scores, social volume changes, community sentiment, and why they're buzzing on social media.`
    : '';
  
  // For Social Sentiment, explicitly list assets to cover
  const assetListNote = sectionDef.title === 'Social Sentiment' && topAssets.length > 0
    ? `\n\n📋 COVER ONLY THESE ASSETS: ${topAssets.join(', ')}. One paragraph per asset. Do not include others.`
    : '';
  
  // Construct section prompt
  const sectionPrompt = `${getXRayCryptoPersona()}

**SECTION TO WRITE:** <h2>${sectionDef.title}</h2>

**SECTION GUIDELINES:** ${sectionDef.guidelines}${socialSentimentNote}${assetListNote}

**CONTEXT:** This is section ${sectionDef.title} of a ${isWeekly ? 'weekly' : 'daily'} market brief.${contextNote}

**ASSETS ALREADY ANALYZED:** ${Array.from(factTracker.assetPrimaryAnalyses).join(', ') || 'None yet'}
⚠️ For these assets, you MUST add NEW angles ONLY (derivatives, social sentiment, technical patterns, on-chain data, exchange flows)

**RELEVANT DATA FOR THIS SECTION:**
${relevantData}

---NEW SECTION START - DO NOT REPEAT PREVIOUS CONTENT---

**INSTRUCTIONS:**
- Write ONLY the content for this section (do NOT include the heading, it will be added automatically)
- ${sectionDef.minWords}+ words minimum
- Focus on unique insights for THIS section

🚨 CRITICAL ANTI-REPETITION REQUIREMENTS:
- NEVER repeat the same price/percentage change mentioned in earlier sections
- If an asset was analyzed before, you MUST provide DIFFERENT context (e.g., on-chain metrics, social sentiment, technical indicators, derivatives)
- Each asset mention must contain NEW information - do NOT restate facts already covered
- Vary your language completely - avoid reusing phrases or sentence structures from prior sections
- When in doubt, skip repeating an asset rather than risk redundancy
- DO NOT repeat any sentence you've already written - every sentence must be unique

✅ CORRECT: "Bitcoin (BTC): On-chain data shows accumulation by whales..."
❌ WRONG: "Bitcoin (BTC) rose 3.2% to $121,000" (if already mentioned in Market Overview)
❌ WRONG: Repeating the same sentence twice in the same section

Write the section content now:`;

  try {
    // Call OpenAI for this section
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: getXRayCryptoPersona() },
          { role: 'user', content: sectionPrompt }
        ],
        temperature: 0.85,
        max_tokens: 3000
      }),
    });

    if (!response.ok) {
      console.error(`❌ OpenAI API error for section ${sectionDef.title}:`, response.status);
      return `<p>Content temporarily unavailable for ${sectionDef.title}.</p>`;
    }

    const data = await response.json();
    const rawContent = data.choices[0].message.content.trim();
    
    // Step 1: Remove duplicate sentences
    let content = deduplicateContent(rawContent);
    
    // Step 2: Remove duplicate paragraphs
    const paragraphs = content.split('\n\n');
    const uniqueParagraphs: string[] = [];
    const seenParagraphs = new Set<string>();
    
    for (const para of paragraphs) {
      const normalized = para.toLowerCase().trim();
      if (!seenParagraphs.has(normalized) && para.trim().length > 20) {
        seenParagraphs.add(normalized);
        uniqueParagraphs.push(para);
      } else if (para.trim().length > 20) {
        console.log(`🗑️ Removed duplicate paragraph in ${sectionDef.title}`);
      }
    }
    
    content = uniqueParagraphs.join('\n\n');
    
    // Step 3: Log deduplication stats
    const originalLength = rawContent.length;
    const finalLength = content.length;
    if (originalLength !== finalLength) {
      console.warn(`⚠️ ${sectionDef.title}: Removed ${originalLength - finalLength} chars of duplicated content`);
    }
    
    // Apply post-processing for asset-focused sections
    const assetSections = [
      'Market Overview',
      'Cryptocurrency Movers', 
      'Traditional Markets',
      'Derivatives & Flows',
      'Social Sentiment',
      'Weekly Performance Breakdown',
      'Social Momentum & Sentiment Shifts',
      'Derivatives & Leverage',
      'Exchange Dynamics',
      'Weekly Hook'
    ];
    
    if (assetSections.includes(sectionDef.title)) {
      content = cleanAssetSection(content, sectionDef.title);
      console.log(`🧹 Cleaned ${sectionDef.title}: ${content.length} chars`);
    }
    
    // Update fact tracker
    updateFactTracker(content, factTracker);
    
    // Assemble with heading
    const fullSection = `<h2>${sectionDef.title}</h2>\n\n${content}`;
    
    console.log(`✅ Generated ${sectionDef.title}: ${content.split(/\s+/).length} words`);
    
    return fullSection;
    
  } catch (error) {
    console.error(`❌ Error generating section ${sectionDef.title}:`, error);
    return `<h2>${sectionDef.title}</h2>\n<p>Section temporarily unavailable.</p>`;
  }
}

/**
 * Filter dataset to only include relevant data for a section
 */
function filterDataForSection(dataScope: string[], allData: any): string {
  const parts: string[] = [];
  
  dataScope.forEach(scope => {
    switch(scope) {
      case 'marketCap':
        parts.push(`Total Market Cap: $${(allData.totalMarketCap / 1e12).toFixed(2)}T`);
        break;
      case 'volume':
        parts.push(`24h Volume: $${(allData.totalVolume / 1e9).toFixed(2)}B`);
        break;
      case 'fearGreed':
        parts.push(`Fear & Greed: ${allData.currentFearGreed.value}/100 (${allData.currentFearGreed.value_classification})`);
        break;
      case 'btc':
        if (allData.btcData) {
          parts.push(`Bitcoin (BTC): $${allData.btcData.current_price.toLocaleString()} (${allData.btcData.price_change_percentage_24h > 0 ? '+' : ''}${allData.btcData.price_change_percentage_24h.toFixed(2)}%)`);
        }
        break;
      case 'eth':
        if (allData.ethData) {
          parts.push(`Ethereum (ETH): $${allData.ethData.current_price.toLocaleString()} (${allData.ethData.price_change_percentage_24h > 0 ? '+' : ''}${allData.ethData.price_change_percentage_24h.toFixed(2)}%)`);
        }
        break;
      case 'topMover':
        if (allData.biggestMover) {
          const changeField = allData.isWeekly ? 'price_change_percentage_7d_in_currency' : 'price_change_percentage_24h';
          parts.push(`Biggest Mover: ${allData.biggestMover.name} (${allData.biggestMover.symbol.toUpperCase()}) ${allData.biggestMover[changeField] > 0 ? '+' : ''}${allData.biggestMover[changeField].toFixed(2)}%`);
        }
        break;
      case 'topGainers':
        if (allData.topGainers?.length > 0) {
          const gainers = allData.topGainers.slice(0, 5).map((c: any) => 
            `${c.name} (${c.symbol.toUpperCase()}): +${c.price_change_percentage_24h.toFixed(2)}%`
          ).join(', ');
          parts.push(`Top Gainers (24h): ${gainers}`);
        }
        break;
      case 'topLosers':
        if (allData.topLosers?.length > 0) {
          const losers = allData.topLosers.slice(0, 5).map((c: any) => 
            `${c.name} (${c.symbol.toUpperCase()}): ${c.price_change_percentage_24h.toFixed(2)}%`
          ).join(', ');
          parts.push(`Top Losers (24h): ${losers}`);
        }
        break;
      case 'weeklyGainers':
        if (allData.weeklyGainers?.length > 0) {
          const gainers = allData.weeklyGainers.slice(0, 8).map((c: any) => 
            `${c.name} (${c.symbol.toUpperCase()}): +${c.price_change_percentage_7d_in_currency.toFixed(2)}%`
          ).join(', ');
          parts.push(`Top Weekly Gainers: ${gainers}`);
        }
        break;
      case 'weeklyLosers':
        if (allData.weeklyLosers?.length > 0) {
          const losers = allData.weeklyLosers.slice(0, 8).map((c: any) => 
            `${c.name} (${c.symbol.toUpperCase()}): ${c.price_change_percentage_7d_in_currency.toFixed(2)}%`
          ).join(', ');
          parts.push(`Top Weekly Losers: ${losers}`);
        }
        break;
      case 'trendingCoins':
        if (allData.trendingData?.coins?.length > 0) {
          const trending = allData.trendingData.coins.slice(0, 5).map((c: any) => 
            `${c.item?.name} (${c.item?.symbol?.toUpperCase()})`
          ).join(', ');
          parts.push(`Trending: ${trending}`);
        }
        break;
      case 'derivsData':
        if (allData.derivsData && Object.keys(allData.derivsData).length > 0) {
          const derivsSummary = Object.entries(allData.derivsData).slice(0, 5).map(([symbol, data]: any) => 
            `${symbol}: ${data.funding_rate ? `Funding ${(data.funding_rate * 100).toFixed(4)}%` : ''} ${data.open_interest ? `OI $${(data.open_interest / 1e6).toFixed(0)}M` : ''}`
          ).join(', ');
          parts.push(`Derivatives: ${derivsSummary}`);
        }
        break;
      case 'exchangeData':
        if (allData.exchangeData && Object.keys(allData.exchangeData).length > 0) {
          const exchangeSummary = Object.entries(allData.exchangeData).slice(0, 5).map(([symbol, data]: any) => 
            `${symbol}: ${data.exchanges?.length || 0} exchanges, avg price $${data.weighted_avg_price || 0}`
          ).join(', ');
          parts.push(`Exchange Data: ${exchangeSummary}`);
        }
        break;
      case 'technicalData':
        if (allData.technicalData && Object.keys(allData.technicalData).length > 0) {
          const techLines: string[] = [];
          Object.entries(allData.technicalData).forEach(([ticker, indicators]: any) => {
            const parts: string[] = [`${ticker}:`];
            
            // RSI - safe check
            if (indicators.rsi?.value?.value !== undefined) {
              const rsi = indicators.rsi.value.value;
              const signal = rsi > 70 ? ' (overbought)' : rsi < 30 ? ' (oversold)' : '';
              parts.push(`RSI ${rsi.toFixed(0)}${signal}`);
            }
            
            // MACD - safe check
            if (indicators.macd?.histogram !== undefined) {
              const macd = indicators.macd;
              const trend = macd.histogram > 0 ? 'bullish' : 'bearish';
              parts.push(`MACD ${trend}`);
            }
            
            // Moving Averages - safe checks
            if (indicators.sma_50?.value?.value !== undefined) {
              parts.push(`50-SMA $${indicators.sma_50.value.value.toFixed(0)}`);
            }
            if (indicators.ema_20?.value?.value !== undefined) {
              parts.push(`20-EMA $${indicators.ema_20.value.value.toFixed(0)}`);
            }
            
            // Bollinger Bands - safe check
            if (indicators.bb?.value?.upper !== undefined && indicators.bb?.value?.lower !== undefined) {
              const bb = indicators.bb.value;
              parts.push(`BB [$${bb.lower.toFixed(0)}-$${bb.upper.toFixed(0)}]`);
            }
            
            // ATR - safe check
            if (indicators.atr?.value?.value !== undefined) {
              parts.push(`ATR $${indicators.atr.value.value.toFixed(2)}`);
            }
            
            // Stochastic - safe check
            if (indicators.stoch?.value?.k !== undefined) {
              const stoch = indicators.stoch.value;
              const signal = stoch.k > 80 ? ' (overbought)' : stoch.k < 20 ? ' (oversold)' : '';
              parts.push(`Stoch ${stoch.k.toFixed(0)}${signal}`);
            }
            
            // Only add ticker if it has at least one indicator
            if (parts.length > 1) {
              techLines.push(parts.join(' | '));
            } else {
              console.log(`⚠️ No valid indicators for ${ticker}`);
            }
          });
          
          if (techLines.length > 0) {
            parts.push(`Technical Indicators:\n${techLines.join('\n')}`);
          }
        }
        break;
      case 'lunarcrushData':
        if (allData.lunarcrushData?.data?.length > 0) {
          const social = allData.lunarcrushData.data.slice(0, 5).map((a: any) => 
            `${a.name} (${a.symbol}): Galaxy ${a.galaxy_score}, Social Vol ${(a.social_volume / 1e6).toFixed(1)}M`
          ).join(', ');
          parts.push(`Social Data: ${social}`);
        }
        break;
      case 'newsStocks':
        if (allData.newsData?.stocks?.length > 0) {
          const stockNews = allData.newsData.stocks.slice(0, 10).map((n: any) => 
            `"${n.title}" - ${n.tickers?.join(', ')}`
          ).join(' | ');
          parts.push(`Stock News: ${stockNews}`);
        }
        break;
      case 'canonicalSnapshot':
        if (allData.canonicalSnapshot) {
          const snap = allData.canonicalSnapshot;
          
          // Crypto prices with placeholders
          if (snap.crypto && Object.keys(snap.crypto).length > 0) {
            const cryptoData = Object.entries(snap.crypto).map(([symbol, data]: [string, any]) => 
              `${symbol}: \${{${symbol}_PRICE}}=${data.price.toFixed(2)}, \${{${symbol}_CHANGE}}=${data.change24h >= 0 ? '+' : ''}${data.change24h.toFixed(2)}`
            ).join(', ');
            parts.push(`CRYPTO SNAPSHOT: ${cryptoData}`);
          }
          
          // Global metrics with placeholders
          if (snap.global) {
            const globalParts = [];
            if (snap.global.market_cap) globalParts.push(`\${{MARKET_CAP}}=${(snap.global.market_cap / 1e9).toFixed(2)}B`);
            if (snap.global.volume_24h) globalParts.push(`\${{VOLUME_24H}}=${(snap.global.volume_24h / 1e9).toFixed(2)}B`);
            if (snap.global.btc_dominance) globalParts.push(`BTC.D=${snap.global.btc_dominance.toFixed(2)}%`);
            if (globalParts.length > 0) parts.push(`GLOBAL: ${globalParts.join(', ')}`);
          }
          
          // Stock data with placeholders
          if (snap.stocks && Object.keys(snap.stocks).length > 0) {
            const stockData = Object.entries(snap.stocks).map(([ticker, data]: [string, any]) => 
              `${ticker}: \${{${ticker}_PRICE}}=${data.price.toFixed(2)}, \${{${ticker}_CHANGE}}=${data.change >= 0 ? '+' : ''}${data.change.toFixed(2)}`
            ).join(', ');
            parts.push(`STOCK SNAPSHOT: ${stockData}`);
          } else {
            parts.push(`STOCK SNAPSHOT: No Polygon stock data available for this run - write "Traditional market data temporarily unavailable"`);
          }
          
          parts.push(`DATA AS OF: ${snap.timestamp}`);
          if (snap.warnings && snap.warnings.length > 0) {
            parts.push(`WARNINGS: ${snap.warnings.join('; ')}`);
          }
        }
        break;
      case 'stockExchangeContext':
        if (allData.newsData?.stockExchangeContext?.length > 0) {
          const exchanges = allData.newsData.stockExchangeContext.map((s: any) => 
            `${s.ticker} (${s.exchange})`
          ).join(', ');
          parts.push(`Stock Exchanges: ${exchanges}`);
        }
        break;
      case 'stockMarketData':
        // Legacy support for older code paths
        if (allData.stockMarketData && Object.keys(allData.stockMarketData).length > 0) {
          const stockData = Object.entries(allData.stockMarketData).map(([ticker, data]: [string, any]) => 
            `${ticker}: $${data.price.toFixed(2)} (${data.change >= 0 ? '+' : ''}${data.change}%)`
          ).join(', ');
          parts.push(`Legacy Stock Data: ${stockData}`);
        }
        break;
      case 'economicCalendar':
        if (allData.economicCalendar) {
          parts.push(`Upcoming Events: ${allData.economicCalendar}`);
        }
        break;
      case 'newsAll':
        const cryptoNews = allData.newsData?.crypto?.length || 0;
        const stockNews = allData.newsData?.stocks?.length || 0;
        parts.push(`News Coverage: ${cryptoNews} crypto articles, ${stockNews} stock articles`);
        break;
      case 'all':
        // Include everything for final section
        parts.push('All market data available for context');
        break;
    }
  });
  
  return parts.join('\n');
}

/**
 * Update fact tracker to prevent repetition
 */
function updateFactTracker(content: string, tracker: FactTracker): void {
  // Extract asset mentions (SYMBOL) format
  const assetMatches = content.match(/\(([A-Z0-9_]{2,10})\)/g);
  if (assetMatches) {
    assetMatches.forEach(match => {
      const symbol = match.replace(/[()]/g, '');
      tracker.assetPrimaryAnalyses.add(symbol);
    });
  }
  
  // Extract numeric facts
  const numericMatches = content.match(/[+-]?\$?[\d,]+\.?\d*%?/g);
  if (numericMatches) {
    numericMatches.forEach(num => {
      // Associate with nearby symbols
      assetMatches?.forEach(asset => {
        const symbol = asset.replace(/[()]/g, '');
        if (!tracker.numericFacts.has(symbol)) {
          tracker.numericFacts.set(symbol, new Set());
        }
        tracker.numericFacts.get(symbol)!.add(num.replace(/,/g, ''));
      });
    });
  }
}

/**
 * Normalize paragraph format to ensure "Name (SYMBOL):" or "Name (SYMBOL $price ±%):" format
 * Strips any existing HTML tags first
 */
function normalizeParagraphFormat(paragraph: string): string {
  // Strip any existing <p> or other HTML tags first
  let cleanPara = paragraph.replace(/<\/?[^>]+>/g, '').trim();
  
  // Check if paragraph already starts with proper format
  const hasProperFormat = /^[^<]*?\([A-Z0-9_]{2,10}(\s+\$[\d,.]+\s+[+-][\d.]+%)?\):/.test(cleanPara);
  
  if (hasProperFormat) {
    return cleanPara; // Already properly formatted
  }
  
  // Try to extract and fix format if malformed
  const symbolMatch = cleanPara.match(/\b([A-Z][a-z]*(?:\s+[A-Z][a-z]*)*)\s*\(?([A-Z0-9_]{2,10})\)?/);
  if (symbolMatch) {
    const [fullMatch, name, symbol] = symbolMatch;
    const rest = cleanPara.replace(fullMatch, '').trim();
    // Remove leading colon if exists
    const cleanRest = rest.replace(/^:\s*/, '');
    return `${name} (${symbol}): ${cleanRest}`;
  }
  
  return cleanPara; // Return as-is if can't normalize
}

/**
 * Validate and repair HTML structure
 */
function validateAndRepairStructure(content: string, expectedSections: SectionDefinition[]): { content: string; issues: string[] } {
  console.log('\n🔍 Validating HTML structure...');
  const issues: string[] = [];
  
  // Check for required <h2> headers
  const headerMatches = content.match(/<h2>([^<]+)<\/h2>/g);
  const foundHeaders = headerMatches?.map(h => h.replace(/<\/?h2>/g, '')) || [];
  const expectedHeaders = expectedSections.map(s => s.title);
  
  const missingHeaders = expectedHeaders.filter(h => !foundHeaders.includes(h));
  if (missingHeaders.length > 0) {
    issues.push(`Missing headers: ${missingHeaders.join(', ')}`);
  }
  
  // Split by headers and validate each section
  const sections = content.split(/(<h2>.*?<\/h2>)/g);
  let repairedContent = '';
  
  for (let i = 0; i < sections.length; i++) {
    const section = sections[i];
    
    if (section.startsWith('<h2>')) {
      repairedContent += section + '\n\n';
      continue;
    }
    
    if (section.trim().length === 0) continue;
    
    // Check if paragraphs are properly wrapped
    const paragraphs = section.split('\n\n').filter(p => p.trim().length > 0);
    
    for (const para of paragraphs) {
      const trimmedPara = para.trim();
      
      // Normalize format
      let normalizedPara = normalizeParagraphFormat(trimmedPara);
      
      // Check if multiple assets are in one paragraph (by counting symbol patterns)
      const symbolCount = (normalizedPara.match(/\([A-Z0-9_]{2,10}\):/g) || []).length;
      
      if (symbolCount > 1) {
        issues.push(`Multiple assets in single paragraph detected`);
        // Try to split by asset pattern
        const assetParts = normalizedPara.split(/(?=\b[A-Z][a-z]*(?:\s+[A-Z][a-z]*)*\s*\([A-Z0-9_]{2,10}\):)/);
        
        for (const part of assetParts) {
          if (part.trim().length > 0) {
            const normalized = normalizeParagraphFormat(part.trim());
            repairedContent += normalized.startsWith('<p>') ? normalized : `<p>${normalized}</p>`;
            repairedContent += '\n\n';
          }
        }
      } else {
        // Single asset paragraph
        repairedContent += normalizedPara.startsWith('<p>') ? normalizedPara : `<p>${normalizedPara}</p>`;
        repairedContent += '\n\n';
      }
    }
  }
  
  console.log(`✅ Structure validation complete: ${issues.length} issues found`);
  return { content: repairedContent.trim(), issues };
}

/**
 * Global deduplication across entire brief
 */
function deduplicateEntireBrief(content: string): string {
  console.log('\n🔍 Running global deduplication across entire brief...');
  
  // Split by <h2> headers to get sections
  const sections = content.split(/(<h2>.*?<\/h2>)/g);
  
  const seenSentences = new Set<string>();
  let sentencesRemoved = 0;
  
  const processedSections = sections.map(section => {
    if (section.startsWith('<h2>')) {
      return section; // Keep headers unchanged
    }
    
    // Split into paragraphs (double newline = paragraph break)
    const paragraphs = section.split('\n\n').filter(p => p.trim().length > 20);
    
    const uniqueParagraphs = paragraphs.map(paragraph => {
      // Remove <p> tags temporarily for processing
      const cleanPara = paragraph.replace(/<\/?p>/g, '');
      
      // Process each sentence within the paragraph
      const sentences = cleanPara.split(/(?<=[.!?])\s+/);
      const uniqueSentences: string[] = [];
      
      for (const sentence of sentences) {
        const normalized = sentence.toLowerCase().trim().replace(/\s+/g, ' ');
        
        if (!seenSentences.has(normalized) && normalized.length > 10) {
          seenSentences.add(normalized);
          uniqueSentences.push(sentence);
        } else if (normalized.length > 10) {
          console.log(`  🗑️ Removed duplicate: "${sentence.substring(0, 60)}..."`);
          sentencesRemoved++;
        }
      }
      
      // Rejoin sentences within this paragraph and re-wrap in <p>
      const rejoined = uniqueSentences.join(' ').trim();
      return rejoined.length > 0 ? `<p>${rejoined}</p>` : '';
    }).filter(p => p.length > 0);
    
    // Rejoin paragraphs with double newline (preserves structure)
    return uniqueParagraphs.join('\n\n');
  });
  
  const result = processedSections.join('\n\n');
  console.log(`✅ Deduplication complete: ${sentencesRemoved} duplicate sentences removed`);
  
  return result;
}

/**
 * Editorial review bot - polishes assembled brief
 */
async function editBriefContent(
  draftContent: string,
  expectedSections: SectionDefinition[],
  briefType: string
): Promise<string> {
  console.log('\n📝 Running editorial review bot...');
  
  const sectionTitles = expectedSections.map(s => s.title).join(', ');
  
  const editorPrompt = `You are an editor for XRayCrypto market briefs. Review and refine this ${briefType} brief to ensure:

1. **Structure:** All expected sections present with <h2> headings: ${sectionTitles}
2. **No Repetition:** Remove or rephrase any duplicate sentences between sections - this is CRITICAL
3. **Voice Consistency:** Maintain XRayCrypto's sharp, plain-spoken voice with humor
4. **Flow:** Smooth transitions between sections
5. **Clarity:** Fix any awkward phrasing while preserving meaning

**CRITICAL RULES:**
- If you find ANY duplicate sentences, DELETE the second occurrence completely
- If content is repetitive but not identical, REPHRASE to add new angle rather than delete
- Preserve all <h2> section headings
- Maintain asset type classification (crypto vs stock)
- DO NOT change the core analysis or data points
- DO NOT append any quotes at the end (handled separately)
- SCAN FOR DUPLICATES: Before finalizing, verify no sentence appears twice

**DRAFT TO EDIT:**
${draftContent}

**EDITED VERSION (return the complete improved brief):**`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: 'You are a skilled editor who improves content while preserving voice and meaning.' },
          { role: 'user', content: editorPrompt }
        ],
        temperature: 0.3,
        max_tokens: 3000
      }),
    });

    if (!response.ok) {
      console.warn(`⚠️ Editor bot API error: ${response.status} - using original content`);
      return draftContent;
    }

    const data = await response.json();
    const editedContent = data.choices[0].message.content.trim();
    
    console.log(`✅ Editorial review complete: ${editedContent.split(/\s+/).length} words`);
    
    return editedContent;
    
  } catch (error) {
    console.error('❌ Editor bot failed:', error);
    return draftContent; // Fallback to original
  }
}

// ===================================================================
// SIMPLIFIED VALIDATION (keep only essential checks)
// ===================================================================

interface ValidationResult {
  passed: boolean;
  issues: string[];
  metrics: {
    assetMisclassifications: number;
    sectionsWithIssues: number;
    totalSections: number;
    wordCount: number;
  };
}

async function validateBriefContent(
  content: string,
  briefType: string,
  supabase: any
): Promise<ValidationResult> {
  const issues: string[] = [];
  const metrics = {
    assetMisclassifications: 0,
    sectionsWithIssues: 0,
    totalSections: 0,
    wordCount: content.split(/\s+/).length
  };
  
  console.log('🔍 Running streamlined validation...');
  
  // Extract sections
  const sections = content.split(/(<h2>.*?<\/h2>)/g).filter(s => s.trim());
  metrics.totalSections = sections.filter(s => s.startsWith('<h2>')).length;
  
  // Detect duplicate sentences across sections
  const allSentences: string[] = [];
  const duplicateMap = new Map<string, number>();
  
  sections.forEach(section => {
    if (section.startsWith('<h2>')) return;
    const sentences = section.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 20);
    sentences.forEach(sentence => {
      const normalized = sentence.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ');
      allSentences.push(sentence);
      duplicateMap.set(normalized, (duplicateMap.get(normalized) || 0) + 1);
    });
  });
  
  // Flag exact duplicates
  let duplicateCount = 0;
  duplicateMap.forEach((count, normalized) => {
    if (count > 1) {
      duplicateCount += count - 1;
      issues.push(`🔁 Duplicate sentence found ${count} times`);
    }
  });
  
  if (duplicateCount > 0) {
    console.warn(`⚠️ Found ${duplicateCount} duplicate sentences across sections`);
    metrics.sectionsWithIssues++;
  }
  
  // Fetch ticker mappings for type validation
  const { data: tickerMappings } = await supabase
    .from('ticker_mappings')
    .select('symbol, type, display_name')
    .eq('is_active', true);
  
  const mappingsBySymbol = new Map();
  if (tickerMappings) {
    tickerMappings.forEach((m: any) => {
      mappingsBySymbol.set(m.symbol.toUpperCase().trim(), m);
    });
  }
  
  // Check asset type classification
  const cryptoSectionPattern = /<h2>.*?(Cryptocurrency|Crypto|Bitcoin|Altcoin|Social).*?<\/h2>/i;
  const stockSectionPattern = /<h2>.*?(Stock|Traditional Market|Equity).*?<\/h2>/i;
  
  for (let i = 0; i < sections.length; i++) {
    const section = sections[i];
    if (section.startsWith('<h2>')) continue;
    
    const prevHeader = i > 0 ? sections[i - 1] : '';
    const isCryptoSection = cryptoSectionPattern.test(prevHeader);
    const isStockSection = stockSectionPattern.test(prevHeader);
    
    // Extract asset mentions
    const mentions = section.match(/\(([A-Z0-9_]{2,10})\)/g);
    if (mentions) {
      mentions.forEach(m => {
        const symbol = m.replace(/[()]/g, '').toUpperCase().trim();
        const mapping = mappingsBySymbol.get(symbol);
        
        if (mapping) {
          if (isCryptoSection && !['crypto', 'dex'].includes(mapping.type)) {
            issues.push(`⚠️ ${symbol} (${mapping.type}) in crypto section`);
            metrics.assetMisclassifications++;
          }
          if (isStockSection && !['stock', 'etf'].includes(mapping.type)) {
            issues.push(`⚠️ ${symbol} (${mapping.type}) in stock section`);
            metrics.assetMisclassifications++;
          }
        }
      });
    }
  }
  
  console.log(`✅ Validation complete: ${issues.length} issues found`);
  
  return {
    passed: metrics.assetMisclassifications === 0 && duplicateCount === 0,
    issues,
    metrics
  };
}

// ===================================================================
// POLYGON.IO PRICE FALLBACK SYSTEM
// ===================================================================

interface PriceDataResult {
  price: number | null;
  source: 'polygon' | 'coingecko' | 'live_prices' | 'cached' | 'failed';
  timestamp: string;
  isStale: boolean;
  freshnessMinutes: number;
  metadata?: any;
}

/**
 * Fetch crypto prices with multi-source fallback system
 * Priority: Polygon.io -> CoinGecko -> live_prices table -> cached brief data
 */
async function fetchCryptoDataWithFallbacks(
  supabase: any,
  symbols: string[] = ['BTC', 'ETH', 'SOL']
): Promise<Map<string, PriceDataResult>> {
  console.log(`\n💰 Starting multi-source price fetch for: ${symbols.join(', ')}`);
  const results = new Map<string, PriceDataResult>();
  const now = new Date();
  
  // ===================================================================
  // 0. TRY PRICE_CACHE TABLE FIRST (FASTEST)
  // ===================================================================
  try {
    console.log('📡 [0/5] Checking price_cache table...');
    const { data: cachedPrices } = await supabase
      .from('price_cache')
      .select('symbol, price, source, cached_at')
      .in('symbol', symbols)
      .gte('expires_at', now.toISOString());
    
    if (cachedPrices && cachedPrices.length > 0) {
      cachedPrices.forEach((row: any) => {
        const timestamp = new Date(row.cached_at);
        const freshnessMinutes = Math.floor((now.getTime() - timestamp.getTime()) / 60000);
        
        results.set(row.symbol, {
          price: row.price,
          source: 'cached',
          timestamp: row.cached_at,
          isStale: false,
          freshnessMinutes
        });
        console.log(`  ✅ ${row.symbol}: $${row.price.toFixed(2)} from price_cache (${freshnessMinutes}min old)`);
      });
      
      console.log(`✅ price_cache provided ${cachedPrices.length}/${symbols.length} prices`);
    }
  } catch (error) {
    console.error('❌ price_cache fetch failed:', error instanceof Error ? error.message : 'Unknown error');
  }
  
  // ===================================================================
  // 1. TRY POLYGON.IO CRYPTO SNAPSHOT (PRIMARY SOURCE)
  // ===================================================================
  try {
    console.log('📡 [1/4] Trying Polygon.io crypto snapshot...');
    const polygonUrl = `https://api.polygon.io/v2/snapshot/locale/global/markets/crypto/tickers?apiKey=${polygonApiKey}`;
    const polygonResponse = await fetch(polygonUrl);
    
    if (polygonResponse.ok) {
      const polygonData = await polygonResponse.json();
      
      if (polygonData.status === 'OK' && polygonData.tickers) {
        symbols.forEach(symbol => {
          // Match Polygon ticker format (e.g., X:BTCUSD)
          const ticker = polygonData.tickers.find((t: any) => 
            t.ticker === `X:${symbol}USD` || 
            t.ticker === `${symbol}USD` ||
            t.ticker.includes(symbol)
          );
          
          // Use day.c (close) or day.vw (volume-weighted avg), fallback to lastTrade.p
          const price = ticker?.day?.c || ticker?.day?.vw || ticker?.lastTrade?.p;
          const timestampMs = ticker?.updated || ticker?.day?.t || ticker?.lastTrade?.t;
          
          // Sanity check price ranges
          let priceValid = false;
          if (price && price > 0) {
            if (symbol === 'BTC' && price > 10000 && price < 1000000) priceValid = true;
            else if (symbol === 'ETH' && price > 500 && price < 50000) priceValid = true;
            else if (price > 0.0001 && price < 100000) priceValid = true; // Other cryptos
          }
          
          if (ticker && priceValid) {
            const timestamp = new Date(timestampMs); // Polygon uses milliseconds
            const freshnessMinutes = Math.floor((now.getTime() - timestamp.getTime()) / 60000);
            
            // Warn if data is stale
            if (freshnessMinutes > 60) {
              console.warn(`  ⚠️ Polygon price for ${symbol} is ${freshnessMinutes} minutes old`);
            }
            
            results.set(symbol, {
              price: price,
              source: 'polygon',
              timestamp: timestamp.toISOString(),
              isStale: freshnessMinutes > 30,
              freshnessMinutes,
              metadata: {
                volume: ticker.day?.v,
                change: ticker.todaysChangePerc,
                high: ticker.day?.h,
                low: ticker.day?.l
              }
            });
            console.log(`  ✅ ${symbol}: $${price.toFixed(2)} from Polygon (${freshnessMinutes}min old)`);
          } else {
            console.warn(`  ⚠️ Polygon price for ${symbol} failed sanity check: $${price}`);
          }
        });
        
        console.log(`✅ Polygon.io fetched ${results.size}/${symbols.length} prices successfully`);
      }
    } else {
      console.warn(`⚠️ Polygon.io returned ${polygonResponse.status}`);
    }
  } catch (error) {
    console.error('❌ Polygon.io fetch failed:', error instanceof Error ? error.message : 'Unknown error');
  }
  
  // Save successful Polygon prices to cache
  if (results.size > 0) {
    try {
      const cachePromises = Array.from(results.entries()).map(([symbol, data]) => {
        if (data.source === 'polygon' && data.price) {
          return supabase.from('price_cache').upsert({
            symbol,
            price: data.price,
            source: 'polygon',
            cached_at: now.toISOString(),
            expires_at: new Date(now.getTime() + 60 * 60 * 1000).toISOString(), // 1 hour
            metadata: data.metadata
          }, { onConflict: 'symbol' });
        }
      });
      await Promise.all(cachePromises);
      console.log('💾 Cached Polygon prices');
    } catch (error) {
      console.error('❌ Failed to cache prices:', error);
    }
  }
  
  // ===================================================================
  // 2. TRY COINGECKO FOR MISSING PRICES
  // ===================================================================
  const missingSymbols = symbols.filter(s => !results.has(s));
  if (missingSymbols.length > 0) {
    try {
      console.log(`📡 [2/4] Trying CoinGecko for missing symbols: ${missingSymbols.join(', ')}...`);
      const coinGeckoMap: { [key: string]: string } = {
        'BTC': 'bitcoin',
        'ETH': 'ethereum',
        'SOL': 'solana',
        'XRP': 'ripple',
        'ADA': 'cardano',
        'DOGE': 'dogecoin'
      };
      
      const coinIds = missingSymbols.map(s => coinGeckoMap[s] || s.toLowerCase()).join(',');
      const cgUrl = `https://api.coingecko.com/api/v3/simple/price?ids=${coinIds}&vs_currencies=usd&include_24hr_change=true&include_last_updated_at=true`;
      const cgResponse = await fetch(cgUrl, {
        headers: { 'x-cg-pro-api-key': coingeckoApiKey }
      });
      
      if (cgResponse.ok) {
        const cgData = await cgResponse.json();
        
        missingSymbols.forEach(symbol => {
          const coinId = coinGeckoMap[symbol] || symbol.toLowerCase();
          if (cgData[coinId]?.usd) {
            const timestamp = cgData[coinId].last_updated_at 
              ? new Date(cgData[coinId].last_updated_at * 1000) 
              : now;
            const freshnessMinutes = Math.floor((now.getTime() - timestamp.getTime()) / 60000);
            
            results.set(symbol, {
              price: cgData[coinId].usd,
              source: 'coingecko',
              timestamp: timestamp.toISOString(),
              isStale: freshnessMinutes > 30,
              freshnessMinutes,
              metadata: {
                change24h: cgData[coinId].usd_24h_change
              }
            });
            console.log(`  ✅ ${symbol}: $${cgData[coinId].usd.toFixed(2)} from CoinGecko (${freshnessMinutes}min old)`);
          }
        });
        
        console.log(`✅ CoinGecko fetched ${results.size - (symbols.length - missingSymbols.length)}/${missingSymbols.length} additional prices`);
      }
    } catch (error) {
      console.error('❌ CoinGecko fetch failed:', error instanceof Error ? error.message : 'Unknown error');
    }
  }
  
  // ===================================================================
  // 3. TRY LIVE_PRICES TABLE FOR STILL-MISSING PRICES
  // ===================================================================
  const stillMissing = symbols.filter(s => !results.has(s));
  if (stillMissing.length > 0) {
    try {
      console.log(`📡 [3/4] Trying live_prices table for: ${stillMissing.join(', ')}...`);
      const { data: livePrices } = await supabase
        .from('live_prices')
        .select('ticker, price, updated_at')
        .in('ticker', stillMissing);
      
      if (livePrices && livePrices.length > 0) {
        livePrices.forEach((row: any) => {
          const timestamp = new Date(row.updated_at);
          const freshnessMinutes = Math.floor((now.getTime() - timestamp.getTime()) / 60000);
          
          results.set(row.ticker, {
            price: row.price,
            source: 'live_prices',
            timestamp: row.updated_at,
            isStale: freshnessMinutes > 60,
            freshnessMinutes
          });
          console.log(`  ✅ ${row.ticker}: $${row.price.toFixed(2)} from live_prices table (${freshnessMinutes}min old)`);
        });
        
        console.log(`✅ live_prices table provided ${livePrices.length}/${stillMissing.length} additional prices`);
      }
    } catch (error) {
      console.error('❌ live_prices table fetch failed:', error instanceof Error ? error.message : 'Unknown error');
    }
  }
  
  // ===================================================================
  // 4. LAST RESORT: TRY CACHED BRIEF DATA
  // ===================================================================
  const finalMissing = symbols.filter(s => !results.has(s));
  if (finalMissing.length > 0) {
    try {
      console.log(`📡 [4/4] Last resort: checking cached brief data for: ${finalMissing.join(', ')}...`);
      const { data: latestBrief } = await supabase
        .from('market_briefs')
        .select('market_data, created_at')
        .eq('is_published', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      
      if (latestBrief?.market_data) {
        finalMissing.forEach(symbol => {
          const priceKey = symbol === 'BTC' ? 'btc_price' : symbol === 'ETH' ? 'eth_price' : null;
          if (priceKey && latestBrief.market_data[priceKey]) {
            const timestamp = new Date(latestBrief.created_at);
            const freshnessMinutes = Math.floor((now.getTime() - timestamp.getTime()) / 60000);
            
            results.set(symbol, {
              price: latestBrief.market_data[priceKey],
              source: 'cached',
              timestamp: latestBrief.created_at,
              isStale: freshnessMinutes > 120,
              freshnessMinutes
            });
            console.log(`  ⚠️ ${symbol}: $${latestBrief.market_data[priceKey].toFixed(2)} from cached brief (${freshnessMinutes}min old)`);
          }
        });
      }
    } catch (error) {
      console.error('❌ Cached brief fetch failed:', error instanceof Error ? error.message : 'Unknown error');
    }
  }
  
  // ===================================================================
  // SUMMARY
  // ===================================================================
  const failed = symbols.filter(s => !results.has(s));
  if (failed.length > 0) {
    console.error(`❌ FAILED to fetch prices for: ${failed.join(', ')}`);
    failed.forEach(symbol => {
      results.set(symbol, {
        price: null,
        source: 'failed',
        timestamp: now.toISOString(),
        isStale: true,
        freshnessMinutes: 9999
      });
    });
  }
  
  console.log(`\n📊 Final price fetch summary:`);
  console.log(`  ✅ Success: ${results.size - failed.length}/${symbols.length}`);
  console.log(`  ❌ Failed: ${failed.length}/${symbols.length}`);
  
  return results;
}

// ========================================
// PLACEHOLDER SUBSTITUTION
// ========================================
function substitutePlaceholders(htmlContent: string, snapshot: any): { content: string; substitutions: number; missing: string[] } {
  let content = htmlContent;
  let substitutions = 0;
  const missing: string[] = [];
  
  // Substitute crypto prices
  if (snapshot.crypto) {
    for (const [symbol, data] of Object.entries(snapshot.crypto)) {
      const pricePattern = new RegExp(`\\$\\{\\{${symbol}_PRICE\\}\\}`, 'g');
      const changePattern = new RegExp(`\\{\\{${symbol}_CHANGE\\}\\}`, 'g');
      
      const priceCount = (content.match(pricePattern) || []).length;
      const changeCount = (content.match(changePattern) || []).length;
      
      if (priceCount > 0) {
        content = content.replace(pricePattern, (data as any).price.toFixed(2));
        substitutions += priceCount;
      }
      
      if (changeCount > 0) {
        const changeStr = (data as any).change24h >= 0 ? '+' : '';
        content = content.replace(changePattern, `${changeStr}${(data as any).change24h.toFixed(2)}`);
        substitutions += changeCount;
      }
    }
  }
  
  // Substitute global metrics
  if (snapshot.global) {
    if (snapshot.global.market_cap) {
      const pattern = /\$\{\{MARKET_CAP\}\}/g;
      const count = (content.match(pattern) || []).length;
      if (count > 0) {
        content = content.replace(pattern, (snapshot.global.market_cap / 1e9).toFixed(2));
        substitutions += count;
      }
    }
    
    if (snapshot.global.volume_24h) {
      const pattern = /\$\{\{VOLUME_24H\}\}/g;
      const count = (content.match(pattern) || []).length;
      if (count > 0) {
        content = content.replace(pattern, (snapshot.global.volume_24h / 1e9).toFixed(2));
        substitutions += count;
      }
    }
  }
  
  // Substitute stock prices
  if (snapshot.stocks) {
    for (const [ticker, data] of Object.entries(snapshot.stocks)) {
      const pricePattern = new RegExp(`\\$\\{\\{${ticker}_PRICE\\}\\}`, 'g');
      const changePattern = new RegExp(`\\{\\{${ticker}_CHANGE\\}\\}`, 'g');
      
      const priceCount = (content.match(pricePattern) || []).length;
      const changeCount = (content.match(changePattern) || []).length;
      
      if (priceCount > 0) {
        content = content.replace(pricePattern, (data as any).price.toFixed(2));
        substitutions += priceCount;
      }
      
      if (changeCount > 0) {
        const changeStr = (data as any).change >= 0 ? '+' : '';
        content = content.replace(changePattern, `${changeStr}${(data as any).change.toFixed(2)}`);
        substitutions += changeCount;
      }
    }
  }
  
  // Check for any remaining placeholders (missing data)
  const remainingPlaceholders = content.match(/\$?\{\{[A-Z_]+\}\}/g);
  if (remainingPlaceholders) {
    missing.push(...remainingPlaceholders.map(p => p.replace(/\$?\{\{|\}\}/g, '')));
    content = content.replace(/\$?\{\{[A-Z_]+\}\}/g, '[data unavailable]');
  }
  
  return { content, substitutions, missing };
}

// ========================================
// NUMERIC VALIDATOR & AUTO-CORRECT
// ========================================
function validateAndCorrectNumbers(htmlContent: string, snapshot: any): { content: string; corrections: string[] } {
  let content = htmlContent;
  const corrections: string[] = [];
  
  // Build lookup map for validation
  const priceMap = new Map<number, { symbol: string; expectedPrice: number }>();
  
  // Add crypto prices (rounded for fuzzy matching)
  if (snapshot.crypto) {
    for (const [symbol, data] of Object.entries(snapshot.crypto)) {
      const roundedPrice = Math.round((data as any).price);
      priceMap.set(roundedPrice, { symbol, expectedPrice: (data as any).price });
    }
  }
  
  // Add stock prices
  if (snapshot.stocks) {
    for (const [ticker, data] of Object.entries(snapshot.stocks)) {
      const roundedPrice = Math.round((data as any).price);
      priceMap.set(roundedPrice, { symbol: ticker, expectedPrice: (data as any).price });
    }
  }
  
  // Pattern to find currency amounts
  const currencyPattern = /\$([0-9,]+\.?[0-9]{0,2})/g;
  const matches: Array<{ index: number; value: string; price: number }> = [];
  let match;
  
  while ((match = currencyPattern.exec(content)) !== null) {
    const priceStr = match[1].replace(/,/g, '');
    const price = parseFloat(priceStr);
    matches.push({ index: match.index, value: match[0], price });
  }
  
  // Process matches in reverse order to preserve indices
  for (let i = matches.length - 1; i >= 0; i--) {
    const m = matches[i];
    
    if (isNaN(m.price) || m.price === 0) {
      corrections.push(`Removed invalid ${m.value}`);
      content = content.substring(0, m.index) + '[price unavailable]' + content.substring(m.index + m.value.length);
      continue;
    }
    
    // Check for significant deviations
    const roundedPrice = Math.round(m.price);
    if (priceMap.has(roundedPrice)) {
      const info = priceMap.get(roundedPrice)!;
      const deviation = Math.abs((m.price - info.expectedPrice) / info.expectedPrice);
      
      if (deviation > 0.02) { // > 2% deviation
        const newValue = `$${info.expectedPrice.toFixed(2)}`;
        corrections.push(`Auto-corrected ${info.symbol}: ${m.value} → ${newValue}`);
        content = content.substring(0, m.index) + newValue + content.substring(m.index + m.value.length);
      }
    }
  }
  
  return { content, corrections };
}


// ===================================================================
// MAIN SERVER LOGIC
// ===================================================================

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const requestBody = await req.json().catch(() => ({}));
    const briefType = requestBody.briefType || 'morning';
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Authentication - check both header and body for cron secret
    const cronSecretFromHeader = req.headers.get('x-cron-secret');
    const cronSecretFromBody = requestBody.cron_secret;
    const providedCronSecret = cronSecretFromHeader || cronSecretFromBody;
    const isCronCall = cronSecret && providedCronSecret === cronSecret;
    
    if (isCronCall) {
      const authSource = cronSecretFromHeader ? 'header (x-cron-secret)' : 'body (cron_secret)';
      console.log(`✅ Authenticated via CRON_SECRET from ${authSource}`);
    } else {
      const authHeader = req.headers.get('authorization');
      if (!authHeader) {
        return new Response(
          JSON.stringify({ error: 'Authentication required' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      const token = authHeader.replace('Bearer ', '');
      const { data: { user }, error: userError } = await supabase.auth.getUser(token);
      
      if (userError || !user) {
        return new Response(
          JSON.stringify({ error: 'Invalid authentication token' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'admin')
        .single();

      if (!roleData) {
        return new Response(
          JSON.stringify({ error: 'Admin access required' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }
    
    const isWeekendBrief = briefType === 'weekend';
    const briefTitle = isWeekendBrief 
      ? 'Weekly Market Recap' 
      : briefType === 'morning' 
        ? 'Morning Brief' 
        : 'Evening Brief';

    console.log(`\n🚀 ========================================`);
    console.log(`🚀 BRIEF TYPE: ${briefType.toUpperCase()}`);
    console.log(`🚀 BRIEF TITLE: ${briefTitle}`);
    console.log(`🚀 ========================================\n`);
    
    // Clear old cache entries before generation
    try {
      console.log('🗑️ Clearing expired cache entries...');
      const { error: cacheCleanupError } = await supabase.rpc('cleanup_expired_cache');
      if (cacheCleanupError) {
        console.warn('⚠️ Cache cleanup failed:', cacheCleanupError);
      } else {
        console.log('✅ Cache cleanup completed');
      }
    } catch (err) {
      console.warn('⚠️ Cache cleanup error:', err);
    }
    
    console.log(`\n🚀 Starting ${briefTitle} generation with MODULAR SYSTEM...`);
    
    // Collect all market data
    let newsData = { crypto: [], stocks: [] };
    let coingeckoData: CoinGeckoData[] = [];
    let trendingData: any = { coins: [] };
    let lunarcrushData: { data: LunarCrushAsset[] } = { data: [] };
    let fearGreedArray: any[] = [];
    let derivsData: any = {};
    let exchangeData: any = {};
    let globalMarketData: any = null;
    let economicCalendar = 'No major events scheduled';
    
    // Price data tracking
    let priceDataResults: Map<string, PriceDataResult> | null = null;
    let btcPriceSource: string = 'unknown';
    let btcPriceTimestamp: string = new Date().toISOString();
    let dataFreshnessMinutes: number = 0;
    let dataWarnings: string[] = [];
    let polygonUsed: boolean = false;
    
    try {
      console.log('📰 Fetching news data...');
      const newsResponse = await supabase.functions.invoke('news-fetch', { body: { limit: 50 } });
      if (!newsResponse.error) {
        newsData = newsResponse.data || { crypto: [], stocks: [] };
        console.log(`✅ News fetch: ${newsData.crypto?.length || 0} crypto, ${newsData.stocks?.length || 0} stocks`);
      }
    } catch (err) {
      console.error('❌ News fetch failed:', err);
    }
    
    // ========================================
    // CANONICAL DATA SNAPSHOT - Single Source of Truth
    // ========================================
    console.log('📊 Creating canonical data snapshot...');
    const snapshotTimestamp = new Date().toISOString();
    dataWarnings = []; // Clear existing warnings for snapshot section
    
    // 1. Fetch all crypto prices via quotes edge function (Polygon-first)
    const cryptoSymbols = ['BTC', 'ETH', 'SOL', 'XRP', 'BNB', 'ADA', 'DOGE', 'AVAX', 'LINK', 'DOT'];
    let cryptoPriceSnapshot: Record<string, { price: number; change24h: number }> = {};
    
    try {
      const { data: quotesData, error: quotesError } = await supabase.functions.invoke('quotes', {
        body: { symbols: cryptoSymbols }
      });
      
      if (!quotesError && quotesData?.quotes) {
        quotesData.quotes.forEach((quote: any) => {
          if (quote.price !== null && !isNaN(quote.price)) {
            cryptoPriceSnapshot[quote.symbol] = {
              price: parseFloat(quote.price),
              change24h: parseFloat(quote.change24h || 0)
            };
          }
        });
        console.log(`✅ Crypto prices: ${Object.keys(cryptoPriceSnapshot).length}/${cryptoSymbols.length} symbols`);
      } else {
        dataWarnings.push('Crypto price data partially unavailable');
        console.warn('⚠️ Quotes function error:', quotesError);
      }
    } catch (err) {
      dataWarnings.push('Crypto price data fetch failed');
      console.error('❌ Crypto price fetch failed:', err);
    }
    
    // 2. Fetch global market metrics from CoinGecko
    let globalMetrics: { market_cap: number | null; volume_24h: number | null; btc_dominance: number | null } = {
      market_cap: null,
      volume_24h: null,
      btc_dominance: null
    };
    
    try {
      const cgResponse = await fetch('https://api.coingecko.com/api/v3/global', {
        headers: { 'x-cg-demo-api-key': coinGeckoApiKey }
      });
      if (cgResponse.ok) {
        const cgData = await cgResponse.json();
        if (cgData.data) {
          globalMetrics.market_cap = cgData.data.total_market_cap?.usd || null;
          globalMetrics.volume_24h = cgData.data.total_volume?.usd || null;
          globalMetrics.btc_dominance = cgData.data.market_cap_percentage?.btc || null;
          console.log(`✅ Global metrics: MCap=${globalMetrics.market_cap ? 'OK' : 'MISS'}, Vol=${globalMetrics.volume_24h ? 'OK' : 'MISS'}`);
        }
      }
    } catch (err) {
      dataWarnings.push('Global market metrics unavailable');
      console.error('❌ Global metrics fetch failed:', err);
    }
    
    // 3. Fetch stock market data from Polygon
    const stockTickers = ['SPY', 'QQQ', 'COIN', 'MSTR', 'NVDA', 'TSLA', 'AAPL', 'GOOGL'];
    let stockMarketData: Record<string, { price: number; change: number; volume: number }> = {};
    
    try {
      console.log('📈 Fetching stock market data from Polygon...');
      const stockPromises = stockTickers.map(async (ticker) => {
        try {
          const url = `https://api.polygon.io/v2/aggs/ticker/${ticker}/prev?apiKey=${polygonApiKey}`;
          const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
          if (response.ok) {
            const data = await response.json();
            if (data.results?.[0]) {
              const result = data.results[0];
              return {
                ticker,
                price: result.c,
                change: parseFloat(((result.c - result.o) / result.o * 100).toFixed(2)),
                volume: result.v
              };
            }
          }
        } catch (error) {
          console.warn(`⚠️ Failed to fetch ${ticker}:`, error);
        }
        return null;
      });
      
      const stockResults = await Promise.all(stockPromises);
      stockResults.forEach(result => {
        if (result) {
          stockMarketData[result.ticker] = result;
        }
      });
      
      const stockCount = Object.keys(stockMarketData).length;
      console.log(`📈 Stocks snapshot: ${stockCount} of ${stockTickers.length}`);
      if (stockCount === 0) {
        dataWarnings.push('Traditional market data unavailable');
      }
    } catch (err) {
      dataWarnings.push('Traditional market data fetch failed');
      console.error('❌ Stock market data fetch failed:', err);
    }
    
    // Build canonical snapshot summary
    const canonicalSnapshot = {
      timestamp: snapshotTimestamp,
      crypto: cryptoPriceSnapshot,
      global: globalMetrics,
      stocks: stockMarketData,
      warnings: dataWarnings,
      sources: {
        crypto: 'Polygon.io via quotes function',
        global: 'CoinGecko /global',
        stocks: 'Polygon.io'
      }
    };
    
    console.log('✅ Canonical snapshot created:', {
      cryptoCount: Object.keys(cryptoPriceSnapshot).length,
      stockCount: Object.keys(stockMarketData).length,
      warnings: dataWarnings.length
    });

    try {
      console.log('🌍 Fetching CoinGecko global market data...');
      let globalResponse = await fetch(`https://api.coingecko.com/api/v3/global`, {
        headers: { 'x-cg-pro-api-key': coingeckoApiKey, 'accept': 'application/json' }
      });
      if (globalResponse.ok) {
        const globalJson = await globalResponse.json();
        globalMarketData = globalJson.data;
      }
    } catch (err) {
      console.error('❌ Global market data fetch failed:', err);
    }

    // ===================================================================
    // PHASE 1: FETCH PRICES WITH POLYGON.IO FALLBACK SYSTEM
    // ===================================================================
    try {
      console.log('💰 Fetching crypto prices with Polygon.io fallback system...');
      priceDataResults = await fetchCryptoDataWithFallbacks(supabase, ['BTC', 'ETH', 'SOL', 'XRP', 'ADA', 'DOGE']);
      
      const btcResult = priceDataResults.get('BTC');
      if (btcResult && btcResult.price) {
        btcPriceSource = btcResult.source;
        btcPriceTimestamp = btcResult.timestamp;
        dataFreshnessMinutes = btcResult.freshnessMinutes;
        polygonUsed = btcResult.source === 'polygon';
        
        if (btcResult.isStale) {
          dataWarnings.push(`BTC price is ${btcResult.freshnessMinutes}min old from ${btcResult.source}`);
        }
        
        console.log(`✅ BTC price: $${btcResult.price.toFixed(2)} from ${btcResult.source} (${btcResult.freshnessMinutes}min old)`);
      } else {
        dataWarnings.push('BTC price unavailable from all sources');
        console.error('❌ CRITICAL: BTC price is null/undefined!');
      }
    } catch (err) {
      console.error('❌ Price fetch with fallbacks failed:', err);
      dataWarnings.push('Price fetching system failed');
    }

    try {
      console.log('🪙 Fetching CoinGecko market data...');
      const baseUrl = 'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=250&page=1&price_change_percentage=24h,7d,30d';
      let coingeckoResponse = await fetch(baseUrl, {
        headers: { 'x-cg-pro-api-key': coingeckoApiKey, 'accept': 'application/json' }
      });
      if (coingeckoResponse.ok) {
        coingeckoData = await coingeckoResponse.json();
        
        // CRITICAL: Override BTC/ETH prices with Polygon data if available
        if (priceDataResults) {
          const btcResult = priceDataResults.get('BTC');
          const ethResult = priceDataResults.get('ETH');
          
          coingeckoData = coingeckoData.map(coin => {
            if (coin.symbol === 'btc' && btcResult?.price) {
              console.log(`🔄 Overriding BTC price: CoinGecko $${coin.current_price} → Polygon $${btcResult.price}`);
              return { ...coin, current_price: btcResult.price };
            }
            if (coin.symbol === 'eth' && ethResult?.price) {
              console.log(`🔄 Overriding ETH price: CoinGecko $${coin.current_price} → Polygon $${ethResult.price}`);
              return { ...coin, current_price: ethResult.price };
            }
            return coin;
          });
        }
      }
    } catch (err) {
      console.error('❌ CoinGecko fetch failed:', err);
    }

    try {
      console.log('📈 Fetching trending coins...');
      const trendingResponse = await fetch(`https://api.coingecko.com/api/v3/search/trending`, {
        headers: { 'x-cg-pro-api-key': coingeckoApiKey, 'accept': 'application/json' }
      });
      if (trendingResponse.ok) {
        trendingData = await trendingResponse.json();
      }
    } catch (err) {
      console.error('❌ Trending fetch failed:', err);
    }

    try {
      console.log('😱 Fetching Fear & Greed Index...');
      const fearGreedResponse = await fetch('https://api.alternative.me/fng/?limit=30');
      if (fearGreedResponse.ok) {
        const fearGreedJson = await fearGreedResponse.json();
        fearGreedArray = fearGreedJson.data || [];
      }
    } catch (err) {
      console.error('❌ Fear & Greed fetch failed:', err);
    }

    try {
      console.log('🌙 Fetching LunarCrush social data via edge function...');
      const { data: lunarcrushResponse, error: lunarcrushError } = await supabase.functions.invoke('lunarcrush-social');
      
      if (lunarcrushError) {
        console.warn('⚠️ LunarCrush edge function error (non-critical):', lunarcrushError);
        dataWarnings.push('LunarCrush social data unavailable');
      } else if (lunarcrushResponse?.data && Array.isArray(lunarcrushResponse.data)) {
        lunarcrushData = { data: lunarcrushResponse.data };
        console.log(`✅ Fetched ${lunarcrushData.data?.length || 0} assets from LunarCrush`);
      } else if (lunarcrushResponse?.warning) {
        console.warn('⚠️ LunarCrush returned warning:', lunarcrushResponse.warning);
        dataWarnings.push('LunarCrush social data unavailable');
      } else {
        console.warn('⚠️ No data returned from LunarCrush edge function (non-critical)');
        dataWarnings.push('LunarCrush social data unavailable');
      }
    } catch (err) {
      console.warn('⚠️ LunarCrush fetch failed (non-critical):', err);
      dataWarnings.push('LunarCrush social data unavailable');
    }

    try {
      console.log('📊 Fetching derivatives data...');
      const derivsResponse = await supabase.functions.invoke('derivs', { body: { symbols: ['BTC', 'ETH', 'SOL'] } });
      if (!derivsResponse.error) {
        derivsData = derivsResponse.data || {};
      }
    } catch (err) {
      console.error('❌ Derivs fetch failed:', err);
    }

    try {
      console.log('🏦 Fetching exchange data...');
      const exchangeResponse = await supabase.functions.invoke('exchange-data-aggregator', { 
        body: { symbols: ['BTC', 'ETH', 'SOL', 'XRP', 'ADA'] } 
      });
      if (!exchangeResponse.error) {
        exchangeData = exchangeResponse.data || {};
      }
    } catch (err) {
      console.error('❌ Exchange data fetch failed:', err);
    }

    // Technical Indicators (Priority 2)
    let technicalData: any = {};
    try {
      console.log('📈 Fetching technical indicators...');
      const technicalResponse = await supabase.functions.invoke('polygon-technical-indicators', {
        body: {
          tickers: ['BTC', 'ETH', 'SOL', 'XRP', 'BNB', 'ADA', 'DOGE', 'AVAX', 'LINK', 'DOT'],
          indicators: ['rsi', 'macd', 'sma_50', 'ema_20'],
          timeframe: 'daily'
        }
      });
      if (!technicalResponse.error && technicalResponse.data) {
        technicalData = technicalResponse.data.data || {};
        console.log(`✅ Fetched technical indicators for ${Object.keys(technicalData).length} tickers`);
      }
    } catch (err) {
      console.error('❌ Technical indicators fetch failed:', err);
    }

    // Quote selection
    let selectedQuote = "The market is a device for transferring money from the impatient to the patient.";
    let selectedAuthor = "Warren Buffett";
    let quoteSource = 'fallback';
    
    try {
      const { data: quoteLibrary } = await supabase
        .from('quote_library')
        .select('*')
        .eq('is_active', true)
        .order('last_used_at', { ascending: true, nullsFirst: true })
        .limit(1)
        .single();
      
      if (quoteLibrary) {
        selectedQuote = quoteLibrary.quote_text;
        selectedAuthor = quoteLibrary.author;
        quoteSource = 'library';
        
        await supabase
          .from('quote_library')
          .update({
            times_used: quoteLibrary.times_used + 1,
            last_used_at: new Date().toISOString()
          })
          .eq('id', quoteLibrary.id);
      }
    } catch (err) {
      console.error('⚠️ Quote fetch failed:', err);
    }

    // Calculate key metrics with validation
    let btcData = coingeckoData.find(coin => coin.symbol === 'btc');
    const ethData = coingeckoData.find(coin => coin.symbol === 'eth');
    
    // CRITICAL VALIDATION: Ensure BTC price is available
    if (!btcData || !btcData.current_price || btcData.current_price === 0) {
      console.error(`❌ CRITICAL ERROR: BTC price is null/undefined/zero after all fallbacks!`);
      console.error(`   Brief Type: ${briefType}`);
      console.error(`   Price Results: ${JSON.stringify(Array.from(priceDataResults?.entries() || []))}`);
      console.error(`   Data Warnings: ${dataWarnings.join(', ')}`);
      
      // Try one more time with cached price
      const btcResult = priceDataResults?.get('BTC');
      if (btcResult?.price && btcResult.price > 0) {
        console.warn(`⚠️ Using cached BTC price as emergency fallback: $${btcResult.price}`);
        // Inject it into coingeckoData
        if (!btcData) {
          const injectedBtc = {
            id: 'bitcoin',
            symbol: 'btc',
            name: 'Bitcoin',
            current_price: btcResult.price,
            market_cap: 0,
            total_volume: 0,
            price_change_percentage_24h: 0
          } as any;
          coingeckoData.push(injectedBtc);
          btcData = injectedBtc;
        } else {
          btcData.current_price = btcResult.price;
        }
      } else {
        dataWarnings.push('CRITICAL: BTC price validation failed - all sources exhausted');
        
        return new Response(
          JSON.stringify({ 
            error: 'BTC price unavailable', 
            details: 'All price sources (Polygon, CoinGecko, cache) failed to provide valid BTC price',
            briefType: briefType,
            warnings: dataWarnings,
            priceResults: Array.from(priceDataResults?.entries() || [])
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }
    
    const btcPriceStr = btcData?.current_price != null ? Number(btcData.current_price).toFixed(2) : 'N/A';
    const ethPriceStr = ethData?.current_price != null ? Number(ethData.current_price).toFixed(2) : 'N/A';
    console.log(`✅ Price validation passed: BTC=$${btcPriceStr}, ETH=$${ethPriceStr}`);
    
    const changeField = isWeekendBrief ? 'price_change_percentage_7d_in_currency' : 'price_change_percentage_24h';
    
    const topGainers = coingeckoData
      .filter(coin => coin[changeField] > 0)
      .sort((a, b) => b[changeField] - a[changeField])
      .slice(0, isWeekendBrief ? 8 : 5);

    const topLosers = coingeckoData
      .filter(coin => coin[changeField] < 0)
      .sort((a, b) => a[changeField] - b[changeField])
      .slice(0, isWeekendBrief ? 8 : 5);

    const biggestMover = coingeckoData
      .filter(coin => Math.abs(coin[changeField]) > 0)
      .sort((a, b) => Math.abs(b[changeField]) - Math.abs(a[changeField]))[0];

    const currentFearGreed = fearGreedArray[0] || { value: 50, value_classification: 'Neutral' };
    
    const totalMarketCap = globalMarketData?.total_market_cap?.usd || 
      coingeckoData.reduce((sum, coin) => sum + (coin.market_cap || 0), 0);
    const totalVolume = globalMarketData?.total_volume?.usd || 
      coingeckoData.reduce((sum, coin) => sum + (coin.total_volume || 0), 0);
    
    // ===================================================================
    // MODULAR GENERATION - Section by Section
    // ===================================================================
    
    console.log('\n🎯 Starting modular section-by-section generation...');
    
    const sections = isWeekendBrief ? WEEKLY_SECTIONS : DAILY_SECTIONS;
    
    // Prepare consolidated data object
    const allData = {
      totalMarketCap,
      totalVolume,
      currentFearGreed,
      btcData,
      ethData,
      biggestMover,
      topGainers,
      topLosers,
      weeklyGainers: topGainers,
      weeklyLosers: topLosers,
      coingeckoData,
      trendingData,
      lunarcrushData,
      derivsData,
      exchangeData,
      technicalData,
      newsData,
      stockMarketData,
      economicCalendar,
      canonicalSnapshot, // Add canonical snapshot
      isWeekly: isWeekendBrief
    };
    
    // Initialize fact tracker
    const factTracker: FactTracker = {
      assetPrimaryAnalyses: new Set(),
      numericFacts: new Map(),
      themes: new Set()
    };
    
    // Generate each section sequentially
    let fullBriefContent = '';
    let traditionalMarketsFallbackUsed = false;
    
    for (const sectionDef of sections) {
      let sectionContent = await generateSection(
        sectionDef,
        allData,
        fullBriefContent,
        factTracker,
        isWeekendBrief
      );
      
      // CRITICAL: Validate Traditional Markets section and force fallback if empty
      if (sectionDef.title === 'Traditional Markets' && isTraditionalMarketsEmpty(sectionContent)) {
        console.warn('⚠️ Traditional Markets section is empty/placeholder - engaging deterministic fallback');
        const fallbackContent = buildTraditionalMarketsSection(stockMarketData);
        sectionContent = sectionContent.replace(
          /(<h2>Traditional Markets<\/h2>)([\s\S]*?)(?=<h2>|$)/,
          `$1\n${fallbackContent}\n`
        );
        
        // If no h2 tag found, wrap the fallback properly
        if (!sectionContent.includes('<h2>Traditional Markets</h2>')) {
          sectionContent = `<h2>Traditional Markets</h2>\n${fallbackContent}\n`;
        }
        
        traditionalMarketsFallbackUsed = true;
      }
      
      fullBriefContent += sectionContent + '\n\n';
    }
    
    // Quote handled in UI; do not append to content
    
    
    console.log(`\n✅ All sections generated: ${fullBriefContent.split(/\s+/).length} total words`);
    
    // ===================================================================
    // EDITORIAL REVIEW
    // ===================================================================
    
    const editedContent = await editBriefContent(fullBriefContent, sections, briefType);
    
    // ===================================================================
    // GLOBAL DEDUPLICATION
    // ===================================================================
    
    // Apply global deduplication
    let deduplicatedContent = deduplicateEntireBrief(editedContent);
    
    // ===================================================================
    // STRUCTURE VALIDATION & REPAIR
    // ===================================================================
    
    const { content: repairedContent, issues: structureIssues } = validateAndRepairStructure(
      deduplicatedContent,
      sections
    );
    
    if (structureIssues.length > 0) {
      console.warn(`⚠️ Structure issues found and repaired: ${structureIssues.length} issues`);
      structureIssues.forEach(issue => console.warn(`  - ${issue}`));
    }
    
    // Ensure proper paragraph spacing (fix any accidental merges)
    let finalContent = repairedContent
      .replace(/\n{3,}/g, '\n\n')  // Max 2 newlines
      .trim();
    
    // ===================================================================
    // PLACEHOLDER SUBSTITUTION & NUMERIC VALIDATION
    // ===================================================================
    
    console.log('\n🔄 Substituting placeholders with canonical data...');
    const { content: substitutedContent, substitutions, missing } = substitutePlaceholders(
      finalContent,
      canonicalSnapshot
    );
    
    console.log(`✅ Placeholder substitution: ${substitutions} substitutions made`);
    if (missing.length > 0) {
      console.warn(`⚠️ Missing data for placeholders: ${missing.join(', ')}`);
      dataWarnings.push(`Missing placeholders: ${missing.join(', ')}`);
    }
    
    console.log('\n🔍 Validating and auto-correcting numbers...');
    const { content: validatedContent, corrections } = validateAndCorrectNumbers(
      substitutedContent,
      canonicalSnapshot
    );
    
    if (corrections.length > 0) {
      console.log(`✅ Numeric validation: ${corrections.length} auto-corrections made`);
      corrections.forEach(correction => console.log(`  - ${correction}`));
    } else {
      console.log('✅ Numeric validation: All numbers accurate');
    }
    
    finalContent = validatedContent;
    
    // ===================================================================
    // VALIDATION
    // ===================================================================
    
    const validation = await validateBriefContent(finalContent, briefType, supabase);
    
    if (validation.issues.length > 0) {
      console.warn(`⚠️ Validation found ${validation.issues.length} issues:`);
      validation.issues.slice(0, 5).forEach(issue => console.warn(`  - ${issue}`));
    }
    
    // ===================================================================
    // SAVE TO DATABASE
    // ===================================================================
    
    const estTime = toZonedTime(new Date(), 'America/New_York');
    const slug = `${briefType}-${format(estTime, 'yyyy-MM-dd', { timeZone: 'America/New_York' })}`;
    
    const briefData = {
      slug,
      brief_type: briefType,
      title: briefTitle,
      executive_summary: `Market analysis for ${format(estTime, 'MMMM d, yyyy')}`,
      content_sections: {
        ai_generated_content: finalContent
      },
      market_data: {
        total_market_cap: totalMarketCap,
        total_volume: totalVolume,
        btc_price: btcData?.current_price,
        btc_price_source: btcPriceSource,
        btc_price_timestamp: btcPriceTimestamp,
        data_freshness_minutes: dataFreshnessMinutes,
        data_warnings: dataWarnings,
        polygon_used: polygonUsed,
        eth_price: ethData?.current_price,
        fear_greed: currentFearGreed.value,
        // Canonical snapshot metadata
        snapshot_timestamp: canonicalSnapshot.timestamp,
        snapshot_sources: canonicalSnapshot.sources,
        snapshot_warnings: canonicalSnapshot.warnings,
        placeholder_substitutions: substitutions,
        numeric_corrections: corrections.length,
        traditional_markets_fallback_used: traditionalMarketsFallbackUsed,
        social_sentiment: lunarcrushData?.data?.slice(0, 20).map((coin: any) => ({
          name: coin.name,
          symbol: coin.symbol,
          galaxy_score: coin.galaxy_score,
          alt_rank: coin.alt_rank,
          social_volume: coin.social_volume,
          social_dominance: coin.social_dominance,
          sentiment: coin.sentiment,
          fomo_score: coin.fomo_score || 0
        })) || []
      },
      stoic_quote: selectedQuote,
      stoic_quote_author: selectedAuthor,
      is_published: true,
      published_at: new Date().toISOString()
    };
    
    const { data: savedBrief, error: saveError } = await supabase
      .from('market_briefs')
      .upsert(briefData, {
        onConflict: 'slug',
        ignoreDuplicates: false
      })
      .select()
      .single();
    
    if (saveError) {
      console.error('❌ Failed to save brief:', saveError);
      return new Response(
        JSON.stringify({ error: 'Failed to save brief', details: saveError }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Log quote usage
    await supabase.from('daily_quotes').insert({
      used_date: format(estTime, 'yyyy-MM-dd', { timeZone: 'America/New_York' }),
      quote_text: selectedQuote,
      author: selectedAuthor,
      brief_id: savedBrief.id,
      brief_type: briefType,
      source: quoteSource
    });
    
    console.log(`\n✅ ${briefTitle} generated and saved successfully!`);
    console.log(`📊 Final stats: ${validation.metrics.wordCount} words, ${validation.metrics.totalSections} sections`);
    console.log(`🎯 Validation: ${validation.issues.length} issues, ${validation.metrics.assetMisclassifications} misclassifications`);
    
    return new Response(
      JSON.stringify({
        success: true,
        brief: savedBrief,
        validation: validation.metrics,
        message: 'Brief generated successfully with modular system'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    console.error('❌ Error in generate-daily-brief:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
