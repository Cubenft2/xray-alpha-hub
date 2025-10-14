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
    guidelines: 'Lead with the biggest story/move of the day. Cover overall market sentiment, Fear & Greed, Bitcoin/Ethereum moves, and total market metrics. FORMAT STRICTLY: One paragraph per major asset (BTC, ETH, top mover). Start each with "AssetName (SYM):" then 2-3 sentences. Insert blank line between assets. 2-3 paragraphs total.',
    dataScope: ['marketCap', 'volume', 'fearGreed', 'btc', 'eth', 'topMover'],
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
    guidelines: 'Focus on stock movements, tech stocks, crypto-related equities (COIN, MSTR), earnings if relevant. Keep crypto OUT of this section. FORMAT STRICTLY: One paragraph per stock. Start each with "CompanyName (TICKER):" then 2-3 sentences. Insert blank line between stocks.',
    dataScope: ['newsStocks', 'stockExchangeContext'],
    minWords: 100
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
  const hour = new Date().getHours();
  if (hour >= 6 && hour < 12) return 'DIRECT_TRADER';
  if (hour >= 12 && hour < 18) return 'MARKET_PSYCHOLOGIST';
  return 'DATA_DETECTIVE';
}

// Rotating metaphor themes to prevent repetition
function getMetaphorTheme(): string {
  const themes = ['sports', 'weather', 'architecture', 'music', 'food', 'travel'];
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
  return themes[dayOfYear % themes.length];
}

// Enhanced system persona with backstory and dynamic style
const XRAYCRYPTO_PERSONA = `You are XRayCrypto (internal name: Xavier Rodriguez), 38 years old, trading since 2013. You survived Mt. Gox, lost 80% in the 2018 crash, rebuilt your portfolio through discipline and data. Your philosophy: "I've been wrecked, made it, lost it, made it again. The market doesn't care about your feelings."

**YOUR WRITING STYLE TODAY: ${getWritingStyle()}**

DIRECT_TRADER: Short, punchy sentences. Military precision. "BTC broke $95K. Volume confirms. Institutions are positioning." Show the data, skip the fluff.

MARKET_PSYCHOLOGIST: Medium sentences, conversational flow. "Here's what the crowd's missing about Ethereum (ETH). While everyone's watching price, smart money is accumulating. The volume pattern suggests..."

DATA_DETECTIVE: Mix short + long sentences. Detective uncovering clues. "Bitcoin (BTC) rallied 8% today. But here's the interesting part: derivatives data shows..." Build the case piece by piece.

**METAPHOR THEME TODAY: ${getMetaphorTheme()}**
Use fresh ${getMetaphorTheme()}-based metaphors naturally. Rotate daily to prevent staleness.

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
  
  // Split into sentences and normalize
  const sentences = text.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 0);
  const seen = new Set<string>();
  const normalized = new Map<string, string>();
  let duplicateCount = 0;
  
  // Detect exact duplicates (case-insensitive, normalized)
  const uniqueSentences = sentences.filter(sentence => {
    const norm = sentence.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ');
    if (seen.has(norm)) {
      console.log(`  ❌ Removed exact duplicate: "${sentence.substring(0, 50)}..."`);
      duplicateCount++;
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
        console.log(`  ⚠️ Removed near-duplicate (${Math.round(calculateSimilarity(sentence, existing) * 100)}% similar): "${sentence.substring(0, 50)}..."`);
        duplicateCount++;
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
  
  console.log(`  📊 ${sectionTitle} cleaned: ${duplicateCount} duplicates removed, ${mergedParagraphs.size} unique items`);
  return '<p>' + paragraphs.join('</p>\n\n<p>') + '</p>';
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
  const sectionPrompt = `${XRAYCRYPTO_PERSONA}

**SECTION TO WRITE:** <h2>${sectionDef.title}</h2>

**SECTION GUIDELINES:** ${sectionDef.guidelines}${socialSentimentNote}${assetListNote}

**CONTEXT:** This is section ${sectionDef.title} of a ${isWeekly ? 'weekly' : 'daily'} market brief.${contextNote}

**ASSETS ALREADY ANALYZED:** ${Array.from(factTracker.assetPrimaryAnalyses).join(', ') || 'None yet'}
⚠️ For these assets, you MUST add NEW angles ONLY (derivatives, social sentiment, technical patterns, on-chain data, exchange flows)

**RELEVANT DATA FOR THIS SECTION:**
${relevantData}

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

