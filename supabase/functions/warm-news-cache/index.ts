// Cache Warmer: Pre-fetch news for top trending tokens
// Runs every 30 minutes to keep cache warm (users never trigger cold-start)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Top tokens to always keep warm
const PRIORITY_SYMBOLS = ['BTC', 'ETH', 'SOL', 'XRP', 'DOGE'];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const tavilyKey = Deno.env.get("TAVILY_API_KEY");
    
    if (!tavilyKey) {
      console.error("[warm-news-cache] Missing TAVILY_API_KEY");
      return new Response(JSON.stringify({ error: "Missing API key" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Get trending tokens from crypto_snapshot
    const { data: trending } = await supabase
      .from('crypto_snapshot')
      .select('symbol')
      .order('galaxy_score', { ascending: false })
      .limit(10);
    
    const trendingSymbols = trending?.map(t => t.symbol) || [];
    
    // Combine priority + trending (deduplicated)
    const symbolsToWarm = [...new Set([...PRIORITY_SYMBOLS, ...trendingSymbols])].slice(0, 10);
    
    console.log(`[warm-news-cache] Warming ${symbolsToWarm.length} symbols`);
    
    // Check which symbols are stale (older than 30 min)
    const staleThreshold = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    
    const { data: cached } = await supabase
      .from('news_cache')
      .select('symbol, created_at')
      .in('symbol', symbolsToWarm)
      .gte('created_at', staleThreshold);
    
    const freshSymbols = new Set((cached || []).map((c: any) => c.symbol));
    const needsRefresh = symbolsToWarm.filter(s => !freshSymbols.has(s));
    
    console.log(`[warm-news-cache] ${freshSymbols.size} fresh, ${needsRefresh.length} need refresh`);
    
    if (needsRefresh.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        message: "All symbols already warm",
        stats: { total: symbolsToWarm.length, fresh: freshSymbols.size, refreshed: 0 },
        duration_ms: Date.now() - startTime,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    
    // Fetch from Tavily for each symbol (max 5 per run to stay within limits)
    let totalArticles = 0;
    
    for (const symbol of needsRefresh.slice(0, 5)) {
      try {
        const response = await fetch('https://api.tavily.com/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            api_key: tavilyKey,
            query: `${symbol} cryptocurrency news`,
            search_depth: 'basic',
            max_results: 5,
          }),
        });
        
        if (response.ok) {
          const data = await response.json();
          const newsItems = (data.results || []).map((r: any) => ({
            symbol,
            title: r.title,
            source: r.source || 'Unknown',
            url: r.url || '',
            published_at: r.published_date || new Date().toISOString(),
            summary: r.content?.slice(0, 200),
          }));
          
          if (newsItems.length > 0) {
            const { error } = await supabase.from('news_cache').insert(newsItems);
            if (error) {
              console.error(`[warm-news-cache] Insert error for ${symbol}:`, error);
            } else {
              totalArticles += newsItems.length;
            }
          }
        }
      } catch (e) {
        console.error(`[warm-news-cache] Error for ${symbol}:`, e);
      }
      
      // Delay between requests
      await new Promise(r => setTimeout(r, 500));
    }
    
    // Cleanup old news (older than 24h)
    const cleanupThreshold = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    await supabase
      .from('news_cache')
      .delete()
      .lt('created_at', cleanupThreshold);
    
    console.log(`[warm-news-cache] Refreshed ${totalArticles} articles in ${Date.now() - startTime}ms`);
    
    return new Response(JSON.stringify({
      success: true,
      stats: {
        total: symbolsToWarm.length,
        fresh: freshSymbols.size,
        refreshed: needsRefresh.slice(0, 5).length,
        articles: totalArticles,
      },
      duration_ms: Date.now() - startTime,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
    
  } catch (e) {
    console.error("[warm-news-cache] Fatal error:", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
