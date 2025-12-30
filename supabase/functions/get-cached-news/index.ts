import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * READ-ONLY NEWS CACHE FUNCTION
 * 
 * This function ONLY reads from cache_kv - it makes ZERO external API calls.
 * News is populated by cron jobs:
 * - news-fetch: Polygon + RSS (runs every 15 min at :08,:23,:38,:53)
 * - lunarcrush-news: LunarCrush social news (runs every 30 min at :12,:42)
 * 
 * Frontend calls this function to get cached news - never triggers API calls.
 */

interface NewsItem {
  title: string;
  description: string;
  url: string;
  publishedAt: string;
  source: string;
  sourceType?: string;
  sentiment?: 'positive' | 'negative' | 'neutral';
  sentimentReasoning?: string;
  tickers?: string[];
  keywords?: string[];
  imageUrl?: string;
  author?: string;
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

const NEWS_FETCH_CACHE_KEY = 'news_cache';
const LUNARCRUSH_CACHE_KEY = 'lunarcrush_news_cache';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('📰 get-cached-news: Reading from cache only (no API calls)');

    // Read both caches in parallel
    const [newsFetchResult, lunarCrushResult] = await Promise.all([
      supabase
        .from('cache_kv')
        .select('v, expires_at')
        .eq('k', NEWS_FETCH_CACHE_KEY)
        .single(),
      supabase
        .from('cache_kv')
        .select('v, expires_at')
        .eq('k', LUNARCRUSH_CACHE_KEY)
        .single(),
    ]);

    const newsFetchData = newsFetchResult.data?.v as { crypto?: NewsItem[]; stocks?: NewsItem[]; trump?: NewsItem[] } | null;
    const lunarCrushData = lunarCrushResult.data?.v as { crypto?: NewsItem[]; stocks?: NewsItem[] } | null;

    // Log cache status
    const newsFetchAge = newsFetchResult.data?.expires_at 
      ? new Date(newsFetchResult.data.expires_at) > new Date() ? 'valid' : 'expired'
      : 'missing';
    const lunarCrushAge = lunarCrushResult.data?.expires_at
      ? new Date(lunarCrushResult.data.expires_at) > new Date() ? 'valid' : 'expired'
      : 'missing';

    console.log(`📦 Cache status - news_fetch: ${newsFetchAge}, lunarcrush: ${lunarCrushAge}`);

    // Get arrays from caches (empty if missing)
    const polygonCrypto: NewsItem[] = newsFetchData?.crypto || [];
    const polygonStocks: NewsItem[] = newsFetchData?.stocks || [];
    const trumpNews: NewsItem[] = newsFetchData?.trump || [];
    
    const lcCrypto: NewsItem[] = lunarCrushData?.crypto || [];
    const lcStocks: NewsItem[] = lunarCrushData?.stocks || [];

    // Merge news sources: deduplicate by URL, prioritize LunarCrush (has social engagement)
    const mergeNewsSources = (polygon: NewsItem[], lunarcrush: NewsItem[]): NewsItem[] => {
      const urlSet = new Set(lunarcrush.map(item => item.url?.toLowerCase()));
      const uniquePolygon = polygon.filter(item => !urlSet.has(item.url?.toLowerCase()));
      // LunarCrush items first (have social engagement), then Polygon
      return [...lunarcrush, ...uniquePolygon];
    };

    const mergedCrypto = mergeNewsSources(polygonCrypto, lcCrypto);
    const mergedStocks = mergeNewsSources(polygonStocks, lcStocks);

    // Sort by publishedAt desc
    mergedCrypto.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
    mergedStocks.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());

    console.log(`✅ Returning merged news: ${mergedCrypto.length} crypto, ${mergedStocks.length} stocks, ${trumpNews.length} trump`);

    return new Response(JSON.stringify({
      crypto: mergedCrypto.slice(0, 50),
      stocks: mergedStocks.slice(0, 50),
      trump: trumpNews.slice(0, 50),
      metadata: {
        source: 'cache_only',
        news_fetch_cache: newsFetchAge,
        lunarcrush_cache: lunarCrushAge,
        api_calls_made: 0,
      },
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('❌ get-cached-news error:', error);
    return new Response(
      JSON.stringify({
        error: error.message,
        crypto: [],
        stocks: [],
        trump: [],
        metadata: { source: 'error', api_calls_made: 0 },
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
