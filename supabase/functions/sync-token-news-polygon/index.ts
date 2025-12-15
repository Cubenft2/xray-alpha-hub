// Sync Polygon news to token_cards.top_news
// FREE (unlimited) - runs every 15 minutes

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PolygonNewsItem {
  title: string;
  article_url: string;
  published_utc: string;
  publisher?: { name: string };
  image_url?: string;
  tickers?: string[];
  insights?: Array<{ sentiment?: string; sentiment_reasoning?: string }>;
  keywords?: string[];
}

interface TokenNewsItem {
  title: string;
  url: string;
  source: string;
  published_at: string;
  image_url?: string;
  sentiment?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const polygonApiKey = Deno.env.get("POLYGON_API_KEY");
    
    if (!polygonApiKey) {
      console.error("[sync-token-news-polygon] Missing POLYGON_API_KEY");
      return new Response(JSON.stringify({ error: "Missing API key" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Fetch 100 latest news articles from Polygon (FREE - unlimited)
    console.log("[sync-token-news-polygon] Fetching Polygon news...");
    const url = `https://api.polygon.io/v2/reference/news?limit=100&apiKey=${polygonApiKey}`;
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Polygon API error: ${response.status}`);
    }
    
    const data = await response.json();
    const articles: PolygonNewsItem[] = data.results || [];
    
    console.log(`[sync-token-news-polygon] Fetched ${articles.length} articles`);
    
    // Group articles by ticker (normalized to canonical symbol)
    const tickerNewsMap: Record<string, TokenNewsItem[]> = {};
    
    for (const article of articles) {
      const tickers = article.tickers || [];
      
      for (const ticker of tickers) {
        // Normalize ticker: remove X: prefix for crypto
        const normalizedTicker = ticker.startsWith('X:') 
          ? ticker.replace('X:', '').replace(/USD$/, '').replace(/USDT$/, '')
          : ticker;
        
        if (!tickerNewsMap[normalizedTicker]) {
          tickerNewsMap[normalizedTicker] = [];
        }
        
        // Only keep top 5 news per token
        if (tickerNewsMap[normalizedTicker].length < 5) {
          tickerNewsMap[normalizedTicker].push({
            title: article.title,
            url: article.article_url,
            source: article.publisher?.name || 'Unknown',
            published_at: article.published_utc,
            image_url: article.image_url,
            sentiment: article.insights?.[0]?.sentiment,
          });
        }
      }
    }
    
    const tickersWithNews = Object.keys(tickerNewsMap);
    console.log(`[sync-token-news-polygon] ${tickersWithNews.length} tickers have news`);
    
    if (tickersWithNews.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        message: "No news with tickers found",
        duration_ms: Date.now() - startTime,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    
    // Find matching tokens in token_cards
    const { data: matchingTokens, error: matchError } = await supabase
      .from('token_cards')
      .select('canonical_symbol')
      .in('canonical_symbol', tickersWithNews);
    
    if (matchError) {
      console.error("[sync-token-news-polygon] Match error:", matchError);
    }
    
    const matchedSymbols = new Set((matchingTokens || []).map(t => t.canonical_symbol));
    console.log(`[sync-token-news-polygon] ${matchedSymbols.size} tokens matched in token_cards`);
    
    // Batch update token_cards with news
    let updatedCount = 0;
    const batchSize = 50;
    const matchedArray = Array.from(matchedSymbols);
    
    for (let i = 0; i < matchedArray.length; i += batchSize) {
      const batch = matchedArray.slice(i, i + batchSize);
      
      for (const symbol of batch) {
        const news = tickerNewsMap[symbol];
        if (!news || news.length === 0) continue;
        
        const { error: updateError } = await supabase
          .from('token_cards')
          .update({
            top_news: news,
            top_news_count: news.length,
            news_updated_at: new Date().toISOString(),
          })
          .eq('canonical_symbol', symbol);
        
        if (updateError) {
          console.error(`[sync-token-news-polygon] Update error for ${symbol}:`, updateError);
        } else {
          updatedCount++;
        }
      }
    }
    
    const duration = Date.now() - startTime;
    console.log(`[sync-token-news-polygon] Updated ${updatedCount} tokens with news in ${duration}ms`);
    
    return new Response(JSON.stringify({
      success: true,
      stats: {
        articles_fetched: articles.length,
        tickers_with_news: tickersWithNews.length,
        tokens_matched: matchedSymbols.size,
        tokens_updated: updatedCount,
      },
      duration_ms: duration,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
    
  } catch (e) {
    console.error("[sync-token-news-polygon] Fatal error:", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
