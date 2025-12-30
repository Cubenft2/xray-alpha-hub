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
  url: string;
  published_at: string;
  image_url?: string;
  sentiment?: string;
  description?: string;
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

    // Load ALL crypto symbols from token_cards (instead of hardcoded list)
    const { data: cryptoTokens, error: tokenError } = await supabase
      .from('token_cards')
      .select('canonical_symbol')
      .eq('is_active', true);

    if (tokenError) {
      console.error('⚠️ Failed to load crypto symbols from token_cards:', tokenError);
    }

    const CRYPTO_SYMBOLS = new Set(
      cryptoTokens?.map(t => t.canonical_symbol?.toUpperCase()).filter(Boolean) || []
    );
    
    console.log(`📋 Loaded ${CRYPTO_SYMBOLS.size} crypto symbols from token_cards`);

    // ONE API call to fetch all news
    const newsUrl = `https://api.polygon.io/v2/reference/news?limit=1000&order=desc&apiKey=${polygonKey}`;
    const response = await fetch(newsUrl);
    
    if (!response.ok) {
      throw new Error(`Polygon News API error: ${response.status}`);
    }

    const data = await response.json();
    const articles: PolygonArticle[] = data.results || [];
    
    console.log(`📰 Fetched ${articles.length} news articles from Polygon`);

    // Categorize articles
    const stockNews = new Map<string, NewsItem[]>();
    const cryptoNews = new Map<string, NewsItem[]>();
    const globalCrypto: NewsItem[] = [];
    const globalStocks: NewsItem[] = [];
    const globalTrump: NewsItem[] = [];

    for (const article of articles) {
      const tickers = article.tickers || [];
      const titleLower = (article.title || '').toLowerCase();
      const descLower = (article.description || '').toLowerCase();
      
      // Check if Trump-related
      const isTrumpRelated = TRUMP_KEYWORDS.some(kw => 
        titleLower.includes(kw) || descLower.includes(kw) ||
        tickers.some(t => t.toUpperCase().includes('TRUMP') || t.toUpperCase().includes('MELANIA'))
      );

      const newsItem: NewsItem = {
        title: article.title,
        source: article.publisher?.name || 'Unknown',
        url: article.article_url,
        published_at: article.published_utc,
        image_url: article.image_url,
        sentiment: article.insights?.[0]?.sentiment || null,
        description: article.description,
      };

      // Add to global trump feed
      if (isTrumpRelated && globalTrump.length < 50) {
        globalTrump.push(newsItem);
      }

      for (const ticker of tickers) {
        const upperTicker = ticker.toUpperCase();
        
        // Check if crypto (X: prefix or known crypto symbol)
        const isCrypto = ticker.startsWith('X:') || CRYPTO_SYMBOLS.has(upperTicker);
        
        // Check if stock (1-5 uppercase letters, no special chars)
        const isStock = /^[A-Z]{1,5}$/.test(upperTicker) && !CRYPTO_SYMBOLS.has(upperTicker);

        if (isCrypto) {
          // Normalize crypto symbol (remove X: prefix if present)
          const symbol = upperTicker.replace('X:', '').replace('USD', '').replace('USDT', '');
          
          if (!cryptoNews.has(symbol)) {
            cryptoNews.set(symbol, []);
          }
          const existing = cryptoNews.get(symbol)!;
          if (existing.length < 5) {
            existing.push(newsItem);
          }
          
          // Add to global crypto feed (dedupe by URL)
          if (globalCrypto.length < 100 && !globalCrypto.some(n => n.url === newsItem.url)) {
            globalCrypto.push(newsItem);
          }
        }
        
        if (isStock) {
          if (!stockNews.has(upperTicker)) {
            stockNews.set(upperTicker, []);
          }
          const existing = stockNews.get(upperTicker)!;
          if (existing.length < 5) {
            existing.push(newsItem);
          }
          
          // Add to global stocks feed (dedupe by URL)
          if (globalStocks.length < 100 && !globalStocks.some(n => n.url === newsItem.url)) {
            globalStocks.push(newsItem);
          }
        }
      }
    }

    console.log(`📊 Categorized: ${cryptoNews.size} crypto tickers, ${stockNews.size} stock tickers`);
    console.log(`📊 Global feeds: ${globalCrypto.length} crypto, ${globalStocks.length} stocks, ${globalTrump.length} trump`);

    // Update token_cards with crypto news
    let tokensUpdated = 0;
    const cryptoSymbols = Array.from(cryptoNews.keys());
    
    if (cryptoSymbols.length > 0) {
      const { data: existingTokens } = await supabase
        .from('token_cards')
        .select('canonical_symbol')
        .in('canonical_symbol', cryptoSymbols);

      const existingSymbols = new Set(existingTokens?.map(t => t.canonical_symbol) || []);

      for (const [symbol, news] of cryptoNews) {
        if (!existingSymbols.has(symbol)) continue;
        
        const { error } = await supabase
          .from('token_cards')
          .update({
            top_news: news,
            top_news_count: news.length,
            news_updated_at: new Date().toISOString(),
          })
          .eq('canonical_symbol', symbol);

        if (!error) tokensUpdated++;
      }
    }

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

    const cacheData = {
      crypto: globalCrypto,
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
    console.log(`   - Tokens updated: ${tokensUpdated}`);
    console.log(`   - Stocks updated: ${stocksUpdated}`);
    console.log(`   - Cache refreshed with ${globalCrypto.length + globalStocks.length + globalTrump.length} articles`);

    return new Response(JSON.stringify({
      success: true,
      articles_fetched: articles.length,
      crypto_tickers: cryptoNews.size,
      stock_tickers: stockNews.size,
      tokens_updated: tokensUpdated,
      stocks_updated: stocksUpdated,
      global_crypto: globalCrypto.length,
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
