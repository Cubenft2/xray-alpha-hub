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

// Cache keys for all news sources
const POLYGON_UNIFIED_CACHE_KEY = 'polygon_news_unified_cache';
const LUNARCRUSH_CACHE_KEY = 'lunarcrush_news_cache';
const RSS_CACHE_KEY = 'news_fetch:v1:limit=100';

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

    // Read all three caches in parallel
    const [polygonResult, lunarCrushResult, rssResult] = await Promise.all([
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
      supabase
        .from('cache_kv')
        .select('v, expires_at, created_at')
        .eq('k', RSS_CACHE_KEY)
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

    const rssData = rssResult.data?.v as { 
      crypto?: NewsItem[]; 
      stocks?: NewsItem[];
      trump?: NewsItem[];
    } | null;

    // Log cache status
    const polygonAge = polygonResult.data?.expires_at 
      ? new Date(polygonResult.data.expires_at) > new Date() ? 'valid' : 'expired'
      : 'missing';
    const lunarCrushAge = lunarCrushResult.data?.expires_at
      ? new Date(lunarCrushResult.data.expires_at) > new Date() ? 'valid' : 'expired'
      : 'missing';
    const rssAge = rssResult.data?.expires_at
      ? new Date(rssResult.data.expires_at) > new Date() ? 'valid' : 'expired'
      : 'missing';

    console.log(`📦 Cache status - polygon_unified: ${polygonAge}, lunarcrush: ${lunarCrushAge}, rss: ${rssAge}`);

    // Get arrays from caches (empty if missing)
    // Force sourceType on items (fallback for older cache entries)
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

    // RSS items (lowest priority)
    const rssCrypto: NewsItem[] = dedupeByUrl(
      (rssData?.crypto || []).map(item => normalizeNewsItem(item, 'rss'))
    );
    const rssStocks: NewsItem[] = dedupeByUrl(
      (rssData?.stocks || []).map(item => normalizeNewsItem(item, 'rss'))
    );
    const rssTrump: NewsItem[] = dedupeByUrl(
      (rssData?.trump || []).map(item => normalizeNewsItem(item, 'rss'))
    );

    // Merge news sources: deduplicate by URL
    // Priority: LunarCrush (social engagement) > Polygon (sentiment) > RSS (fills gaps)
    const mergeAllSources = (lunarcrush: NewsItem[], polygon: NewsItem[], rss: NewsItem[]): NewsItem[] => {
      const lcUrls = new Set(lunarcrush.map(item => canonicalizeUrl(item.url)));
      const polyUrls = new Set(polygon.map(item => canonicalizeUrl(item.url)));
      
      const uniquePolygon = polygon.filter(item => !lcUrls.has(canonicalizeUrl(item.url)));
      const uniqueRss = rss.filter(item => 
        !lcUrls.has(canonicalizeUrl(item.url)) && 
        !polyUrls.has(canonicalizeUrl(item.url))
      );
      
      return dedupeByUrl([...lunarcrush, ...uniquePolygon, ...uniqueRss]);
    };

    const mergedCrypto = mergeAllSources(lcCrypto, polygonCrypto, rssCrypto);
    const mergedStocks = mergeAllSources(lcStocks, polygonStocks, rssStocks);
    const mergedTrump = mergeAllSources([], trumpNews, rssTrump);

    // Sort by publishedAt desc
    const sortByDate = (items: NewsItem[]) => 
      items.sort((a, b) => {
        const dateA = new Date(a.publishedAt || 0).getTime();
        const dateB = new Date(b.publishedAt || 0).getTime();
        return dateB - dateA;
      });

    sortByDate(mergedCrypto);
    sortByDate(mergedStocks);
    sortByDate(mergedTrump);

    console.log(`✅ Returning merged news: ${mergedCrypto.length} crypto, ${mergedStocks.length} stocks, ${mergedTrump.length} trump`);

    return new Response(JSON.stringify({
      crypto: mergedCrypto.slice(0, 50),
      stocks: mergedStocks.slice(0, 50),
      trump: mergedTrump.slice(0, 50),
      metadata: {
        source: 'cache_only',
        polygon_unified_cache: polygonAge,
        polygon_fetched_at: polygonData?.fetched_at,
        polygon_articles_count: polygonData?.articles_count,
        lunarcrush_cache: lunarCrushAge,
        rss_cache: rssAge,
        rss_articles_count: (rssData?.crypto?.length || 0) + (rssData?.stocks?.length || 0) + (rssData?.trump?.length || 0),
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
