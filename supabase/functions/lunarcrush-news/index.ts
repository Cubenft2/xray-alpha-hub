import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';
import { 
  LunarCrushNewsPostSchema,
  safeParseArray,
  type LunarCrushNewsPost 
} from "../_shared/validation-schemas.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface NewsItem {
  title: string;
  description: string;
  url: string;
  publishedAt: string;
  source: string;
  sourceType: string;
  sentiment?: 'positive' | 'negative' | 'neutral';
  imageUrl?: string;
  socialEngagement?: {
    interactions24h: number;
    interactionsTotal: number;
    creatorFollowers: number;
    creatorName: string;
    creatorDisplayName?: string;
    creatorAvatar?: string;
    postSentiment: number;
  };
}

// Format for token_cards.lc_top_news column
interface TokenNewsItem {
  title: string;
  url?: string;
  source?: string;
  published_at?: string;
  sentiment?: number;
  image_url?: string;
  social_engagement?: {
    interactions_24h: number;
    creator_name: string;
    post_sentiment: number;
  };
}

const CACHE_KEY = 'lunarcrush_news_cache';
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes
const THROTTLE_DELAY_MS = 7000; // 7 seconds between API calls to stay under 10 calls/min burst limit

// Reduced topics: top 4 tokens + crypto + stocks = 6 topics
const BASE_TOPICS = ['crypto', 'stocks'];
const MAX_TOKEN_TOPICS = 4;

function convertSentiment(score: number): 'positive' | 'negative' | 'neutral' {
  if (score >= 3.5) return 'positive';
  if (score <= 2.5) return 'negative';
  return 'neutral';
}

function convertSentimentToNumber(score: number): number {
  // Normalize LunarCrush 1-5 scale to 0-1
  return (score - 1) / 4;
}

// Throttled delay helper
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Log API call to external_api_calls table
async function logApiCall(
  supabase: ReturnType<typeof createClient>,
  functionName: string,
  apiName: string,
  success: boolean,
  errorMessage?: string,
  callCount: number = 1
): Promise<void> {
  try {
    await supabase.from('external_api_calls').insert({
      function_name: functionName,
      api_name: apiName,
      success,
      error_message: errorMessage || null,
      call_count: callCount,
    });
  } catch (err) {
    console.error('Failed to log API call:', err);
  }
}

async function fetchTopicNewsWithRetry(
  topic: string, 
  apiKey: string,
  supabase: ReturnType<typeof createClient>,
  maxRetries: number = 2
): Promise<NewsItem[]> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      if (attempt > 0) {
        // Exponential backoff on retry
        const backoffMs = Math.min(1000 * Math.pow(2, attempt), 5000);
        console.log(`⏳ Retry ${attempt}/${maxRetries} for topic "${topic}" after ${backoffMs}ms`);
        await delay(backoffMs);
      }
      
      console.log(`📰 Fetching LunarCrush news for topic: ${topic}`);
      
      const response = await fetch(
        `https://lunarcrush.com/api4/public/topic/${topic}/news/v1`,
        {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      // Log the API call
      await logApiCall(
        supabase,
        'lunarcrush-news',
        'lunarcrush',
        response.ok,
        response.ok ? undefined : `HTTP ${response.status}`
      );

      if (response.status === 429) {
        console.warn(`⚠️ Rate limited (429) for topic "${topic}", will retry...`);
        lastError = new Error('Rate limited');
        continue; // retry
      }

      if (!response.ok) {
        console.error(`❌ LunarCrush API error for ${topic}: ${response.status}`);
        return [];
      }

      const result = await response.json();
      const rawPosts = result.data || [];
      
      // Validate with Zod - skip invalid posts
      const posts = safeParseArray(LunarCrushNewsPostSchema, rawPosts, `lunarcrush-news/${topic}`);
      
      console.log(`✅ Validated ${posts.length}/${rawPosts.length} news items for ${topic}`);

      return posts.map((post): NewsItem => ({
        title: post.post_title,
        description: post.post_title,
        url: post.post_link,
        publishedAt: new Date(post.post_created * 1000).toISOString(),
        source: post.creator_display_name || post.creator_name,
        sourceType: 'lunarcrush',
        sentiment: convertSentiment(post.post_sentiment),
        imageUrl: post.post_image,
        socialEngagement: {
          interactions24h: post.interactions_24h,
          interactionsTotal: post.interactions_total,
          creatorFollowers: post.creator_followers,
          creatorName: post.creator_name,
          creatorDisplayName: post.creator_display_name,
          creatorAvatar: post.creator_avatar,
          postSentiment: post.post_sentiment,
        },
      }));
    } catch (error) {
      console.error(`❌ Error fetching LunarCrush news for ${topic}:`, error);
      lastError = error as Error;
    }
  }
  
  console.error(`❌ All retries exhausted for topic "${topic}"`);
  return [];
}

