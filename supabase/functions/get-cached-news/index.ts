import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * READ-ONLY NEWS CACHE FUNCTION
 * 
 * This function ONLY reads from cache_kv - it makes ZERO external API calls.
 * News is populated by ONE unified cron job:
 * - polygon-news-unified: Fetches from Polygon, populates cache + token_cards + stock_cards
 * - lunarcrush-news: LunarCrush social news (runs every 30 min at :12,:42)
 * 
 * Frontend calls this function to get cached news - never triggers API calls.
 */

interface NewsItem {
  title: string;
  description?: string;
  url: string;
  publishedAt?: string;
  published_at?: string;
  source: string;
  sourceType?: string;
  sentiment?: 'positive' | 'negative' | 'neutral' | string;
  sentimentReasoning?: string;
  tickers?: string[];
  keywords?: string[];
  imageUrl?: string;
  image_url?: string;
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

// Unified cache key from polygon-news-unified
const POLYGON_UNIFIED_CACHE_KEY = 'polygon_news_unified_cache';
const LUNARCRUSH_CACHE_KEY = 'lunarcrush_news_cache';

// Normalize news items to consistent format
const normalizeNewsItem = (item: NewsItem, defaultSourceType?: string): NewsItem => ({
  ...item,
  publishedAt: item.publishedAt || item.published_at,
  imageUrl: item.imageUrl || item.image_url,
  sourceType: item.sourceType || defaultSourceType,
});

// Canonicalize URL for deduplication
const canonicalizeUrl = (url: string): string => {
  try {
    const u = new URL(url);
    // Remove common tracking params
    u.searchParams.delete('utm_source');
    u.searchParams.delete('utm_medium');
    u.searchParams.delete('utm_campaign');
    u.searchParams.delete('ref');
    // Lowercase and remove trailing slash
    return u.toString().toLowerCase().replace(/\/$/, '');
  } catch {
    return (url || '').toLowerCase().trim();
  }
};

// Dedupe array of news items by URL
const dedupeByUrl = (items: NewsItem[]): NewsItem[] => {
  const seen = new Set<string>();
  return items.filter(item => {
    const key = canonicalizeUrl(item.url);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

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
    const [polygonResult, lunarCrushResult] = await Promise.all([
      supabase
        .from('cache_kv')
        .select('v, expires_at, created_at')
        .eq('k', POLYGON_UNIFIED_CACHE_KEY)
        .single(),
      supabase
        .from('cache_kv')
        .select('v, expires_at, created_at')
        .eq('k', LUNARCRUSH_CACHE_KEY)
        .single(),
    ]);

    const polygonData = polygonResult.data?.v as { 
      crypto?: NewsItem[]; 
      stocks?: NewsItem[]; 
      trump?: NewsItem[];
      fetched_at?: string;
      articles_count?: number;
    } | null;
    
    const lunarCrushData = lunarCrushResult.data?.v as { 
      crypto?: NewsItem[]; 
      stocks?: NewsItem[] 
    } | null;

    // Log cache status
    const polygonAge = polygonResult.data?.expires_at 
      ? new Date(polygonResult.data.expires_at) > new Date() ? 'valid' : 'expired'
      : 'missing';
    const lunarCrushAge = lunarCrushResult.data?.expires_at
      ? new Date(lunarCrushResult.data.expires_at) > new Date() ? 'valid' : 'expired'
      : 'missing';

    console.log(`📦 Cache status - polygon_unified: ${polygonAge}, lunarcrush: ${lunarCrushAge}`);

    // Get arrays from caches (empty if missing)
    // Force sourceType: 'polygon' on Polygon items (fallback for older cache entries)
    const polygonCrypto: NewsItem[] = dedupeByUrl(
      (polygonData?.crypto || []).map(item => normalizeNewsItem(item, 'polygon'))
    );
    const polygonStocks: NewsItem[] = dedupeByUrl(
      (polygonData?.stocks || []).map(item => normalizeNewsItem(item, 'polygon'))
    );
    const trumpNews: NewsItem[] = dedupeByUrl(
      (polygonData?.trump || []).map(item => normalizeNewsItem(item, 'polygon'))
    );
    
    // LunarCrush items keep their sourceType (usually 'lunarcrush' or social)
    const lcCrypto: NewsItem[] = dedupeByUrl(
      (lunarCrushData?.crypto || []).map(item => normalizeNewsItem(item))
    );
    const lcStocks: NewsItem[] = dedupeByUrl(
      (lunarCrushData?.stocks || []).map(item => normalizeNewsItem(item))
    );

    // Merge news sources: deduplicate by URL, prioritize LunarCrush (has social engagement)
    const mergeNewsSources = (polygon: NewsItem[], lunarcrush: NewsItem[]): NewsItem[] => {
      const urlSet = new Set(lunarcrush.map(item => canonicalizeUrl(item.url)));
      const uniquePolygon = polygon.filter(item => !urlSet.has(canonicalizeUrl(item.url)));
      // LunarCrush items first (have social engagement), then Polygon
      // Final dedupe to be safe
      return dedupeByUrl([...lunarcrush, ...uniquePolygon]);
    };

    const mergedCrypto = mergeNewsSources(polygonCrypto, lcCrypto);
    const mergedStocks = mergeNewsSources(polygonStocks, lcStocks);

    // Sort by publishedAt desc
    const sortByDate = (items: NewsItem[]) => 
      items.sort((a, b) => {
        const dateA = new Date(a.publishedAt || 0).getTime();
        const dateB = new Date(b.publishedAt || 0).getTime();
        return dateB - dateA;
      });

    sortByDate(mergedCrypto);
    sortByDate(mergedStocks);
    sortByDate(trumpNews);

    console.log(`✅ Returning merged news: ${mergedCrypto.length} crypto, ${mergedStocks.length} stocks, ${trumpNews.length} trump`);

    return new Response(JSON.stringify({
      crypto: mergedCrypto.slice(0, 50),
      stocks: mergedStocks.slice(0, 50),
      trump: trumpNews.slice(0, 50),
      metadata: {
        source: 'cache_only',
        polygon_unified_cache: polygonAge,
        polygon_fetched_at: polygonData?.fetched_at,
        polygon_articles_count: polygonData?.articles_count,
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
