import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    let data: SocialAsset[] = [];

    if (lunarKey) {
      console.log("🌙 Fetching LunarCrush galaxy scores...");
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
          sentiment: Number(a.sentiment || 0),
          social_volume: Number(a.social_volume || 0),
          social_dominance: Number(a.social_dominance || 0),
          fomo_score: Number(a.alt_rank || 0),
        }));
        console.log(`✅ LunarCrush returned ${data.length} assets`);
      } else {
        console.error("❌ LunarCrush error:", resp.status, await resp.text());
      }
    } else {
      console.warn("⚠️ No LUNARCRUSH_API_KEY set. Using CoinGecko trending fallback.");
    }

    // Fallback if LunarCrush missing/failed
    if (data.length === 0) {
      console.log("🔁 Using CoinGecko trending fallback for galaxy-like scores...");
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
          } as SocialAsset;
        });
        console.log(`✅ CoinGecko fallback produced ${data.length} assets`);
      } else {
        console.error("❌ CoinGecko trending error:", cg.status, await cg.text());
      }
    }

    return new Response(JSON.stringify({ data }), {
      headers: { "Content-Type": "application/json", ...corsHeaders },
      status: 200,
    });
  } catch (e) {
    console.error("❌ social-sentiment function failed:", e);
    return new Response(JSON.stringify({ data: [], error: "internal_error" }), {
      headers: { "Content-Type": "application/json", ...corsHeaders },
      status: 500,
    });
  }
});