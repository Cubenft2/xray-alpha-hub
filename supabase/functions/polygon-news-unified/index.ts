import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PolygonArticle {
  id: string;
  title: string;
  author?: string;
  published_utc: string;
  article_url: string;
  tickers?: string[];
  image_url?: string;
  description?: string;
  keywords?: string[];
  publisher?: {
    name: string;
    homepage_url?: string;
    logo_url?: string;
    favicon_url?: string;
  };
  insights?: Array<{
    ticker: string;
    sentiment: string;
    sentiment_reasoning?: string;
  }>;
}

interface NewsItem {
  title: string;
  source: string;
  sourceType: 'polygon';
  url: string;
  published_at: string;
  image_url?: string;
  sentiment?: string;
  sentimentReasoning?: string;
  description?: string;
  author?: string;
  tickers?: string[];
  keywords?: string[];
}

// Trump-related keywords
const TRUMP_KEYWORDS = ['trump', 'melania', 'maga', 'potus', 'donald'];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const polygonKey = Deno.env.get('POLYGON_API_KEY');
    const cronSecret = Deno.env.get('CRON_SECRET');
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Parse request body
    const body = await (async () => {
      try { return await req.json(); } catch { return {}; }
    })() as { cronSecret?: string };

    // Authorization check - only cron can trigger refresh
    if (!cronSecret || body.cronSecret !== cronSecret) {
      console.log('⚠️ Unauthorized request - cronSecret mismatch');
      return new Response(JSON.stringify({ 
        error: 'Unauthorized - cron only',
        message: 'This function can only be called by authorized cron jobs'
      }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!polygonKey) {
      throw new Error('POLYGON_API_KEY not configured');
    }

    console.log('🚀 polygon-news-unified: Starting unified news sync...');
    
    // NOTE: Polygon only provides STOCK news, NOT crypto news
    // Crypto news comes from LunarCrush via lunarcrush-news function
    // We set crypto array to empty and only classify stocks

    // Load ALL stock symbols from stock_cards using pagination
    const allStockSymbols: string[] = [];
    let stockOffset = 0;
    const stockBatchSize = 1000;
    
    while (true) {
      const { data: stockBatch, error: stockError } = await supabase
        .from('stock_cards')
        .select('symbol')
        .eq('is_active', true)
        .range(stockOffset, stockOffset + stockBatchSize - 1);

      if (stockError) {
        console.error('⚠️ Failed to load stock symbols:', stockError);
        break;
      }
      
      if (!stockBatch || stockBatch.length === 0) break;
      
      allStockSymbols.push(...stockBatch.map(s => s.symbol?.toUpperCase()).filter(Boolean));
      stockOffset += stockBatchSize;
      
      if (stockBatch.length < stockBatchSize) break;
    }

    const STOCK_SYMBOLS = new Set(allStockSymbols);
    console.log(`📋 Loaded ${STOCK_SYMBOLS.size} stock symbols from stock_cards`);

    // ONE API call to fetch all news
    const newsUrl = `https://api.polygon.io/v2/reference/news?limit=1000&order=desc&apiKey=${polygonKey}`;
    const response = await fetch(newsUrl);
    
    if (!response.ok) {
      throw new Error(`Polygon News API error: ${response.status}`);
    }

    const data = await response.json();
    const articles: PolygonArticle[] = data.results || [];
    
    console.log(`📰 Fetched ${articles.length} news articles from Polygon`);

    // Categorize articles - STOCKS ONLY (no crypto from Polygon)
    const stockNews = new Map<string, NewsItem[]>();
    const globalStocks: NewsItem[] = [];
    const globalTrump: NewsItem[] = [];

    for (const article of articles) {
      const tickers = article.tickers || [];
      const titleLower = (article.title || '').toLowerCase();
      const descLower = (article.description || '').toLowerCase();
      
      // Check if Trump-related (independent category)
      const isTrumpRelated = TRUMP_KEYWORDS.some(kw => 
        titleLower.includes(kw) || descLower.includes(kw) ||
        tickers.some(t => t.toUpperCase().includes('TRUMP') || t.toUpperCase().includes('MELANIA'))
      );

      const newsItem: NewsItem = {
        title: article.title,
        source: article.publisher?.name || 'Unknown',
        sourceType: 'polygon',
        url: article.article_url,
        published_at: article.published_utc,
        image_url: article.image_url,
        sentiment: article.insights?.[0]?.sentiment || null,
        sentimentReasoning: article.insights?.[0]?.sentiment_reasoning || '',
        description: article.description || '',
        author: article.author || '',
        tickers: tickers.map(t => t.toUpperCase()),
        keywords: article.keywords || [],
      };

      // Add to global trump feed
      if (isTrumpRelated && globalTrump.length < 50) {
        globalTrump.push(newsItem);
      }

      // Classify as stock if ANY ticker is a known stock
      const stockSymbolsForArticle: string[] = [];
      for (const ticker of tickers) {
        const upperTicker = ticker.toUpperCase();
        if (STOCK_SYMBOLS.has(upperTicker)) {
          stockSymbolsForArticle.push(upperTicker);
        }
      }

      if (stockSymbolsForArticle.length > 0) {
        // Add to per-symbol stock feeds
        for (const symbol of stockSymbolsForArticle) {
          if (!stockNews.has(symbol)) {
            stockNews.set(symbol, []);
          }
          const existing = stockNews.get(symbol)!;
          if (existing.length < 5) {
            existing.push(newsItem);
          }
        }
        
        // Add to global stocks feed (dedupe by URL)
        if (globalStocks.length < 100 && !globalStocks.some(n => n.url === newsItem.url)) {
          globalStocks.push(newsItem);
        }
      }
    }

    console.log(`📊 Categorized: ${stockNews.size} stock tickers`);
    console.log(`📊 Global feeds: 0 crypto (Polygon stocks-only), ${globalStocks.length} stocks, ${globalTrump.length} trump`);

    // Update stock_cards with stock news
    let stocksUpdated = 0;
    const stockSymbols = Array.from(stockNews.keys());
    
    if (stockSymbols.length > 0) {
      const { data: existingStocks } = await supabase
        .from('stock_cards')
        .select('symbol')
        .in('symbol', stockSymbols);

      const existingSymbols = new Set(existingStocks?.map(s => s.symbol) || []);

      for (const [symbol, news] of stockNews) {
        if (!existingSymbols.has(symbol)) continue;
        
        const { error } = await supabase
          .from('stock_cards')
          .update({
            top_news: news,
            updated_at: new Date().toISOString(),
          })
          .eq('symbol', symbol);

        if (!error) stocksUpdated++;
      }
    }

    // Write global feed to cache_kv for the Financial News widget
    const cacheKey = 'polygon_news_unified_cache';
    const cacheTTL = 20 * 60 * 1000; // 20 minutes
    const expiresAt = new Date(Date.now() + cacheTTL).toISOString();

    // Polygon = stocks only, crypto array is empty (LunarCrush provides crypto news)
    const cacheData = {
      crypto: [], // Always empty - Polygon doesn't have crypto news
      stocks: globalStocks,
      trump: globalTrump,
      fetched_at: new Date().toISOString(),
      articles_count: articles.length,
    };

    await supabase
      .from('cache_kv')
      .upsert({
        k: cacheKey,
        v: cacheData,
        expires_at: expiresAt,
        created_at: new Date().toISOString(),
      }, { onConflict: 'k' });

    // Log API call
    try {
      await supabase.from('external_api_calls').insert({
        api_name: 'polygon',
        function_name: 'polygon-news-unified',
        call_count: 1,
        success: true,
      });
    } catch (e) {
      // Ignore logging errors
    }

    const duration = Date.now() - startTime;
    console.log(`✅ polygon-news-unified complete in ${duration}ms`);
    console.log(`   - Stocks updated: ${stocksUpdated}`);
    console.log(`   - Cache refreshed with ${globalStocks.length + globalTrump.length} articles`);

    return new Response(JSON.stringify({
      success: true,
      articles_fetched: articles.length,
      stock_tickers: stockNews.size,
      stocks_updated: stocksUpdated,
      global_crypto: 0, // Polygon = stocks only
      global_stocks: globalStocks.length,
      global_trump: globalTrump.length,
      duration_ms: duration,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ polygon-news-unified error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
