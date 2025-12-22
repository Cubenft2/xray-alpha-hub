/**
 * Cache Warmer: Pre-fetch news for top trending tokens
 * Runs every 30 minutes to keep cache warm
 * 
 * FIXED: Now uses token_cards instead of deprecated crypto_snapshot
 * FIXED: Better Tavily query to get actual news articles, not homepage content
 */

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
    
    // Get trending tokens from token_cards (migrated from crypto_snapshot)
    const { data: trending } = await supabase
      .from('token_cards')
      .select('canonical_symbol')
      .eq('is_active', true)
      .not('galaxy_score', 'is', null)
      .order('galaxy_score', { ascending: false })
      .limit(10);
    
    const trendingSymbols = trending?.map(t => t.canonical_symbol) || [];
    
    // Combine priority + trending (deduplicated)
    const symbolsToWarm = [...new Set([...PRIORITY_SYMBOLS, ...trendingSymbols])].slice(0, 10);
    
    console.log(`[warm-news-cache] Warming ${symbolsToWarm.length} symbols: ${symbolsToWarm.join(', ')}`);
    
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
    let skippedArticles = 0;
    
    for (const symbol of needsRefresh.slice(0, 5)) {
      try {
        // Build a better search query to get actual news articles
        const tokenName = symbol === 'BTC' ? 'Bitcoin' 
          : symbol === 'ETH' ? 'Ethereum'
          : symbol === 'SOL' ? 'Solana'
          : symbol === 'XRP' ? 'Ripple XRP'
          : symbol === 'DOGE' ? 'Dogecoin'
          : symbol;
        
        const response = await fetch('https://api.tavily.com/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            api_key: tavilyKey,
            query: `"${tokenName}" crypto news today`,
            search_depth: 'basic',
            max_results: 5,
            include_domains: [
              'coindesk.com',
              'cointelegraph.com',
              'decrypt.co',
              'theblock.co',
              'cryptonews.com',
              'bitcoinmagazine.com',
              'bloomberg.com',
              'reuters.com'
            ],
          }),
        });
        
        if (response.ok) {
          const data = await response.json();
          
          // Filter out homepage/non-article results
          const validResults = (data.results || []).filter((r: any) => {
            // Must have a URL that looks like an article (not a homepage)
            const url = r.url || '';
            if (!url) return false;
            
            // Reject homepage URLs
            const isHomepage = /^https?:\/\/[^\/]+\/?$/.test(url) ||
              url.endsWith('/news') ||
              url.endsWith('/news/') ||
              url.endsWith('/crypto') ||
              url.endsWith('/crypto/');
            if (isHomepage) {
              skippedArticles++;
              return false;
            }
            
            // Must have a real title (not site name)
            const title = r.title || '';
            if (title.includes('Bitcoin, Ethereum, XRP') || 
                title.includes('Crypto News and Price Data') ||
                title.includes('Live Prices, Data') ||
                title.includes('News & Discussion')) {
              skippedArticles++;
              return false;
            }
            
            return true;
          });
          
          const newsItems = validResults.map((r: any) => ({
            symbol,
            title: r.title?.slice(0, 200) || 'Untitled',
            source: extractDomain(r.url) || 'Unknown',
            url: r.url || '',
            published_at: r.published_date || new Date().toISOString(),
            summary: cleanSummary(r.content)?.slice(0, 300) || null,
          }));
          
          if (newsItems.length > 0) {
            const { error } = await supabase.from('news_cache').insert(newsItems);
            if (error) {
              console.error(`[warm-news-cache] Insert error for ${symbol}:`, error);
            } else {
              totalArticles += newsItems.length;
              console.log(`[warm-news-cache] Inserted ${newsItems.length} articles for ${symbol}`);
            }
          } else {
            console.log(`[warm-news-cache] No valid articles found for ${symbol}`);
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
    const { count: deletedCount } = await supabase
      .from('news_cache')
      .delete()
      .lt('created_at', cleanupThreshold)
      .select('*', { count: 'exact', head: true });
    
    console.log(`[warm-news-cache] Refreshed ${totalArticles} articles, skipped ${skippedArticles} junk results, cleaned ${deletedCount || 0} old entries in ${Date.now() - startTime}ms`);
    
    return new Response(JSON.stringify({
      success: true,
      stats: {
        total: symbolsToWarm.length,
        fresh: freshSymbols.size,
        refreshed: needsRefresh.slice(0, 5).length,
        articles: totalArticles,
        skipped: skippedArticles,
        cleaned: deletedCount || 0,
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

// Helper: Extract domain name from URL
function extractDomain(url: string): string | null {
  try {
    const hostname = new URL(url).hostname;
    return hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

// Helper: Clean up Tavily content which often has markdown artifacts
function cleanSummary(content: string | null | undefined): string | null {
  if (!content) return null;
  
  return content
    .replace(/\[Image \d+[^\]]*\]/g, '') // Remove [Image N: ...]
    .replace(/!\[.*?\]\(.*?\)/g, '')     // Remove markdown images
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Convert links to text
    .replace(/#+\s*/g, '')                // Remove markdown headers
    .replace(/\*+/g, '')                  // Remove bold/italic
    .replace(/\s+/g, ' ')                 // Normalize whitespace
    .trim();
}
