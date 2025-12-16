import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const polygonKey = Deno.env.get('POLYGON_API_KEY');
    const supabase = createClient(supabaseUrl, supabaseKey);

    if (!polygonKey) {
      throw new Error('POLYGON_API_KEY not configured');
    }

    console.log('🚀 sync-stock-news-polygon: Starting stock news sync...');

    // Fetch latest market news from Polygon (free, unlimited)
    const newsUrl = `https://api.polygon.io/v2/reference/news?limit=1000&order=desc&apiKey=${polygonKey}`;
    const response = await fetch(newsUrl);
    
    if (!response.ok) {
      throw new Error(`Polygon News API error: ${response.status}`);
    }

    const data = await response.json();
    const articles = data.results || [];
    
    console.log(`📰 Fetched ${articles.length} news articles from Polygon`);

    // Group articles by ticker
    const tickerNews = new Map<string, any[]>();
    
    for (const article of articles) {
      const tickers = article.tickers || [];
      for (const ticker of tickers) {
        // Only process stock tickers (1-5 uppercase letters)
        if (/^[A-Z]{1,5}$/.test(ticker)) {
          if (!tickerNews.has(ticker)) {
            tickerNews.set(ticker, []);
          }
          const existingNews = tickerNews.get(ticker)!;
          if (existingNews.length < 5) { // Keep top 5 per ticker
            existingNews.push({
              title: article.title,
              source: article.publisher?.name || 'Unknown',
              url: article.article_url,
              published_at: article.published_utc,
              image_url: article.image_url,
              sentiment: article.insights?.[0]?.sentiment || null,
            });
          }
        }
      }
    }

    console.log(`📊 Grouped news for ${tickerNews.size} stock tickers`);

    // Get existing stock_cards to update
    const tickerList = Array.from(tickerNews.keys());
    const { data: existingStocks, error: stocksError } = await supabase
      .from('stock_cards')
      .select('symbol')
      .in('symbol', tickerList);

    if (stocksError) {
      console.warn(`⚠️ Failed to fetch stock_cards: ${stocksError.message}`);
    }

    const existingSymbols = new Set(existingStocks?.map(s => s.symbol) || []);
    console.log(`📝 Found ${existingSymbols.size} matching stocks in stock_cards`);

    // Update stock_cards with news
    let updatedCount = 0;
    
    for (const [ticker, news] of tickerNews) {
      if (!existingSymbols.has(ticker)) continue;
      
      const { error: updateError } = await supabase
        .from('stock_cards')
        .update({
          top_news: news,
          updated_at: new Date().toISOString(),
        })
        .eq('symbol', ticker);

      if (updateError) {
        console.error(`❌ Failed to update news for ${ticker}:`, updateError.message);
      } else {
        updatedCount++;
      }
    }

    const duration = Date.now() - startTime;
    console.log(`✅ sync-stock-news-polygon complete: ${updatedCount} stocks updated with news in ${duration}ms`);

    // Log API call
    try {
      await supabase.from('external_api_calls').insert({
        api_name: 'polygon',
        function_name: 'sync-stock-news-polygon',
        call_count: 1,
        success: true,
      });
    } catch (e) {
      // Ignore logging errors
    }

    return new Response(JSON.stringify({
      success: true,
      articles_fetched: articles.length,
      tickers_with_news: tickerNews.size,
      stocks_updated: updatedCount,
      duration_ms: duration,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ sync-stock-news-polygon error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
