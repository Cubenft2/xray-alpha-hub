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
const lunarcrushApiKey = Deno.env.get('LUNARCRUSH_API_KEY')!

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('📊 Fetching comprehensive market data...');
    
    // Fetch multiple data sources in parallel
    const [newsResponse, coingeckoResponse, lunarcrushResponse, fearGreedResponse] = await Promise.allSettled([
      // News data
      supabase.functions.invoke('news-fetch', { body: { limit: 50 } }),
      
      // CoinGecko: Top coins with price changes
      fetch(`https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=25&page=1&price_change_percentage=24h,7d&x_cg_demo_api_key=${coingeckoApiKey}`),
      
      // LunarCrush: Social sentiment for top assets
      fetch(`https://api.lunarcrush.com/v2?data=assets&key=${lunarcrushApiKey}&symbol=BTC,ETH,SOL,ADA,DOGE,MATIC,LINK,UNI,AVAX,ATOM&interval=24h&data_points=1`),
      
      // Fear & Greed Index
      fetch('https://api.alternative.me/fng/?limit=1')
    ]);

    // Process results
    const newsData = newsResponse.status === 'fulfilled' && !newsResponse.value.error 
      ? newsResponse.value.data : { crypto: [], stocks: [] };
    
    const coingeckoData = coingeckoResponse.status === 'fulfilled' && coingeckoResponse.value.ok
      ? await coingeckoResponse.value.json() : [];
    
    const lunarcrushData = lunarcrushResponse.status === 'fulfilled' && lunarcrushResponse.value.ok
      ? await lunarcrushResponse.value.json() : { data: [] };
    
    const fearGreedData = fearGreedResponse.status === 'fulfilled' && fearGreedResponse.value.ok
      ? await fearGreedResponse.value.json() : { data: [{ value: 50, value_classification: 'Neutral' }] };

    console.log('📈 Market data fetched successfully:', {
      newsCount: (newsData.crypto?.length || 0) + (newsData.stocks?.length || 0),
      coinsCount: coingeckoData.length,
      sentimentCount: lunarcrushData.data?.length || 0,
      fearGreed: fearGreedData.data?.[0]?.value
    });

    // Analyze market data for key insights
    const topGainersLosers = (coingeckoData as any[])
      .filter((coin: any) => coin.price_change_percentage_24h !== null)
      .sort((a: any, b: any) => Math.abs(b.price_change_percentage_24h) - Math.abs(a.price_change_percentage_24h))
      .slice(0, 10);

    const topGainers = (coingeckoData as any[])
      .filter((coin: any) => coin.price_change_percentage_24h > 0)
      .sort((a: any, b: any) => b.price_change_percentage_24h - a.price_change_percentage_24h)
      .slice(0, 5);

    const topLosers = (coingeckoData as any[])
      .filter((coin: any) => coin.price_change_percentage_24h < 0)
      .sort((a: any, b: any) => a.price_change_percentage_24h - b.price_change_percentage_24h)
      .slice(0, 5);

    const fearGreedValue = fearGreedData.data?.[0]?.value || 50;
    const fearGreedLabel = fearGreedData.data?.[0]?.value_classification || 'Neutral';

    // Get some stoic quotes for rotation
    const stoicQuotes = [
      "In the market's storms, the wise captain doesn't fight the waves—they navigate through them.",
      "The best time to plant a tree was 20 years ago. The second best time is now.",
      "It is not the man who has too little, but the man who craves more, who is poor.",
      "Wealth consists not in having great possessions, but in having few wants.",
      "The happiness of your life depends upon the quality of your thoughts.",
      "Very little is needed to make a happy life; it is all within yourself, in your way of thinking."
    ];
    const randomQuote = stoicQuotes[Math.floor(Math.random() * stoicQuotes.length)];

    // Enhanced AI analysis prompt with comprehensive market data
    const marketAnalysisPrompt = `You are XRayCrypto, an experienced trader with American-Latino identity and global traveler vibes. Create a daily market brief that feels like a smart friend talking through important market moves. Use a sharp, plain-spoken voice with hints of humor and fishing/travel metaphors.

**REQUIRED STRUCTURE:**
Start with: "Let's talk about something."

Then create sections covering:
1. **Data-Driven Hook** - Lead with the biggest market move/surprise backed by numbers
2. **Context & Multi-Asset View** - Connect events to broader crypto and macro themes  
3. **Top Movers Analysis** - Discuss significant gainers and losers
4. **Social & Sentiment Insights** - Weave in social metrics and crowd behavior
5. **What's Next** - Preview upcoming catalysts and things to watch

**MARKET DATA TO ANALYZE:**

**Fear & Greed Index:** ${fearGreedValue}/100 (${fearGreedLabel})

**Top Market Cap Coins Performance:**
${(coingeckoData as any[]).slice(0, 10).map((coin: any) => 
  `${coin.name} (${coin.symbol.toUpperCase()}): $${coin.current_price?.toFixed(2)} | 24h: ${coin.price_change_percentage_24h?.toFixed(2)}% | 7d: ${coin.price_change_percentage_7d_in_currency?.toFixed(2)}% | Vol: $${(coin.total_volume / 1e9)?.toFixed(2)}B`
).join('\n')}

**Top Gainers (24h):**
${topGainers.map((coin: any) => 
  `${coin.name}: +${coin.price_change_percentage_24h?.toFixed(2)}%`
).join(', ')}

**Top Losers (24h):**
${topLosers.map((coin: any) => 
  `${coin.name}: ${coin.price_change_percentage_24h?.toFixed(2)}%`
).join(', ')}

**Social Sentiment Data:**
${(lunarcrushData as any).data?.slice(0, 5).map((asset: any) => 
  `${asset.name}: Galaxy Score ${asset.galaxy_score}/100 | Social Volume: ${asset.social_volume} | Sentiment: ${asset.sentiment?.toFixed(2)}`
).join('\n') || 'Social data unavailable'}

**Latest News Headlines:**
Crypto: ${(newsData as any).crypto?.slice(0, 5).map((item: any) => item.title).join(' | ') || 'No crypto news'}
Stocks: ${(newsData as any).stocks?.slice(0, 5).map((item: any) => item.title).join(' | ') || 'No stock news'}

**STYLE GUIDELINES:**
- Keep it conversational and engaging, like talking to a smart friend
- Use fishing/ocean metaphors naturally (don't force them)
- Be data-driven but accessible - explain what the numbers mean
- Include specific price moves, percentages, and volume data
- Don't be overly bullish or bearish - stay balanced
- Add personality and light humor where appropriate
- Focus on actionable insights for traders and investors

Write a comprehensive brief that's informative yet entertaining, backed by the real market data provided.`;

    console.log('Generating AI analysis...');
    
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
            content: 'You are a professional financial analyst creating daily market briefs. Be concise, accurate, and focus on actionable insights.'
          },
          { role: 'user', content: marketAnalysisPrompt }
        ],
        max_tokens: 1500,
        temperature: 0.7
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const aiData = await response.json();
    const generatedAnalysis = aiData.choices[0].message.content;

    // Create today's date string
    const today = new Date();
    const dateStr = today.toISOString().split('T')[0];
    const timestamp = Math.floor(Date.now() / 1000);

    // Insert market brief into database
    console.log('💾 Inserting comprehensive market brief into database...');
    
    const { data: briefData, error: insertError } = await supabase
      .from('market_briefs')
      .insert({
        brief_type: 'daily',
        title: `Daily Market Brief - ${today.toLocaleDateString('en-US', { 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric' 
        })}`,
        slug: `daily-market-brief-${dateStr}-${timestamp}`,
        executive_summary: 'Comprehensive daily analysis of market trends, key developments, and trading opportunities across crypto and traditional markets.',
        content_sections: {
          ai_generated_content: generatedAnalysis,
          generation_timestamp: new Date().toISOString(),
          model_used: 'gpt-4o-mini',
          news_sources: ['crypto_feeds', 'stock_feeds', 'coingecko', 'lunarcrush'],
          data_points: {
            crypto_articles: newsData.crypto?.length || 0,
            stock_articles: newsData.stocks?.length || 0,
            coins_analyzed: coingeckoData.length,
            social_assets: lunarcrushData.data?.length || 0
          },
          market_data: {
            fear_greed_index: fearGreedValue,
            fear_greed_label: fearGreedLabel,
            top_gainers: topGainers.slice(0, 3).map((coin: any) => ({
              name: coin.name,
              symbol: coin.symbol,
              change_24h: coin.price_change_percentage_24h,
              price: coin.current_price
            })),
            top_losers: topLosers.slice(0, 3).map((coin: any) => ({
              name: coin.name,
              symbol: coin.symbol,
              change_24h: coin.price_change_percentage_24h,
              price: coin.current_price
            })),
            social_sentiment: lunarcrushData.data?.slice(0, 5).map((asset: any) => ({
              name: asset.name,
              symbol: asset.symbol,
              galaxy_score: asset.galaxy_score,
              sentiment: asset.sentiment,
              social_volume: asset.social_volume
            })) || []
          }
        },
        market_data: {
          session_type: 'daily_analysis',
          generation_time: dateStr,
          fear_greed_index: fearGreedValue,
          top_movers_count: topGainersLosers.length,
          data_sources: ['coingecko', 'lunarcrush', 'fear_greed', 'news_feeds']
        },
        social_data: {
          analysis_type: 'comprehensive',
          sentiment_sources: ['lunarcrush'],
          fear_greed_value: fearGreedValue,
          social_volume_total: lunarcrushData.data?.reduce((sum: number, asset: any) => sum + (asset.social_volume || 0), 0) || 0,
          top_social_assets: lunarcrushData.data?.slice(0, 3).map((asset: any) => asset.symbol) || []
        },
        featured_assets: ['BTC', 'ETH', 'SOL'].concat(
          topGainers.slice(0, 2).map((coin: any) => coin.symbol.toUpperCase())
        ),
        is_published: true,
        published_at: new Date().toISOString(),
        stoic_quote: randomQuote,
        sentiment_score: lunarcrushData.data?.length ? 
          lunarcrushData.data.reduce((sum: number, asset: any) => sum + (asset.sentiment || 0), 0) / lunarcrushData.data.length : 
          0.0
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error inserting brief:', insertError);
      throw new Error('Failed to create market brief');
    }

    console.log('Market brief created successfully:', briefData);

    return new Response(JSON.stringify({ 
      success: true, 
      brief: briefData,
      message: 'Daily market brief generated successfully'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error generating daily brief:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      success: false
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});