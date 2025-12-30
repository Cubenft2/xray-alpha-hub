// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

interface NewsItem {
  title: string;
  description: string;
  url: string;
  publishedAt: string; // ISO
  source: string;
  sourceType?: string; // "polygon" or "rss"
  // Enhanced Polygon.io metadata
  sentiment?: 'positive' | 'negative' | 'neutral';
  sentimentReasoning?: string;
  tickers?: string[];
  keywords?: string[];
  imageUrl?: string;
  author?: string;
}

interface CachedNewsResponse {
  crypto: NewsItem[];
  stocks: NewsItem[];
  trump: NewsItem[];
  cached: boolean;
  cached_at?: string;
  cache_expires_at?: string;
}

// Cache configuration
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const LOCK_TTL_MS = 30 * 1000; // 30 seconds (enough for RSS pulls)

// Parameterized keys to avoid cache conflicts between different limits
const getCacheKey = (max: number) => `news_fetch:v1:limit=${max}`;
const getLockKey = (max: number) => `news_fetch_lock:v1:limit=${max}`;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

function textInTag(xml: string, tag: string): string | null {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i");
  const m = xml.match(re);
  return m ? m[1] : null;
}

function stripTags(html: string): string {
  return html
    .replace(/<!\[CDATA\[/g, "")
    .replace(/\]\]>/g, "")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

function parseDate(s?: string | null): string {
  if (!s) return new Date().toISOString();
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d.toISOString();
  return new Date().toISOString();
}

function hostnameFromUrl(u?: string | null): string {
  try { return u ? new URL(u).hostname : ""; } catch { return ""; }
}

function parseRss(xml: string, fallbackSource: string): NewsItem[] {
  const items: NewsItem[] = [];
  const matches = xml.match(/<item[\s\S]*?<\/item>/gi) || [];
  for (const chunk of matches) {
    const titleRaw = textInTag(chunk, "title");
    const linkRaw = textInTag(chunk, "link");
    const descRaw = textInTag(chunk, "description") || textInTag(chunk, "content:encoded");
    const dateRaw = textInTag(chunk, "pubDate") || textInTag(chunk, "updated") || textInTag(chunk, "dc:date");

    const url = linkRaw ? stripTags(linkRaw) : "";
    const title = titleRaw ? stripTags(titleRaw) : "Untitled";
    const description = descRaw ? stripTags(descRaw).slice(0, 300) : "";
    const publishedAt = parseDate(descRaw && /time[^>]*datetime=\"([^\"]+)\"/i.test(descRaw) ? RegExp.$1 : dateRaw || undefined);
    const host = hostnameFromUrl(url);

    if (url) {
      items.push({
        title,
        description,
        url,
        publishedAt,
        source: host || fallbackSource,
      });
    }
  }
  return items;
}

async function fetchText(url: string, timeoutMs = 7000): Promise<string | null> {
  const ac = new AbortController();
  const id = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ac.signal });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  } finally {
    clearTimeout(id);
  }
}

async function fetchPolygonNews(apiKey: string): Promise<NewsItem[]> {
  try {
    const url = `https://api.polygon.io/v2/reference/news?limit=50&apiKey=${apiKey}`;
    const response = await fetch(url);
    
    if (!response.ok) {
      console.error(`Polygon API error: ${response.status}`);
      return [];
    }
    
    const data = await response.json();
    
    if (!data.results || !Array.isArray(data.results)) {
      return [];
    }
    
    return data.results.map((item: any) => ({
      title: item.title || "Untitled",
      description: (item.description || "").slice(0, 300),
      url: item.article_url || "",
      publishedAt: item.published_utc || new Date().toISOString(),
      source: item.publisher?.name || "Polygon.io",
      sourceType: "polygon",
      // Enhanced metadata from Polygon.io
      sentiment: item.insights?.[0]?.sentiment || undefined,
      sentimentReasoning: item.insights?.[0]?.sentiment_reasoning || undefined,
      tickers: item.tickers || [],
      keywords: item.keywords || [],
      imageUrl: item.image_url || undefined,
      author: item.author || undefined
    })).filter((item: NewsItem) => item.url);
  } catch (error) {
    console.error('Error fetching Polygon news:', error);
    return [];
  }
}

