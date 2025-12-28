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

// Format for token_cards.top_news column
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

// Base topics that always get fetched
const BASE_TOPICS = ['crypto', 'stocks'];

function convertSentiment(score: number): 'positive' | 'negative' | 'neutral' {
  if (score >= 3.5) return 'positive';
  if (score <= 2.5) return 'negative';
  return 'neutral';
}

function convertSentimentToNumber(score: number): number {
  // Normalize LunarCrush 1-5 scale to 0-1
  return (score - 1) / 4;
}

async function fetchTopicNews(topic: string, apiKey: string): Promise<NewsItem[]> {
  try {
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
    return [];
  }
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
    const apiKey = Deno.env.get('LUNARCRUSH_API_KEY');
    if (!apiKey) {
      throw new Error('LUNARCRUSH_API_KEY not configured');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check cache first
    const { data: cachedData } = await supabase
      .from('cache_kv')
      .select('v, created_at')
      .eq('k', CACHE_KEY)
      .single();

    if (cachedData && cachedData.v) {
      const cacheAge = Date.now() - new Date(cachedData.created_at).getTime();
      if (cacheAge < CACHE_DURATION) {
        console.log('📦 Returning cached LunarCrush news');
        return new Response(JSON.stringify({ ...cachedData.v, cached: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Fetch top 10 tokens by market cap from token_cards
    console.log('🔍 Fetching top 10 tokens by market cap...');
    const { data: topTokens, error: tokenError } = await supabase
      .from('token_cards')
      .select('canonical_symbol, coingecko_id, name')
      .eq('is_active', true)
      .not('market_cap_rank', 'is', null)
      .order('market_cap_rank', { ascending: true })
      .limit(10);

    if (tokenError) {
      console.error('❌ Error fetching top tokens:', tokenError);
      throw tokenError;
    }

    console.log(`✅ Found ${topTokens?.length || 0} top tokens:`, topTokens?.map(t => t.canonical_symbol).join(', '));

    // Build topics: top 10 token symbols (lowercase) + base topics
    const tokenTopics = (topTokens || []).map(t => 
      (t.coingecko_id || t.canonical_symbol).toLowerCase()
    );
    const allTopics = [...tokenTopics, ...BASE_TOPICS];
    
    console.log(`🎯 Fetching news for ${allTopics.length} topics: ${allTopics.join(', ')}`);

    // Fetch news for all topics in parallel
    const newsPromises = allTopics.map(topic => fetchTopicNews(topic, apiKey));
    const allNewsArrays = await Promise.all(newsPromises);

    // Build a map of topic -> news for token updates
    const newsMap: Record<string, NewsItem[]> = {};
    allTopics.forEach((topic, idx) => {
      newsMap[topic] = allNewsArrays[idx];
    });

    // Update token_cards with news for each top token
    console.log('💾 Storing news in token_cards.top_news...');
    let tokensUpdated = 0;
    
    for (const token of (topTokens || [])) {
      const topicKey = (token.coingecko_id || token.canonical_symbol).toLowerCase();
      const tokenNews = newsMap[topicKey];
      
      if (tokenNews && tokenNews.length > 0) {
        const transformedNews = transformToTokenNews(tokenNews);
        
        const { error: updateError } = await supabase
          .from('token_cards')
          .update({
            top_news: transformedNews,
            top_news_count: tokenNews.length,
            news_updated_at: new Date().toISOString(),
          })
          .eq('canonical_symbol', token.canonical_symbol);

        if (updateError) {
          console.error(`❌ Error updating news for ${token.canonical_symbol}:`, updateError);
        } else {
          tokensUpdated++;
          console.log(`✅ Updated ${token.canonical_symbol} with ${transformedNews.length} news items`);
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

    // Sort by engagement
    const sortByEngagement = (a: NewsItem, b: NewsItem) => {
      const aEng = a.socialEngagement?.interactions24h || 0;
      const bEng = b.socialEngagement?.interactions24h || 0;
      return bEng - aEng;
    };

    cryptoNews.sort(sortByEngagement);
    stocksNews.sort(sortByEngagement);

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

    console.log(`✅ Cached ${allNews.length} LunarCrush news items, updated ${tokensUpdated} token cards`);

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
