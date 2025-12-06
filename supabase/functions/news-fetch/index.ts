// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  const { limit } = await (async () => {
    try { return await req.json(); } catch { return {}; }
  })() as { limit?: number };

  const max = Math.min(Math.max(limit ?? 100, 10), 200);

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

  // Trigger asset sentiment calculation in background
  if (polygonNews.length > 0) {
    console.log('🔄 Triggering asset sentiment calculation...');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    
    fetch(`${supabaseUrl}/functions/v1/calculate-asset-sentiment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseAnonKey}`
      },
      body: JSON.stringify({ polygonArticles: polygonNews })
    }).catch(err => console.error('Asset sentiment calculation error:', err));
  }

  return new Response(JSON.stringify({ crypto: cryptoItems, stocks: stockItems, trump: trumpItems }), {
    headers: { "content-type": "application/json; charset=utf-8", ...CORS_HEADERS },
  });
});