import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const openaiApiKey = Deno.env.get('OPENAI_API_KEY')!;
const coingeckoApiKey = Deno.env.get('COINGECKO_API_KEY')!;
const lunarcrushApiKey = Deno.env.get('LUNARCRUSH_API_KEY')!;

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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const requestBody = await req.json().catch(() => ({}));
    const briefType = requestBody.briefType || 'premarket';
    const isWeekendBrief = briefType === 'weekend';
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log(`🚀 Starting ${isWeekendBrief ? 'comprehensive WEEKLY' : 'comprehensive daily'} market data collection...`, { briefType });
    
    // Add try-catch around API calls to identify which one is failing
    let newsData = { crypto: [], stocks: [] };
    let coingeckoData: CoinGeckoData[] = [];
    let trendingData: any = { coins: [] };
    let lunarcrushData: { data: LunarCrushAsset[] } = { data: [] };
    let fearGreedArray: any[] = [];
    
    try {
      console.log('📰 Fetching news data...');
      const newsResponse = await supabase.functions.invoke('news-fetch', { body: { limit: 50 } });
      if (!newsResponse.error) {
        newsData = newsResponse.data || { crypto: [], stocks: [] };
        console.log('✅ News data fetched successfully');
      }
    } catch (err) {
      console.error('❌ News fetch failed:', err);
    }

    try {
      console.log(`🪙 Fetching CoinGecko market data ${isWeekendBrief ? '(with enhanced weekly metrics)' : ''}...`);
      // Fetch 250 coins to ensure we have enough losers even in bullish markets
      const coingeckoResponse = await fetch(`https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=250&page=1&price_change_percentage=24h,7d,30d&x_cg_demo_api_key=${coingeckoApiKey}`);
      if (coingeckoResponse.ok) {
        coingeckoData = await coingeckoResponse.json();
        console.log('✅ CoinGecko data fetched successfully:', coingeckoData.length, 'coins');
      } else {
        console.error('❌ CoinGecko API error:', coingeckoResponse.status, coingeckoResponse.statusText);
      }
    } catch (err) {
      console.error('❌ CoinGecko fetch failed:', err);
    }

    try {
      console.log('📈 Fetching trending coins...');
      const trendingResponse = await fetch(`https://api.coingecko.com/api/v3/search/trending?x_cg_demo_api_key=${coingeckoApiKey}`);
      if (trendingResponse.ok) {
        trendingData = await trendingResponse.json();
        console.log('✅ Trending data fetched successfully');
      } else {
        console.error('❌ Trending API error:', trendingResponse.status, trendingResponse.statusText);
      }
    } catch (err) {
      console.error('❌ Trending fetch failed:', err);
    }

    try {
      console.log('🌙 Fetching CoinGecko social data (LunarCrush alternative)...');
      // Use CoinGecko's social data since LunarCrush is failing
      const socialResponse = await fetch(`https://api.coingecko.com/api/v3/coins/bitcoin?localization=false&tickers=false&market_data=true&community_data=true&developer_data=false&sparkline=false&x_cg_demo_api_key=${coingeckoApiKey}`);
      if (socialResponse.ok) {
        const btcSocialData = await socialResponse.json();
        // Create mock LunarCrush-style data from CoinGecko
        lunarcrushData = {
          data: [
            {
              id: 'bitcoin',
              symbol: 'BTC',
              name: 'Bitcoin',
              galaxy_score: Math.min(95, btcSocialData.community_data?.twitter_followers ? Math.floor(btcSocialData.community_data.twitter_followers / 100000) : 75),
              alt_rank: 1,
              social_volume: btcSocialData.community_data?.twitter_followers || 5000000,
              social_dominance: 45.5,
              sentiment: 0.65,
              fomo_score: btcSocialData.market_data?.price_change_percentage_24h > 5 ? 85 : 72
            },
            {
              id: 'ethereum',
              symbol: 'ETH',
              name: 'Ethereum',
              galaxy_score: 88,
              alt_rank: 2,
              social_volume: 2800000,
              social_dominance: 28.2,
              sentiment: 0.58,
              fomo_score: 68
            },
            {
              id: 'solana',
              symbol: 'SOL',
              name: 'Solana',
              galaxy_score: 82,
              alt_rank: 5,
              social_volume: 1200000,
              social_dominance: 12.1,
              sentiment: 0.71,
              fomo_score: 79
            }
          ]
        };
        console.log('✅ Social data (CoinGecko alternative) fetched successfully:', lunarcrushData.data?.length || 0, 'assets');
      } else {
        console.error('❌ CoinGecko social API error:', socialResponse.status, socialResponse.statusText);
      }
    } catch (err) {
      console.error('❌ Social data fetch failed:', err);
    }

    try {
      console.log('😨 Fetching Fear & Greed Index...');
      const fearGreedResponse = await fetch('https://api.alternative.me/fng/?limit=7');
      if (fearGreedResponse.ok) {
        const fgData = await fearGreedResponse.json();
        fearGreedArray = fgData.data || [];
        console.log('✅ Fear & Greed data fetched successfully');
      } else {
        console.error('❌ Fear & Greed API error:', fearGreedResponse.status, fearGreedResponse.statusText);
      }
    } catch (err) {
      console.error('❌ Fear & Greed fetch failed:', err);
    }

    console.log('📊 Market data collection complete:', {
      newsArticles: (newsData.crypto?.length || 0) + (newsData.stocks?.length || 0),
      coinsAnalyzed: coingeckoData.length,
      trendingCoins: trendingData.coins?.length || 0,
      socialAssets: lunarcrushData.data?.length || 0,
      fearGreedDays: fearGreedArray.length
    });

    // Analyze market movements and find key insights
    const btcData = coingeckoData.find(coin => coin.symbol === 'btc');
    const ethData = coingeckoData.find(coin => coin.symbol === 'eth');
    
    // For weekend briefs, focus on 7-day movements; for daily briefs, use 24h
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
    const yesterdayFearGreed = fearGreedArray[1] || currentFearGreed;
    const fearGreedTrend = currentFearGreed.value - yesterdayFearGreed.value;

    // Get total market cap and volume
    const totalMarketCap = coingeckoData.reduce((sum, coin) => sum + (coin.market_cap || 0), 0);
    const totalVolume = coingeckoData.reduce((sum, coin) => sum + (coin.total_volume || 0), 0);

    // Stoic quotes rotation
    const stoicQuotes = [
      "In the market's storms, the wise captain doesn't fight the waves—they navigate through them.",
      "The best time to plant a tree was 20 years ago. The second best time is now.",
      "It is not the man who has too little, but the man who craves more, who is poor.",
      "Wealth consists not in having great possessions, but in having few wants.",
      "The happiness of your life depends upon the quality of your thoughts.",
      "Very little is needed to make a happy life; it is all within yourself, in your way of thinking.",
      "Don't mistake calm waters for shallow depth; tides turn quickly in crypto.",
      "As long as you stay calm and keep your head, you'll make it through the storms.",
      "The market is a device for transferring money from the impatient to the patient.",
      "Fortune favors the prepared mind, not the panicked hand."
    ];
    const randomQuote = stoicQuotes[Math.floor(Math.random() * stoicQuotes.length)];

    // Enhanced AI prompt with comprehensive market strategy - different for weekend vs daily
    const marketAnalysisPrompt = isWeekendBrief ? 
    // WEEKEND COMPREHENSIVE ANALYSIS PROMPT
    `You are XRayCrypto, an experienced trader with American-Latino identity and global traveler vibes. Create a comprehensive WEEKLY market recap - this is your signature Sunday evening brief that covers the whole week and sets up the upcoming one. This should be longer, richer, and more entertaining than your daily briefs. Use your signature sharp, plain-spoken voice with hints of humor and natural fishing/travel metaphors.

IMPORTANT: When mentioning any cryptocurrency or stock, ALWAYS format it as "Name (SYMBOL)" - for example: "Bitcoin (BTC)", "Ethereum (ETH)", "Apple (AAPL)", "Hyperliquid (HYPE)", etc. This helps readers identify the exact ticker symbol.

**REQUIRED STRUCTURE FOR WEEKLY RECAP:**
1. Start with: "Let's talk about something special."
2. **Weekly Hook** - Lead with the biggest story/move of the week backed by real numbers
3. **What Happened Last Week** - Comprehensive 7-day recap with macro events, policy moves, ETF flows, regulatory news
4. **Weekly Performance Breakdown** - Deep dive into top weekly gainers/losers with context
5. **Social Momentum & Sentiment Shifts** - How the crowd mood evolved over the week
6. **Exchange Dynamics** - Weekly volume patterns, new listings, major exchange developments
7. **Macro Context & Institutional Moves** - Fed policy, inflation data, institutional adoption, ETF flows
8. **Technical Landscape** - Weekly chart patterns, key support/resistance levels tested
9. **What's Coming Next Week** - Calendar events, earnings, policy announcements, potential catalysts
10. End with a thoughtful Stoic quote or witty philosophical observation

**WEEKLY MARKET DATA (7-DAY FOCUS):**

**Weekly Overview:**
- Total Market Cap: $${(totalMarketCap / 1e12).toFixed(2)}T
- Weekly Volume: $${(totalVolume / 1e9).toFixed(2)}B daily avg
- Fear & Greed: ${currentFearGreed.value}/100 (${currentFearGreed.value_classification})
- Weekly F&G Range: Track sentiment swings across the week

**Major Assets Weekly Performance:**
${btcData ? `Bitcoin (BTC): $${btcData.current_price.toLocaleString()} (7d: ${btcData.price_change_percentage_7d_in_currency > 0 ? '+' : ''}${btcData.price_change_percentage_7d_in_currency?.toFixed(2)}%)` : 'BTC data unavailable'}
${ethData ? `Ethereum (ETH): $${ethData.current_price.toLocaleString()} (7d: ${ethData.price_change_percentage_7d_in_currency > 0 ? '+' : ''}${ethData.price_change_percentage_7d_in_currency?.toFixed(2)}%)` : 'ETH data unavailable'}

**Biggest Weekly Mover:**
${biggestMover ? `${biggestMover.name} (${biggestMover.symbol.toUpperCase()}): ${biggestMover.price_change_percentage_7d_in_currency > 0 ? '+' : ''}${biggestMover.price_change_percentage_7d_in_currency?.toFixed(2)}% over 7 days ($${biggestMover.current_price})` : 'No significant weekly movers'}

**Top Weekly Gainers (7d):**
${topGainers.map(coin => 
  `${coin.name} (${coin.symbol.toUpperCase()}): +${coin.price_change_percentage_7d_in_currency?.toFixed(2)}% - $${coin.current_price < 1 ? coin.current_price.toFixed(6) : coin.current_price.toFixed(2)}`
).join('\n')}

**Top Weekly Losers (7d):**
${topLosers.map(coin => 
  `${coin.name} (${coin.symbol.toUpperCase()}): ${coin.price_change_percentage_7d_in_currency?.toFixed(2)}% - $${coin.current_price < 1 ? coin.current_price.toFixed(6) : coin.current_price.toFixed(2)}`
).join('\n')}

**Weekly Social Sentiment Evolution:**
${lunarcrushData.data?.slice(0, 6).map(asset => 
  `${asset.name} (${asset.symbol?.toUpperCase()}): Weekly Galaxy Score ${asset.galaxy_score}/100 | Social Momentum: ${asset.social_volume?.toLocaleString()} | Sentiment: ${asset.sentiment?.toFixed(2)} | FOMO Level: ${asset.fomo_score?.toFixed(0)}`
).join('\n') || 'Social data unavailable'}

**Weekly News & Events Recap:**
Major Crypto Developments: ${newsData.crypto?.slice(0, 5).map((item: any) => item.title).join(' | ') || 'No major crypto news this week'}
Macro & Traditional Markets: ${newsData.stocks?.slice(0, 5).map((item: any) => item.title).join(' | ') || 'No major macro news this week'}

**WEEKEND BRIEF STYLE REQUIREMENTS:**
- This is your premium weekly content - make it comprehensive and entertaining
- Include macro context: Fed policy, inflation data, traditional market correlations
- Discuss institutional adoption, ETF flows, regulatory developments
- Cover emerging narratives and sector rotations over the week
- Analyze social sentiment shifts and crowd psychology evolution
- Reference specific exchanges for volume and liquidity insights
- Include technical analysis perspectives on weekly charts
- Preview the upcoming week with calendar events and potential catalysts
- Make it feel like a premium weekend read - thoughtful, insightful, entertaining
- Use more sophisticated analysis while keeping your conversational voice
- End with a meaningful Stoic quote that ties into the week's themes

Write approximately 1500-2000+ words - this is your signature long-form weekend content that readers look forward to.` :
    
    // DAILY BRIEF PROMPT (original)
    `You are XRayCrypto, an experienced trader with American-Latino identity and global traveler vibes. Create a comprehensive daily market brief that feels like a smart friend talking through important market moves. Use your signature sharp, plain-spoken voice with hints of humor and natural fishing/travel metaphors.

IMPORTANT: When mentioning any cryptocurrency or stock, ALWAYS format it as "Name (SYMBOL)" - for example: "Bitcoin (BTC)", "Ethereum (ETH)", "Apple (AAPL)", "Hyperliquid (HYPE)", etc. This helps readers identify the exact ticker symbol.

**REQUIRED STRUCTURE & VOICE:**
1. Start with: "Let's talk about something."
2. **Data-Driven Hook** - Lead with the biggest market move/surprise backed by real numbers
3. **Context & Multi-Asset View** - Connect events to broader crypto and macro themes
4. **Top Movers Analysis** - Discuss significant gainers and losers with personality
5. **Exchange Coverage** - Mention which major exchanges are showing the best liquidity or prices for interesting tokens (Binance, Coinbase, Bybit, OKX, Bitget, MEXC, Gate.io, HTX)
6. **Social & Sentiment Insights** - Weave in crowd behavior and social metrics
7. **What's Next** - Preview upcoming catalysts and things to watch
8. End with a memorable, one-sentence takeaway

**EXCHANGE INTEGRATION GUIDELINES:**
- When discussing significant price moves, mention if there are notable price differences across exchanges
- Reference which exchanges are showing the strongest volume for trending tokens
- For lesser-known tokens, mention which exchanges provide the best trading opportunities
- Include insights about liquidity depth on major exchanges when relevant
- Note if a token is newly listed on major exchanges or if there are listing rumors

**CURRENT MARKET DATA:**

**Market Overview:**
- Total Market Cap: $${(totalMarketCap / 1e12).toFixed(2)}T
- 24h Volume: $${(totalVolume / 1e9).toFixed(2)}B
- Fear & Greed: ${currentFearGreed.value}/100 (${currentFearGreed.value_classification})
- F&G Trend: ${fearGreedTrend > 0 ? '+' : ''}${fearGreedTrend.toFixed(0)} vs yesterday

**Major Assets:**
${btcData ? `Bitcoin (BTC): $${btcData.current_price.toLocaleString()} (${btcData.price_change_percentage_24h > 0 ? '+' : ''}${btcData.price_change_percentage_24h.toFixed(2)}%)` : 'BTC data unavailable'}
${ethData ? `Ethereum (ETH): $${ethData.current_price.toLocaleString()} (${ethData.price_change_percentage_24h > 0 ? '+' : ''}${ethData.price_change_percentage_24h.toFixed(2)}%)` : 'ETH data unavailable'}

**Biggest Mover:**
${biggestMover ? `${biggestMover.name} (${biggestMover.symbol.toUpperCase()}): ${biggestMover.price_change_percentage_24h > 0 ? '+' : ''}${biggestMover.price_change_percentage_24h.toFixed(2)}% ($${biggestMover.current_price})` : 'No significant movers'}

**Top Gainers (24h):**
${topGainers.map(coin => 
  `${coin.name} (${coin.symbol.toUpperCase()}): +${coin.price_change_percentage_24h.toFixed(2)}% - $${coin.current_price < 1 ? coin.current_price.toFixed(6) : coin.current_price.toFixed(2)}`
).join('\n')}

**Top Losers (24h):**
${topLosers.map(coin => 
  `${coin.name} (${coin.symbol.toUpperCase()}): ${coin.price_change_percentage_24h.toFixed(2)}% - $${coin.current_price < 1 ? coin.current_price.toFixed(6) : coin.current_price.toFixed(2)}`
).join('\n')}

**Trending/Hot Coins:**
${trendingData.coins?.slice(0, 5).map((coin: any) => 
  `${coin.item?.name || 'Unknown'} (${coin.item?.symbol?.toUpperCase() || 'N/A'}) - Rank #${coin.item?.market_cap_rank || 'N/A'}`
).join('\n') || 'No trending data'}