async function fetchFreshNews(max: number): Promise<{ crypto: NewsItem[]; stocks: NewsItem[]; trump: NewsItem[] }> {
  const cryptoFeeds = [
    "https://www.coindesk.com/arc/outboundfeeds/rss/",
    "https://cointelegraph.com/rss",
    "https://decrypt.co/feed",
    "https://cryptonews.com/news/feed/",
    "https://bitcoinmagazine.com/feed",
    "https://cryptopotato.com/feed/",
    "https://cryptoslate.com/feed/",
  ];

  const stockFeeds = [
    "https://feeds.reuters.com/reuters/businessNews",
    "https://www.cnbc.com/id/100003114/device/rss/rss.html",
    "https://feeds.content.dowjones.io/public/rss/mw_topstories",
    "https://feeds.bloomberg.com/markets/news.rss",
    "https://feeds.finance.yahoo.com/rss/2.0/headline",
    "https://www.ft.com/rss/home/us",
    "https://feeds.feedburner.com/zerohedge/feed",
    "https://www.investing.com/rss/news.rss",
  ];

  const trumpFeeds = [
    "https://truthsocial.com/users/realDonaldTrump/statuses.rss",
    "https://feeds.feedburner.com/breitbart",
    "https://www.foxnews.com/politics.xml",
    "https://feeds.feedburner.com/dailywire/news",
    "https://feeds.newsmax.com/newsmax/us",
    "https://www.oann.com/feed/",
  ];

  const polygonApiKey = Deno.env.get('POLYGON_API_KEY');
  
  const [cryptoTexts, stockTexts, trumpTexts, polygonNews] = await Promise.all([
    Promise.all(cryptoFeeds.map((u) => fetchText(u))),
    Promise.all(stockFeeds.map((u) => fetchText(u))),
    Promise.all(trumpFeeds.map((u) => fetchText(u))),
    polygonApiKey ? fetchPolygonNews(polygonApiKey) : Promise.resolve([])
  ]);

  let cryptoItems: NewsItem[] = [];
  for (let i = 0; i < cryptoFeeds.length; i++) {
    const xml = cryptoTexts[i];
    if (xml) {
      const rssItems = parseRss(xml, hostnameFromUrl(cryptoFeeds[i]));
      rssItems.forEach(item => item.sourceType = "rss");
      cryptoItems.push(...rssItems);
    }
  }

  let stockItems: NewsItem[] = [];
  for (let i = 0; i < stockFeeds.length; i++) {
    const xml = stockTexts[i];
    if (xml) {
      const rssItems = parseRss(xml, hostnameFromUrl(stockFeeds[i]));
      rssItems.forEach(item => item.sourceType = "rss");
      stockItems.push(...rssItems);
    }
  }

  let trumpItems: NewsItem[] = [];
  for (let i = 0; i < trumpFeeds.length; i++) {
    const xml = trumpTexts[i];
    if (xml) {
      const rssItems = parseRss(xml, hostnameFromUrl(trumpFeeds[i]));
      rssItems.forEach(item => item.sourceType = "rss");
      trumpItems.push(...rssItems);
    }
  }

  // Known crypto tickers for categorization
  const CRYPTO_TICKERS = new Set([
    'BTC', 'ETH', 'SOL', 'XRP', 'ADA', 'DOGE', 'LINK', 'AVAX', 'DOT', 'MATIC',
    'SHIB', 'UNI', 'LTC', 'BCH', 'ATOM', 'XLM', 'ALGO', 'VET', 'FIL', 'HBAR',
    'AAVE', 'MKR', 'COMP', 'SNX', 'SUSHI', 'YFI', 'CRV', 'APE', 'SAND', 'MANA',
    'AXS', 'ENJ', 'GALA', 'CHZ', 'BAT', 'ZRX', '1INCH', 'ENS', 'LDO', 'OP',
    'ARB', 'IMX', 'APT', 'SUI', 'SEI', 'TIA', 'NEAR', 'FTM', 'KAVA', 'RUNE',
    'INJ', 'OSMO', 'ROSE', 'ZEC', 'DASH', 'XMR', 'ETC', 'NEO', 'EOS', 'TRX',
    'XTZ', 'THETA', 'EGLD', 'FLOW', 'QNT', 'GRT', 'RNDR', 'FET', 'OCEAN', 'AGIX',
    'WLD', 'PEPE', 'FLOKI', 'BONK', 'WIF', 'BOME', 'TRUMP', 'MELANIA', 'JUP', 'RAY',
    'TON', 'NOT', 'PYTH', 'JTO', 'W', 'STRK', 'DYM', 'PIXEL', 'PORTAL', 'ALT',
    'MEME', 'BLUR', 'ID', 'CYBER', 'ARKM', 'PENDLE', 'STX', 'ORDI', 'SATS', 'TAO'
  ]);

  // Check if ticker is crypto (handles X: prefix from Polygon)
  const isCryptoTicker = (ticker: string): boolean => {
    if (ticker.startsWith('X:')) return true; // Polygon crypto format
    const normalized = ticker.replace('X:', '').toUpperCase();
    return CRYPTO_TICKERS.has(normalized);
  };

  // Categorize Polygon news by ticker type
  if (polygonNews.length > 0) {
    const polygonCrypto: NewsItem[] = [];
    const polygonStocks: NewsItem[] = [];

    for (const item of polygonNews) {
      const tickers = item.tickers || [];
      
      if (tickers.length === 0) {
        // No tickers - default to stocks (most Polygon news is stock-focused)
        polygonStocks.push(item);
        continue;
      }

      const hasCryptoTicker = tickers.some(t => isCryptoTicker(t));
      const hasStockTicker = tickers.some(t => !isCryptoTicker(t));

      if (hasCryptoTicker) polygonCrypto.push(item);
      if (hasStockTicker) polygonStocks.push(item);
    }

    cryptoItems.push(...polygonCrypto);
    stockItems.push(...polygonStocks);
    
    console.log(`📊 Polygon categorization: ${polygonCrypto.length} crypto, ${polygonStocks.length} stocks`);
  }

  // Sort newest first and limit
  cryptoItems.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
  stockItems.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
  trumpItems.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());

  cryptoItems = cryptoItems.slice(0, Math.min(50, max));
  stockItems = stockItems.slice(0, Math.min(50, max));
  trumpItems = trumpItems.slice(0, Math.min(50, max));

  // Trigger asset sentiment calculation in background (fire-and-forget)
  if (polygonNews.length > 0) {
    console.log('🔄 Triggering asset sentiment calculation...');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    fetch(`${supabaseUrl}/functions/v1/calculate-asset-sentiment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseServiceKey}`
      },
      body: JSON.stringify({ polygonArticles: polygonNews })
    }).catch(err => console.error('Asset sentiment calculation error:', err));
  }

  console.log(`📰 Fresh news fetched: ${cryptoItems.length} crypto, ${stockItems.length} stocks, ${trumpItems.length} trump`);
  return { crypto: cryptoItems, stocks: stockItems, trump: trumpItems };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const body = await (async () => {
    try { return await req.json(); } catch { return {}; }
  })() as { limit?: number; cronSecret?: string };

  const max = Math.min(Math.max(body.limit ?? 100, 10), 200);
  
  // CRON_SECRET check: Non-cron requests only return cached data, never refresh
  const cronSecret = Deno.env.get('CRON_SECRET');
  const isCronAuthorized = cronSecret && body.cronSecret === cronSecret;
  
  // Parameterized cache keys by limit
  const cacheKey = getCacheKey(max);
  const lockKey = getLockKey(max);
  const now = new Date();
  
  // Always try to return cache first
  const cachedRes = await supabase
    .from('cache_kv')
    .select('v, expires_at, created_at')
    .eq('k', cacheKey)
    .single();
  
  const cached = cachedRes.data;

  // Non-cron requests: ONLY return cached data, never refresh
  if (!isCronAuthorized) {
    console.log('📦 Non-cron request - returning cache only (no API refresh)');
    if (cached?.v) {
      const cachedData = cached.v as { crypto: NewsItem[]; stocks: NewsItem[]; trump: NewsItem[] };
      const response: CachedNewsResponse = {
        ...cachedData,
        cached: true,
        cached_at: cached.created_at,
        cache_expires_at: cached.expires_at
      };
      return new Response(JSON.stringify(response), {
        headers: { "content-type": "application/json; charset=utf-8", ...CORS_HEADERS },
      });
    }
    // No cache exists - return empty (cron will populate it)
    return new Response(JSON.stringify({
      crypto: [],
      stocks: [],
      trump: [],
      cached: true,
      message: 'Cache empty - awaiting cron refresh'
    }), {
      headers: { "content-type": "application/json; charset=utf-8", ...CORS_HEADERS },
    });
  }

  // Cron-authorized request continues below...
  // Cache already checked above, use the same cached value

  if (cached) {
    const expiresAt = new Date(cached.expires_at);
    const isExpired = expiresAt <= now;
    
    // Cache is fresh - return immediately
    if (!isExpired) {
      const ageSeconds = Math.round((now.getTime() - new Date(cached.created_at).getTime()) / 1000);
      console.log(`📦 Cache HIT (${ageSeconds}s old) - returning cached news for limit=${max}`);
      const cachedData = cached.v as { crypto: NewsItem[]; stocks: NewsItem[]; trump: NewsItem[] };
      const response: CachedNewsResponse = {
        ...cachedData,
        cached: true,
        cached_at: cached.created_at,
        cache_expires_at: cached.expires_at
      };
      return new Response(JSON.stringify(response), {
        headers: { "content-type": "application/json; charset=utf-8", ...CORS_HEADERS },
      });
    }

    // Cache is stale - check if another request is refreshing
    const { data: lock } = await supabase
      .from('cache_kv')
      .select('expires_at')
      .eq('k', lockKey)
      .single();

    if (lock?.expires_at && new Date(lock.expires_at) > now) {
      // Another request is refreshing - return stale data immediately (SWR)
      console.log(`🔄 Cache STALE but refresh in progress - returning stale data for limit=${max}`);
      const cachedData = cached.v as { crypto: NewsItem[]; stocks: NewsItem[]; trump: NewsItem[] };
      const response: CachedNewsResponse = {
        ...cachedData,
        cached: true,
        cached_at: cached.created_at,
        cache_expires_at: cached.expires_at
      };
      return new Response(JSON.stringify(response), {
        headers: { "content-type": "application/json; charset=utf-8", ...CORS_HEADERS },
      });
    }
  }

  // Step 2: Acquire refresh lock
  console.log(`🔒 Acquiring refresh lock for limit=${max}...`);
  await supabase.from('cache_kv').upsert({
    k: lockKey,
    v: { refreshing: true, started_at: now.toISOString() },
    expires_at: new Date(now.getTime() + LOCK_TTL_MS).toISOString()
  });

  try {
    // Step 3: Fetch fresh news
    console.log(`🌐 Cache MISS - fetching fresh news from 22+ sources (limit=${max})...`);
    const startTime = Date.now();
    const freshData = await fetchFreshNews(max);
    const fetchDuration = Date.now() - startTime;

    // Step 4: Update cache
    const expiresAt = new Date(now.getTime() + CACHE_TTL_MS);
    await supabase.from('cache_kv').upsert({
      k: cacheKey,
      v: freshData,
      expires_at: expiresAt.toISOString()
    });
    
    console.log(`✅ Cache refreshed in ${fetchDuration}ms, expires at ${expiresAt.toISOString()}`);

    // Step 5: Release lock
    await supabase.from('cache_kv').delete().eq('k', lockKey);

    const response: CachedNewsResponse = {
      ...freshData,
      cached: false,
      cached_at: now.toISOString(),
      cache_expires_at: expiresAt.toISOString()
    };

    return new Response(JSON.stringify(response), {
      headers: { "content-type": "application/json; charset=utf-8", ...CORS_HEADERS },
    });
  } catch (error) {
    // Release lock on error
    await supabase.from('cache_kv').delete().eq('k', lockKey);
    console.error('❌ Error fetching news:', error);
    
    // If we have stale cache, return it
    if (cached) {
      console.log('⚠️ Returning stale cache due to error');
      const cachedData = cached.v as { crypto: NewsItem[]; stocks: NewsItem[]; trump: NewsItem[] };
      const response: CachedNewsResponse = {
        ...cachedData,
        cached: true,
        cached_at: cached.created_at,
        cache_expires_at: cached.expires_at
      };
      return new Response(JSON.stringify(response), {
        headers: { "content-type": "application/json; charset=utf-8", ...CORS_HEADERS },
      });
    }

    throw error;
  }
});