✅ CORRECT: "Bitcoin (BTC): On-chain data shows accumulation by whales..."
❌ WRONG: "Bitcoin (BTC) rose 3.2% to $121,000" (if already mentioned in Market Overview)

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
          { role: 'system', content: XRAYCRYPTO_PERSONA },
          { role: 'user', content: sectionPrompt }
        ],
        temperature: 0.85,
        max_tokens: 1000
      }),
    });

    if (!response.ok) {
      console.error(`❌ OpenAI API error for section ${sectionDef.title}:`, response.status);
      return `<p>Content temporarily unavailable for ${sectionDef.title}.</p>`;
    }

    const data = await response.json();
    let content = data.choices[0].message.content.trim();
    
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
      case 'stockExchangeContext':
        if (allData.newsData?.stockExchangeContext?.length > 0) {
          const exchanges = allData.newsData.stockExchangeContext.map((s: any) => 
            `${s.ticker} (${s.exchange})`
          ).join(', ');
          parts.push(`Stock Exchanges: ${exchanges}`);
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
 * Global deduplication across entire brief
 */
function deduplicateEntireBrief(content: string): string {
  console.log('\n🔍 Running global deduplication across entire brief...');
  
  // Extract all sentences from the entire brief
  const allSentences: string[] = [];
  const sections = content.split(/(<h2>.*?<\/h2>)/g);
  
  // Track sentences we've seen
  const seenExact = new Set<string>();
  const seenSimilar: string[] = [];
  let totalRemoved = 0;
  
  // Process each section
  const deduplicatedSections = sections.map(section => {
    if (section.startsWith('<h2>')) {
      return section; // Keep headers as-is
    }
    
    // Extract sentences from this section
    const sentences = section.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 20);
    const uniqueSentences: string[] = [];
    
    sentences.forEach(sentence => {
      const normalized = sentence.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ');
      
      // Check for exact duplicates
      if (seenExact.has(normalized)) {
        console.log(`  🗑️ Removed exact duplicate: "${sentence.substring(0, 60)}..."`);
        totalRemoved++;
        return;
      }
      
      // Check for near-duplicates (>85% similar)
      let isDuplicate = false;
      for (const existing of seenSimilar) {
        if (calculateSimilarity(sentence, existing) > 0.85) {
          console.log(`  🗑️ Removed similar (${Math.round(calculateSimilarity(sentence, existing) * 100)}%): "${sentence.substring(0, 60)}..."`);
          totalRemoved++;
          isDuplicate = true;
          break;
        }
      }
      
      if (!isDuplicate) {
        uniqueSentences.push(sentence);
        seenExact.add(normalized);
        seenSimilar.push(sentence);
      }
    });
    
    // Rebuild section with unique sentences
    return uniqueSentences.length > 0 ? uniqueSentences.join('. ') + '.' : '';
  });
  
  const result = deduplicatedSections.filter(s => s.trim()).join('\n\n');
  console.log(`✅ Global deduplication complete: ${totalRemoved} duplicates removed across entire brief`);
  
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
2. **No Repetition:** Remove or rephrase any duplicate sentences between sections
3. **Voice Consistency:** Maintain XRayCrypto's sharp, plain-spoken voice with humor
4. **Flow:** Smooth transitions between sections
5. **Clarity:** Fix any awkward phrasing while preserving meaning

**CRITICAL RULES:**
- If content is repetitive, REPHRASE to add new angle rather than delete
- Preserve all <h2> section headings
- Maintain asset type classification (crypto vs stock)
- DO NOT change the core analysis or data points
- DO NOT append any quotes at the end (handled separately)

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
      }
    } catch (err) {
      console.error('❌ News fetch failed:', err);
    }

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
        console.error('❌ LunarCrush edge function error:', lunarcrushError);
      } else if (lunarcrushResponse?.data) {
        lunarcrushData = { data: lunarcrushResponse.data };
        console.log(`✅ Fetched ${lunarcrushData.data?.length || 0} assets from LunarCrush`);
      } else {
        console.warn('⚠️ No data returned from LunarCrush edge function');
      }
    } catch (err) {
      console.error('❌ LunarCrush fetch failed:', err);
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
    const btcData = coingeckoData.find(coin => coin.symbol === 'btc');
    const ethData = coingeckoData.find(coin => coin.symbol === 'eth');
    
    // CRITICAL VALIDATION: Ensure BTC price is available
    if (!btcData || !btcData.current_price || btcData.current_price === 0) {
      console.error('❌ CRITICAL ERROR: BTC price is null/undefined/zero after all fallbacks!');
      dataWarnings.push('CRITICAL: BTC price validation failed');
      
      return new Response(
        JSON.stringify({ 
          error: 'BTC price unavailable', 
          details: 'All price sources failed to provide valid BTC price',
          warnings: dataWarnings
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log(`✅ Price validation passed: BTC=$${btcData.current_price.toFixed(2)}, ETH=$${ethData?.current_price?.toFixed(2) || 'N/A'}`);
    
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
      weeklyGainers: topGainers, // Same for weekly
      weeklyLosers: topLosers,
      coingeckoData,
      trendingData,
      lunarcrushData,
      derivsData,
      exchangeData,
      technicalData,
      newsData,
      economicCalendar,
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
    
    for (const sectionDef of sections) {
      const sectionContent = await generateSection(
        sectionDef,
        allData,
        fullBriefContent,
        factTracker,
        isWeekendBrief
      );
      
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
    
    const deduplicatedContent = deduplicateEntireBrief(editedContent);
    
    // ===================================================================
    // VALIDATION
    // ===================================================================
    
    const validation = await validateBriefContent(deduplicatedContent, briefType, supabase);
    
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
        ai_generated_content: deduplicatedContent
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