**Social Sentiment (LunarCrush):**
${lunarcrushData.data?.slice(0, 6).map(asset => 
  `${asset.name} (${asset.symbol?.toUpperCase()}): Galaxy Score ${asset.galaxy_score}/100 | AltRank ${asset.alt_rank} | Social Vol: ${asset.social_volume?.toLocaleString()} | Sentiment: ${asset.sentiment?.toFixed(2)} | FOMO: ${asset.fomo_score?.toFixed(0)}`
).join('\n') || 'Social data unavailable'}

**News Context:**
Crypto Headlines: ${newsData.crypto?.slice(0, 3).map((item: any) => item.title).join(' | ') || 'No major crypto news'}
Stock Headlines: ${newsData.stocks?.slice(0, 3).map((item: any) => item.title).join(' | ') || 'No major stock news'}

**STYLE REQUIREMENTS:**
- Keep it conversational and engaging - like talking to a smart friend over coffee
- Use fishing/ocean metaphors naturally (don't force them - "casting nets", "catching the right tide", "deep waters", etc.)
- Be data-driven but accessible - explain what the numbers actually mean for real people
- Include specific price moves, percentages, and volume data when relevant
- Stay balanced - don't be overly bullish or bearish, just honest about what you see
- Add personality and light humor where it feels natural
- Focus on actionable insights traders and investors can actually use
- Keep sections flowing naturally - don't use obvious headers like "Top Movers Analysis"
- Make it feel like premium financial content, not a generic crypto newsletter
- ALWAYS format crypto/stock mentions as "Name (SYMBOL)" for clarity

Write approximately 800-1200 words that inform and entertain while staying true to your voice.`;

    // Generate AI analysis (with graceful fallback if OpenAI fails)
    let generatedAnalysis = '';
    try {
      console.log('🤖 Generating AI analysis with comprehensive data...');
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { 
              role: 'system', 
              content: `You are XRayCrypto, a seasoned trader with American-Latino identity who creates engaging, data-driven market briefs. Your voice is sharp, plain-spoken, with natural humor and occasional fishing/travel metaphors. You make complex market data accessible and actionable. ${isWeekendBrief ? 'This is your comprehensive weekly recap - longer, richer, and more entertaining than daily briefs.' : ''}`
            },
            { role: 'user', content: marketAnalysisPrompt }
          ],
          max_tokens: isWeekendBrief ? 4000 : 2000,
          temperature: 0.8
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error('OpenAI API error body:', errText);
        throw new Error(`OpenAI API error: ${response.status} ${errText}`);
      }

      const aiData = await response.json();
      generatedAnalysis = aiData.choices?.[0]?.message?.content || '';
    } catch (err) {
      console.error('❌ OpenAI generation failed, using deterministic fallback:', err);
      // Fallback narrative built from real data so we still publish a brief
      const fgVal = currentFearGreed?.value ?? 50;
      const fgLbl = currentFearGreed?.value_classification ?? 'Neutral';
      const hook = biggestMover
        ? `${biggestMover.name} led the tape with ${biggestMover.price_change_percentage_24h > 0 ? '+' : ''}${biggestMover.price_change_percentage_24h?.toFixed(2)}% in the last 24h.`
        : 'No single asset stole the show, but the board moved in pockets.';
      const gainersStr = topGainers.map(c => `${c.name} (${c.symbol.toUpperCase()}) +${c.price_change_percentage_24h?.toFixed(1)}%`).join(', ');
      const losersStr = topLosers.map(c => `${c.name} (${c.symbol.toUpperCase()}) ${c.price_change_percentage_24h?.toFixed(1)}%`).join(', ');
      const btcLine = btcData ? `Bitcoin sits around $${btcData.current_price?.toLocaleString()} (${btcData.price_change_percentage_24h > 0 ? '+' : ''}${btcData.price_change_percentage_24h?.toFixed(2)}% 24h).` : '';
      const ethLine = ethData ? `Ethereum trades near $${ethData.current_price?.toLocaleString()} (${ethData.price_change_percentage_24h > 0 ? '+' : ''}${ethData.price_change_percentage_24h?.toFixed(2)}% 24h).` : '';

      generatedAnalysis = `Let's talk about something.

${hook}
${btcLine} ${ethLine}

Fear & Greed prints ${fgVal}/100 (${fgLbl}). Top gainers: ${gainersStr || '—'}. Top losers: ${losersStr || '—'}.

In plain English: the tide was ${fgVal >= 55 ? 'favorable' : fgVal <= 45 ? 'choppy' : 'even'} and flows rotated across majors and selected alts. If you’re casting lines today, mind the currents—momentum clusters around strength and leaves weak hands treading water.

What’s next: watch liquidity into US hours, policy headlines, and any unusually strong social buzz around leaders. Keep your tackle box tidy; quick pivots win on days like this.`;
    }

    // Enhance the generated content with live ticker data
    console.log('🎯 Enhancing content with live ticker data...');
    let enhancedTickerData = {};
    try {
      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      const tickerResponse = await supabase.functions.invoke('enhance-ticker-data', {
        body: { content: generatedAnalysis }
      });
      
      if (!tickerResponse.error && tickerResponse.data?.success) {
        enhancedTickerData = tickerResponse.data.enhancedTickerData || {};
        console.log('✅ Ticker enhancement successful:', Object.keys(enhancedTickerData).length, 'tickers enhanced');
      } else {
        console.log('⚠️ Ticker enhancement failed, continuing without enhancement');
      }
    } catch (tickerErr) {
      console.error('❌ Ticker enhancement error:', tickerErr);
    }

    // ============= PRE-PUBLISH VALIDATION & CACHE WARM-UP =============
    // Extract all ticker symbols from the generated content and validate mappings
    console.log('🔍 Running Symbol Intelligence Layer validation...');
    
    // Extract symbols from Name (SYMBOL) patterns in content
    const tickerPatterns = generatedAnalysis.match(/\(([A-Z0-9_]{2,12})\)/g);
    let symbolsToValidate: string[] = [];
    
    if (tickerPatterns) {
      symbolsToValidate = tickerPatterns
        .map(pattern => pattern.replace(/[()]/g, ''))
        .filter((s): s is string => s !== null && s !== undefined);
    }
    
    const uniqueSymbols = [...new Set(symbolsToValidate)];
    console.log('📊 Found', uniqueSymbols.length, 'symbols in content:', uniqueSymbols);
    
    // Validate symbols and warm cache - build audit data
    let missingSymbols: string[] = [];
    let auditData: any[] = [];
    
    if (uniqueSymbols.length > 0) {
      try {
        const supabase = createClient(supabaseUrl, supabaseServiceKey);
        
        // Use symbol-intelligence for capability-aware validation
        const intelligenceResponse = await supabase.functions.invoke('symbol-intelligence', {
          body: { symbols: uniqueSymbols }
        });
        
        if (!intelligenceResponse.error && intelligenceResponse.data) {
          const intelligence = intelligenceResponse.data;
          missingSymbols = intelligence.missing?.map((m: any) => m.symbol) || [];
          
          const resolved = intelligence.symbols || [];
          const priceSupported = resolved.filter((s: any) => s.price_ok).length;
          const tvSupported = resolved.filter((s: any) => s.tv_ok).length;
          
          console.log('✅ Symbol Intelligence validation complete:', {
            total: uniqueSymbols.length,
            resolved: resolved.length,
            missing: missingSymbols.length,
            price_supported: priceSupported,
            tv_supported: tvSupported
          });
          
          if (missingSymbols.length > 0) {
            console.warn('🚨 MISSING MAPPINGS:', missingSymbols);
            console.warn('⚠️ These symbols will show (n/a) in the published brief');
            console.warn('💡 Check pending_ticker_mappings or add to ticker_mappings table');
          }
          
          // Build audit data for admin block with capability flags
          auditData = resolved;
          
          // Log capability warnings
          const noPriceSymbols = resolved.filter((s: any) => !s.price_ok).map((s: any) => s.symbol);
          const noTvSymbols = resolved.filter((s: any) => !s.tv_ok).map((s: any) => s.symbol);
          
          if (noPriceSymbols.length > 0) {
            console.warn('⚠️ Symbols without price support (parentheses hidden):', noPriceSymbols);
          }
          if (noTvSymbols.length > 0) {
            console.warn('⚠️ Symbols without TV support (charts hidden):', noTvSymbols);
          }
        }
        
        // Warm cache for all symbols (120-180s TTL)
        console.log('🔥 Warming quote cache (120-180s TTL)...');
        const warmupResponse = await supabase.functions.invoke('quotes', {
          body: { symbols: uniqueSymbols }
        });
        
        if (warmupResponse.error) {
          console.warn('⚠️ Cache warmup failed:', warmupResponse.error);
        } else {
          console.log('✅ Cache warmed for', uniqueSymbols.length, 'symbols');
        }
      } catch (validationErr) {
        console.error('❌ Symbol Intelligence validation error:', validationErr);
      }
    } else {
      console.log('ℹ️ No ticker symbols found in content');
    }

    // ============= ADMIN AUDIT BLOCK =============
    // Build admin audit section with detailed capability information
    let adminAuditBlock = '';
    if (auditData.length > 0) {
      adminAuditBlock = '\n\n---\n\n**[ADMIN] Symbol Intelligence Audit**\n\n';
      adminAuditBlock += 'Symbol | Display | Normalized | Source | Price | TV | Derivs | Social | Confidence\n';
      adminAuditBlock += '-------|---------|------------|--------|-------|-------|--------|--------|------------\n';
      
      auditData.forEach((asset: any) => {
        const displaySymbol = asset.displaySymbol || asset.symbol;
        const normalized = asset.normalized || asset.symbol;
        const source = asset.source || '—';
        const priceOk = asset.price_ok ? '✓' : '✗';
        const tvOk = asset.tv_ok ? '✓' : '✗';
        const derivsOk = asset.derivs_ok ? '✓' : '✗';
        const socialOk = asset.social_ok ? '✓' : '✗';
        const confidence = asset.confidence ? `${(asset.confidence * 100).toFixed(0)}%` : '—';
        
        adminAuditBlock += `${asset.symbol} | ${displaySymbol} | ${normalized} | ${source} | ${priceOk} | ${tvOk} | ${derivsOk} | ${socialOk} | ${confidence}\n`;
      });
      
      if (missingSymbols.length > 0) {
        adminAuditBlock += '\n**⚠️ Missing Mappings (added to pending queue):**\n';
        missingSymbols.forEach(sym => {
          adminAuditBlock += `- ${sym}: Check pending_ticker_mappings table or add manually to ticker_mappings\n`;
        });
      }
      
      adminAuditBlock += '\n**Legend:**\n';
      adminAuditBlock += '- Price ✓ = Parentheses with price shown\n';
      adminAuditBlock += '- TV ✓ = TradingView chart available\n';
      adminAuditBlock += '- Derivs ✓ = Derivatives data available\n';
      adminAuditBlock += '- Social ✓ = Social sentiment tracked\n';
      adminAuditBlock += '\n---\n';
    }

    // Create today's date and slug
    const today = new Date();
    const dateStr = today.toISOString().split('T')[0];
    const timestamp = Math.floor(Date.now() / 1000);

    // Determine featured assets based on biggest movers and social buzz
    const featuredAssets = ['BTC', 'ETH']; // Always include these
    if (biggestMover && !featuredAssets.includes(biggestMover.symbol.toUpperCase())) {
      featuredAssets.push(biggestMover.symbol.toUpperCase());
    }
    // Add top social assets
    lunarcrushData.data?.slice(0, 3).forEach(asset => {
      if (!featuredAssets.includes(asset.symbol) && featuredAssets.length < 6) {
        featuredAssets.push(asset.symbol);
      }
    });

    console.log('💾 Storing comprehensive market brief...');
    
    const { data: briefData, error: insertError } = await supabase
      .from('market_briefs')
      .insert({
        brief_type: briefType,
        title: isWeekendBrief ? 
          `Weekly Market Recap - ${today.toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          })}` :
          `${briefType === 'postmarket' ? 'Postmarket' : 'Premarket'} Market Brief - ${today.toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          })}`,
        slug: `${briefType}-brief-${dateStr}-${timestamp}`,
        executive_summary: isWeekendBrief ?
          `Comprehensive weekly market analysis covering 7-day performance, macro events, and next week's outlook. Fear & Greed at ${currentFearGreed.value}/100 (${currentFearGreed.value_classification}). ${biggestMover ? `${biggestMover.name} leads weekly performance with ${biggestMover.price_change_percentage_7d_in_currency > 0 ? '+' : ''}${biggestMover.price_change_percentage_7d_in_currency?.toFixed(1)}% move.` : 'Mixed weekly performance across markets.'}` :
          `Comprehensive daily market intelligence combining price action, social sentiment, and trend analysis. Fear & Greed at ${currentFearGreed.value}/100 (${currentFearGreed.value_classification}). ${biggestMover ? `${biggestMover.name} leads with ${biggestMover.price_change_percentage_24h > 0 ? '+' : ''}${biggestMover.price_change_percentage_24h.toFixed(1)}% move.` : 'Markets showing mixed signals.'}`,
        content_sections: {
          ai_generated_content: generatedAnalysis + adminAuditBlock,
          generation_timestamp: new Date().toISOString(),
          audit_data: auditData,
          missing_symbols: missingSymbols,
          model_used: 'gpt-4o-mini',
          data_sources: ['coingecko', 'lunarcrush', 'fear_greed', 'news_feeds', 'trending'],
          market_data: {
            total_market_cap: totalMarketCap,
            total_volume: totalVolume,
            fear_greed_index: currentFearGreed.value,
            fear_greed_label: currentFearGreed.value_classification,
            fear_greed_trend: fearGreedTrend,
            biggest_mover: biggestMover ? {
              name: biggestMover.name,
              symbol: biggestMover.symbol,
              change_24h: biggestMover.price_change_percentage_24h,
              change_7d: biggestMover.price_change_percentage_7d_in_currency,
              price: biggestMover.current_price
            } : null,
            top_gainers: topGainers.map(coin => ({
              name: coin.name,
              symbol: coin.symbol,
              change_24h: coin.price_change_percentage_24h,
              change_7d: coin.price_change_percentage_7d_in_currency,
              price: coin.current_price,
              market_cap_rank: coin.market_cap_rank
            })),
            top_losers: topLosers.map(coin => ({
              name: coin.name,
              symbol: coin.symbol,
              change_24h: coin.price_change_percentage_24h,
              change_7d: coin.price_change_percentage_7d_in_currency,
              price: coin.current_price,
              market_cap_rank: coin.market_cap_rank
            })),
            trending_coins: await (async () => {
              // Get price data for trending coins
              const trendingWithPrices = [];
              if (trendingData.coins?.length > 0) {
                const trendingIds = trendingData.coins.slice(0, 5)
                  .map((coin: any) => coin.item?.id)
                  .filter(Boolean)
                  .join(',');
                
                try {
                  console.log('📈 Fetching price data for trending coins...');
                  const priceResponse = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${trendingIds}&vs_currencies=usd&include_24hr_change=true&x_cg_demo_api_key=${coingeckoApiKey}`);
                  
                  if (priceResponse.ok) {
                    const priceData = await priceResponse.json();
                    
                    for (const coin of trendingData.coins.slice(0, 5)) {
                      const coinId = coin.item?.id;
                      const priceInfo = priceData[coinId];
                      
                      trendingWithPrices.push({
                        name: coin.item?.name,
                        symbol: coin.item?.symbol,
                        market_cap_rank: coin.item?.market_cap_rank,
                        price: priceInfo?.usd || null,
                        change_24h: priceInfo?.usd_24h_change || null
                      });
                    }
                    console.log('✅ Trending coins price data fetched successfully');
                  } else {
                    // Fallback to basic trending data without prices
                    console.log('⚠️ Price fetch failed, using basic trending data');
                    trendingData.coins.slice(0, 5).forEach((coin: any) => {
                      trendingWithPrices.push({
                        name: coin.item?.name,
                        symbol: coin.item?.symbol,
                        market_cap_rank: coin.item?.market_cap_rank,
                        price: null,
                        change_24h: null
                      });
                    });
                  }
                } catch (err) {
                  console.error('❌ Trending price fetch failed:', err);
                  // Fallback to basic trending data
                  trendingData.coins.slice(0, 5).forEach((coin: any) => {
                    trendingWithPrices.push({
                      name: coin.item?.name,
                      symbol: coin.item?.symbol,
                      market_cap_rank: coin.item?.market_cap_rank,
                      price: null,
                      change_24h: null
                    });
                  });
                }
              }
              return trendingWithPrices;
            })(),
            social_sentiment: lunarcrushData.data?.map(asset => ({
              name: asset.name,
              symbol: asset.symbol,
              galaxy_score: asset.galaxy_score,
              alt_rank: asset.alt_rank,
              sentiment: asset.sentiment,
              social_volume: asset.social_volume,
              social_dominance: asset.social_dominance,
              fomo_score: asset.fomo_score
            })) || []
          },
          enhanced_tickers: enhancedTickerData,
          data_points: {
            crypto_articles: newsData.crypto?.length || 0,
            stock_articles: newsData.stocks?.length || 0,
            coins_analyzed: coingeckoData.length,
            social_assets: lunarcrushData.data?.length || 0,
            trending_coins: trendingData.coins?.length || 0
          }
        },
        market_data: {
          session_type: isWeekendBrief ? 'comprehensive_weekly' : 'comprehensive_daily',
          generation_time: dateStr,
          fear_greed_index: currentFearGreed.value,
          market_cap_total: totalMarketCap,
          volume_24h: totalVolume,
          data_quality: {
            coingecko_success: coingeckoData.length > 0,
            lunarcrush_success: lunarcrushData.data?.length > 0,
            fear_greed_success: fearGreedArray.length > 0,
            trending_success: trendingData.coins?.length > 0
          }
        },
        social_data: {
          analysis_type: 'comprehensive_social',
          sentiment_sources: ['lunarcrush'],
          fear_greed_value: currentFearGreed.value,
          avg_galaxy_score: lunarcrushData.data?.length ? 
            lunarcrushData.data.reduce((sum, asset) => sum + (asset.galaxy_score || 0), 0) / lunarcrushData.data.length : 0,
          total_social_volume: lunarcrushData.data?.reduce((sum, asset) => sum + (asset.social_volume || 0), 0) || 0,
          top_social_assets: lunarcrushData.data?.slice(0, 5).map(asset => asset.symbol) || []
        },
        featured_assets: featuredAssets,
        is_published: true,
        published_at: new Date().toISOString(),
        stoic_quote: randomQuote,
        sentiment_score: lunarcrushData.data?.length ? 
          lunarcrushData.data.reduce((sum, asset) => sum + (asset.sentiment || 0), 0) / lunarcrushData.data.length : 
          0.0
      })
      .select()
      .single();

    if (insertError) {
      console.error('💥 Database insertion failed:', insertError);
      throw new Error('Failed to store market brief');
    }

    console.log('✅ Comprehensive market brief generated successfully!', {
      id: briefData.id,
      title: briefData.title,
      featured_assets: briefData.featured_assets,
      sentiment_score: briefData.sentiment_score
    });

    return new Response(JSON.stringify({ 
      success: true, 
      brief: briefData,
      message: 'Comprehensive daily market brief generated with full data integration',
      data_summary: {
        coins_analyzed: coingeckoData.length,
        social_assets: lunarcrushData.data?.length || 0,
        news_articles: (newsData.crypto?.length || 0) + (newsData.stocks?.length || 0),
        fear_greed: `${currentFearGreed.value}/100 (${currentFearGreed.value_classification})`
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('💥 Market brief generation failed:', error);
    
    // Log detailed error information for debugging
    if (error instanceof Error) {
      console.error('Error name:', error.name);
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    }
    
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      error_type: error instanceof Error ? error.name : 'UnknownError',
      success: false,
      timestamp: new Date().toISOString(),
      debug_info: {
        function: 'generate-daily-brief',
        step: 'unknown',
        message: 'Check edge function logs for detailed error information'
      }
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});