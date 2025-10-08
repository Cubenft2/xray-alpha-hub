import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const lunarKey = Deno.env.get("LUNARCRUSH_API_KEY");

interface SocialAsset {
  name: string;
  symbol: string;
  galaxy_score: number;
  sentiment: number;
  social_volume: number;
  social_dominance: number;
  fomo_score: number;
  alt_rank?: number;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    let data: SocialAsset[] = [];
    let dataSource = 'unknown';
    let lastUpdated: string | null = null;

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. Try database cache first (fastest)
    console.log('🔄 Checking database cache...');
    try {
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
      
      const { data: cachedData, error: cacheError } = await supabase
        .from('social_sentiment_cache')
        .select('data, generated_at, received_at')
        .eq('is_active', true)
        .gte('received_at', twoHoursAgo)
        .order('received_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (cacheError) {
        console.error('❌ Cache query error:', cacheError);
      } else if (cachedData) {
        data = cachedData.data as SocialAsset[];
        lastUpdated = cachedData.received_at;
        dataSource = 'database_cache';
        console.log(`✅ Using cached data (${data.length} assets, updated: ${lastUpdated})`);
      } else {
        console.log('⚠️ No recent cache found (< 2 hours)');
      }
    } catch (cacheError) {
      console.error('❌ Database cache check failed:', cacheError);
    }

    // 2. Fallback to LunarCrush API if cache empty/stale
    if (data.length === 0 && lunarKey) {
      console.log("🌙 Fetching from LunarCrush API...");
      const resp = await fetch(
        "https://lunarcrush.com/api4/public/coins/list/v2?limit=20&sort=galaxy_score",
        { headers: { Authorization: `Bearer ${lunarKey}` } }
      );

      if (resp.ok) {
        const json = await resp.json();
        const items = Array.isArray(json?.data) ? json.data : [];
        data = items.map((a: any) => ({
          name: a.name || a.symbol,
          symbol: String(a.symbol || '').toUpperCase(),
          galaxy_score: Number(a.galaxy_score || 0),
          sentiment: Number(a.sentiment || a.sentiment_score || 0),
          social_volume: Number(a.social_volume || a.social_volume_24h || a.volume_24h || 0),
          social_dominance: Number(a.social_dominance || a.market_dominance || 0),
          fomo_score: Number(a.fomo_score || a.alt_rank || 0),
          alt_rank: Number(a.alt_rank || 999),
        }));
        dataSource = 'lunarcrush_api';
        lastUpdated = new Date().toISOString();
        console.log(`✅ LunarCrush API returned ${data.length} assets`);
      } else {
        console.error("❌ LunarCrush error:", resp.status, await resp.text());
      }
    } else if (data.length === 0) {
      console.warn("⚠️ No LUNARCRUSH_API_KEY set. Skipping API fallback.");
    }

    // 3. Final fallback to CoinGecko trending
    if (data.length === 0) {
      console.log("🔁 Using CoinGecko trending fallback...");
      const cg = await fetch("https://api.coingecko.com/api/v3/search/trending");
      if (cg.ok) {
        const trending = await cg.json();
        const coins = Array.isArray(trending?.coins) ? trending.coins.slice(0, 10) : [];
        data = coins.map((c: any) => {
          const item = c.item || {};
          const rank = Number(item.market_cap_rank || 100);
          const change = Number(item?.data?.price_change_percentage_24h?.usd || 0);
          const base = Math.max(0, Math.min(100, Math.round(100 - rank)));
          const galaxy = Math.max(0, Math.min(100, base + Math.round(change)));
          return {
            name: item.name,
            symbol: String(item.symbol || '').toUpperCase(),
            galaxy_score: galaxy,
            sentiment: change >= 0 ? 60 : 40,
            social_volume: 0,
            social_dominance: 0,
            fomo_score: Math.max(0, Math.min(100, 50 + change)),
            alt_rank: rank,
          } as SocialAsset;
        });
        dataSource = 'coingecko_trending';
        lastUpdated = new Date().toISOString();
        console.log(`✅ CoinGecko fallback produced ${data.length} assets`);
      } else {
        console.error("❌ CoinGecko trending error:", cg.status, await cg.text());
      }
    }

    return new Response(
      JSON.stringify({ 
        data,
        metadata: {
          source: dataSource,
          last_updated: lastUpdated,
          count: data.length
        }
      }), 
      {
        headers: { 
          "Content-Type": "application/json", 
          ...corsHeaders,
          'Cache-Control': 'public, max-age=300' // Cache for 5 minutes
        },
        status: 200,
      }
    );
  } catch (e) {
    console.error("❌ social-sentiment function failed:", e);
    return new Response(
      JSON.stringify({ 
        data: [], 
        error: "internal_error",
        metadata: {
          source: 'error',
          last_updated: null,
          count: 0
        }
      }), 
      {
        headers: { "Content-Type": "application/json", ...corsHeaders },
        status: 500,
      }
    );
  }
});
