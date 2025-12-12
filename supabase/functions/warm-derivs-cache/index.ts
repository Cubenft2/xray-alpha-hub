// Cache Warmer: Pre-fetch derivatives data for top trending tokens
// Runs every 5 minutes to keep cache warm (users never trigger cold-start)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Top tokens to always keep warm
const PRIORITY_SYMBOLS = ['BTC', 'ETH', 'SOL', 'XRP', 'DOGE', 'ADA', 'AVAX', 'LINK', 'DOT', 'MATIC'];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const coinglassKey = Deno.env.get("COINGLASS_API_KEY");
    
    if (!coinglassKey) {
      console.error("[warm-derivs-cache] Missing COINGLASS_API_KEY");
      return new Response(JSON.stringify({ error: "Missing API key" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Get trending tokens from crypto_snapshot (top by social volume)
    const { data: trending } = await supabase
      .from('crypto_snapshot')
      .select('symbol')
      .order('social_volume_24h', { ascending: false })
      .limit(20);
    
    const trendingSymbols = trending?.map(t => t.symbol) || [];
    
    // Combine priority + trending (deduplicated)
    const symbolsToWarm = [...new Set([...PRIORITY_SYMBOLS, ...trendingSymbols])].slice(0, 25);
    
    console.log(`[warm-derivs-cache] Warming ${symbolsToWarm.length} symbols`);
    
    // Check which symbols are stale (older than 5 min)
    const staleThreshold = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    
    const { data: cached } = await supabase
      .from('derivatives_cache')
      .select('symbol, updated_at')
      .in('symbol', symbolsToWarm);
    
    const freshSymbols = new Set(
      (cached || [])
        .filter((c: any) => c.updated_at > staleThreshold)
        .map((c: any) => c.symbol)
    );
    
    const needsRefresh = symbolsToWarm.filter(s => !freshSymbols.has(s));
    
    console.log(`[warm-derivs-cache] ${freshSymbols.size} fresh, ${needsRefresh.length} need refresh`);
    
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
    
    // Fetch from CoinGlass in batches
    const results: any[] = [];
    
    for (const symbol of needsRefresh.slice(0, 10)) { // Max 10 per run to stay within limits
      try {
        const response = await fetch(
          `https://open-api.coinglass.com/public/v2/funding?symbol=${symbol}&time_type=h8`,
          { headers: { 'coinglassSecret': coinglassKey } }
        );
        
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.data?.length > 0) {
            const latest = data.data[0];
            results.push({
              symbol,
              funding_rate: parseFloat(latest.fundingRate) || 0,
              open_interest: parseFloat(latest.openInterest) || 0,
              liquidations_24h: { long: 0, short: 0, total: 0 },
              source: 'coinglass',
              updated_at: new Date().toISOString(),
            });
          }
        }
      } catch (e) {
        console.error(`[warm-derivs-cache] Error for ${symbol}:`, e);
      }
      
      // Small delay to avoid rate limits
      await new Promise(r => setTimeout(r, 200));
    }
    
    // Upsert results
    if (results.length > 0) {
      const { error } = await supabase
        .from('derivatives_cache')
        .upsert(results, { onConflict: 'symbol' });
      
      if (error) {
        console.error('[warm-derivs-cache] Upsert error:', error);
      }
    }
    
    console.log(`[warm-derivs-cache] Refreshed ${results.length} symbols in ${Date.now() - startTime}ms`);
    
    return new Response(JSON.stringify({
      success: true,
      stats: {
        total: symbolsToWarm.length,
        fresh: freshSymbols.size,
        refreshed: results.length,
      },
      duration_ms: Date.now() - startTime,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
    
  } catch (e) {
    console.error("[warm-derivs-cache] Fatal error:", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