function transformToTokenNews(newsItems: NewsItem[]): TokenNewsItem[] {
  return newsItems.slice(0, 10).map(item => ({
    title: item.title,
    url: item.url,
    source: item.source,
    published_at: item.publishedAt,
    sentiment: item.socialEngagement ? convertSentimentToNumber(item.socialEngagement.postSentiment) : undefined,
    image_url: item.imageUrl,
    social_engagement: item.socialEngagement ? {
      interactions_24h: item.socialEngagement.interactions24h,
      creator_name: item.socialEngagement.creatorName,
      post_sentiment: item.socialEngagement.postSentiment,
    } : undefined,
  }));
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Parse request body for cronSecret
    const body = await req.json().catch(() => ({}));
    const cronSecret = Deno.env.get('CRON_SECRET');

    // Check cache first using expires_at (not created_at which never updates on upsert!)
    const { data: cachedData } = await supabase
      .from('cache_kv')
      .select('v, expires_at')
      .eq('k', CACHE_KEY)
      .single();

    // CRON_SECRET check: Non-cron requests only return cached data, never refresh
    const isCronAuthorized = cronSecret && body.cronSecret === cronSecret;
    
    if (!isCronAuthorized) {
      console.log('📦 Non-cron request - returning cache only (no API refresh)');
      if (cachedData?.v) {
        return new Response(JSON.stringify({ 
          ...cachedData.v, 
          cached: true,
          message: 'Cache-only response (cron refresh required)',
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      // No cache exists - return empty (cron will populate it)
      return new Response(JSON.stringify({
        crypto: [],
        stocks: [],
        metadata: { cached: true, message: 'Cache empty - awaiting cron refresh' },
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Cron-authorized request: check if cache is still valid
    if (cachedData?.v && cachedData.expires_at) {
      const expiresAt = new Date(cachedData.expires_at);
      if (expiresAt > new Date()) {
        console.log('📦 Cache still valid (expires_at in future), returning cached');
        return new Response(JSON.stringify({ ...cachedData.v, cached: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Cache expired or missing - proceed with API refresh
    console.log('🔄 Cron-authorized refresh: cache expired, fetching from LunarCrush API');

    const apiKey = Deno.env.get('LUNARCRUSH_API_KEY');
    if (!apiKey) {
      throw new Error('LUNARCRUSH_API_KEY not configured');
    }

    // Fetch top tokens by market cap from token_cards (reduced to MAX_TOKEN_TOPICS)
    console.log(`🔍 Fetching top ${MAX_TOKEN_TOPICS} tokens by market cap...`);
    const { data: topTokens, error: tokenError } = await supabase
      .from('token_cards')
      .select('canonical_symbol, coingecko_id, name')
      .eq('is_active', true)
      .not('market_cap_rank', 'is', null)
      .order('market_cap_rank', { ascending: true })
      .limit(MAX_TOKEN_TOPICS);

    if (tokenError) {
      console.error('❌ Error fetching top tokens:', tokenError);
      throw tokenError;
    }

    console.log(`✅ Found ${topTokens?.length || 0} top tokens:`, topTokens?.map(t => t.canonical_symbol).join(', '));

    // Build topics: top N token symbols (lowercase) + base topics
    const tokenTopics = (topTokens || []).map(t => 
      (t.coingecko_id || t.canonical_symbol).toLowerCase()
    );
    const allTopics = [...tokenTopics, ...BASE_TOPICS];
    
    console.log(`🎯 Fetching news for ${allTopics.length} topics SEQUENTIALLY with ${THROTTLE_DELAY_MS}ms throttle: ${allTopics.join(', ')}`);

    // Fetch news for all topics SEQUENTIALLY with throttling to prevent burst rate limiting
    const newsMap: Record<string, NewsItem[]> = {};
    const allNewsArrays: NewsItem[][] = [];
    
    for (const topic of allTopics) {
      const news = await fetchTopicNewsWithRetry(topic, apiKey, supabase);
      newsMap[topic] = news;
      allNewsArrays.push(news);
      
      // Throttle between calls to prevent burst rate limiting
      await delay(THROTTLE_DELAY_MS);
    }

    // Update token_cards with news for each top token - write to lc_top_news column
    console.log('💾 Storing news in token_cards.lc_top_news...');
    let tokensUpdated = 0;
    
    for (const token of (topTokens || [])) {
      const topicKey = (token.coingecko_id || token.canonical_symbol).toLowerCase();
      const tokenNews = newsMap[topicKey];
      
      if (tokenNews && tokenNews.length > 0) {
        const transformedNews = transformToTokenNews(tokenNews);
        
        const { error: updateError } = await supabase
          .from('token_cards')
          .update({
            lc_top_news: transformedNews,
            lc_news_updated_at: new Date().toISOString(),
            news_source: 'lunarcrush',
          })
          .eq('canonical_symbol', token.canonical_symbol);

        if (updateError) {
          console.error(`❌ Error updating lc_top_news for ${token.canonical_symbol}:`, updateError);
        } else {
          tokensUpdated++;
          console.log(`✅ Updated ${token.canonical_symbol} lc_top_news with ${transformedNews.length} items`);
        }
      }
    }

    // Flatten all news for general response
    const allNews = allNewsArrays.flat();
    
    // Separate crypto (token topics + 'crypto') from stocks
    const cryptoTopicsSet = new Set([...tokenTopics, 'crypto']);
    const cryptoNews: NewsItem[] = [];
    const stocksNews: NewsItem[] = [];
    
    allTopics.forEach((topic, idx) => {
      if (cryptoTopicsSet.has(topic)) {
        cryptoNews.push(...allNewsArrays[idx]);
      } else if (topic === 'stocks') {
        stocksNews.push(...allNewsArrays[idx]);
      }
    });

    // Hybrid sort: balance freshness and engagement with time decay
    // Fresh articles need less engagement to rank high; older articles need more
    const sortByFreshnessAndEngagement = (a: NewsItem, b: NewsItem) => {
      const now = Date.now();
      
      // Age in hours
      const aAgeHours = (now - new Date(a.publishedAt).getTime()) / (1000 * 60 * 60);
      const bAgeHours = (now - new Date(b.publishedAt).getTime()) / (1000 * 60 * 60);
      
      // Engagement score
      const aEng = a.socialEngagement?.interactions24h || 0;
      const bEng = b.socialEngagement?.interactions24h || 0;
      
      // Time decay: articles lose 50% score per hour
      // A 1-hour-old article needs 2x engagement to beat a fresh one
      const decayFactor = 0.5;
      const aScore = aEng * Math.pow(decayFactor, aAgeHours);
      const bScore = bEng * Math.pow(decayFactor, bAgeHours);
      
      // Freshness boost: articles < 30 min old get 2x boost
      const freshnessBoost = (ageHours: number) => ageHours < 0.5 ? 2 : 1;
      const aFinalScore = aScore * freshnessBoost(aAgeHours);
      const bFinalScore = bScore * freshnessBoost(bAgeHours);
      
      return bFinalScore - aFinalScore;
    };

    cryptoNews.sort(sortByFreshnessAndEngagement);
    stocksNews.sort(sortByFreshnessAndEngagement);

    // Calculate metadata
    const totalInteractions = allNews.reduce(
      (sum, item) => sum + (item.socialEngagement?.interactions24h || 0),
      0
    );
    const avgSentiment = allNews.reduce(
      (sum, item) => sum + (item.socialEngagement?.postSentiment || 3),
      0
    ) / (allNews.length || 1);

    const response = {
      crypto: cryptoNews.slice(0, 50),
      stocks: stocksNews.slice(0, 50),
      metadata: {
        total_interactions: totalInteractions,
        avg_sentiment: avgSentiment,
        total_items: allNews.length,
        topics_fetched: allTopics.length,
        tokens_updated: tokensUpdated,
        api_calls_made: allTopics.length,
        cached: false,
      },
    };

    // Update cache
    await supabase
      .from('cache_kv')
      .upsert({
        k: CACHE_KEY,
        v: response,
        expires_at: new Date(Date.now() + CACHE_DURATION).toISOString(),
      });

    console.log(`✅ Cached ${allNews.length} LunarCrush news items, updated ${tokensUpdated} token cards, made ${allTopics.length} API calls`);

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('❌ LunarCrush news function error:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        crypto: [],
        stocks: [],
        metadata: { cached: false }
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
