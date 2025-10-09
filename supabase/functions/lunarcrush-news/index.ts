import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface LunarCrushNewsPost {
  id: string;
  post_type: string;
  post_title: string;
  post_link: string;
  post_image?: string;
  post_created: number;
  post_sentiment: number;
  creator_id: string;
  creator_name: string;
  creator_display_name?: string;
  creator_followers: number;
  creator_avatar?: string;
  interactions_24h: number;
  interactions_total: number;
}

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

const CACHE_KEY = 'lunarcrush_news_cache';
const CACHE_DURATION = 15 * 60 * 1000; // 15 minutes

const TOPICS = ['bitcoin', 'ethereum', 'solana', 'crypto', 'stocks'];

function convertSentiment(score: number): 'positive' | 'negative' | 'neutral' {
  if (score >= 3.5) return 'positive';
  if (score <= 2.5) return 'negative';
  return 'neutral';
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
    const posts: LunarCrushNewsPost[] = result.data || [];
    
    console.log(`✅ Got ${posts.length} news items for ${topic}`);

    return posts.map((post): NewsItem => ({
      title: post.post_title,
      description: post.post_title, // LunarCrush doesn't provide description
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

    // Check cache
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

    // Fetch news for all topics in parallel
    console.log('🔄 Fetching fresh LunarCrush news for all topics...');
    const newsPromises = TOPICS.map(topic => fetchTopicNews(topic, apiKey));
    const allNewsArrays = await Promise.all(newsPromises);

    // Flatten and categorize
    const allNews = allNewsArrays.flat();
    
    // Categorize by topic (crypto vs stocks)
    const cryptoNews = allNews.filter((_, idx) => 
      Math.floor(idx / (allNews.length / TOPICS.length)) < 4 // First 4 topics are crypto
    );
    
    const stocksNews = allNews.filter((_, idx) => 
      Math.floor(idx / (allNews.length / TOPICS.length)) === 4 // Last topic is stocks
    );

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

    console.log(`✅ Cached ${allNews.length} LunarCrush news items`);

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
