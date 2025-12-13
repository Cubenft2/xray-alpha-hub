import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TTL_SEC = {
  stock_details: 86400,   // 24h
  crypto_details: 86400,  // 24h
};

const LOCK_TTL_MS = 25_000; // 25s lock to prevent stampede

function ageSec(ts?: string | null): number {
  if (!ts) return Infinity;
  return (Date.now() - new Date(ts).getTime()) / 1000;
}

function isFresh(ts: string | null | undefined, ttl: number): boolean {
  return ageSec(ts) <= ttl;
}

function normSymbol(s: string): string {
  return s.trim().toUpperCase();
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  const body = await req.json().catch(() => ({}));
  const symbol = normSymbol(body.symbol || "");
  const type = (body.type || "").toLowerCase(); // "stock" | "crypto" or empty

  if (!symbol) {
    return new Response(JSON.stringify({ error: "Missing symbol" }), {
      status: 400,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  console.log(`[asset-details] Request for symbol=${symbol}, type=${type || "auto"}`);

  const now = new Date();

  // ---- Decide type FIRST (before lock key) ----
  let resolvedType: "stock" | "crypto" | "forex" = "crypto";

  if (type === "stock" || type === "crypto" || type === "forex") {
    resolvedType = type as "stock" | "crypto" | "forex";
  } else {
    // Check for forex pattern first (EUR/USD or EURUSD or C:EURUSD)
    const forexPattern = /^(C:)?[A-Z]{3}\/?[A-Z]{3}$/;
    if (forexPattern.test(symbol)) {
      resolvedType = "forex";
    } else {
      // Heuristic: 1-5 uppercase letters = stock, else crypto
      const looksStocky = /^[A-Z]{1,5}$/.test(symbol);
      if (looksStocky) {
        // Double-check: if it's in live_prices with X: prefix, it's actually crypto
        const { data: maybeCrypto } = await supabase
          .from("live_prices")
          .select("ticker")
          .eq("ticker", `X:${symbol}USD`)
          .maybeSingle();
        resolvedType = maybeCrypto?.ticker ? "crypto" : "stock";
      } else {
        resolvedType = "crypto";
      }
    }
  }

  console.log(`[asset-details] Resolved type=${resolvedType}`);

  // Lock key uses resolvedType (not request type) to prevent collision
  const lockKey = `asset_details_lock:${resolvedType}:${symbol}`;

  // ---- Helper: SWR lock check ----
  async function lockIsActive(): Promise<boolean> {
    const { data } = await supabase
      .from("cache_kv")
      .select("expires_at")
      .eq("k", lockKey)
      .maybeSingle();
    return !!(data?.expires_at && new Date(data.expires_at) > now);
  }

  async function acquireLock(): Promise<void> {
    await supabase.from("cache_kv").upsert({
      k: lockKey,
      v: { refreshing: true, started_at: now.toISOString() },
      expires_at: new Date(now.getTime() + LOCK_TTL_MS).toISOString(),
    });
  }

  async function releaseLock(): Promise<void> {
    await supabase.from("cache_kv").delete().eq("k", lockKey);
  }

  // =========================
  // STOCK ROUTE
  // =========================
  if (resolvedType === "stock") {
    const { data: cached } = await supabase
      .from("company_details")
      .select("*")
      .eq("ticker", symbol)
      .maybeSingle();

    const fresh = cached?.updated_at && isFresh(cached.updated_at, TTL_SEC.stock_details);

    if (!cached || !fresh) {
      // SWR: if lock active, return stale immediately
      if (cached && (await lockIsActive())) {
        console.log(`[asset-details] Returning stale stock data (SWR lock active)`);
        return new Response(JSON.stringify({
          symbol,
          type: "stock",
          name: cached?.name ?? null,
          description: cached?.description ?? null,
          sector: cached?.sector ?? null,
          industry: cached?.industry ?? null,
          market_cap: cached?.market_cap ?? null,
          employees: cached?.employees ?? null,
          headquarters: cached?.headquarters ?? null,
          website: cached?.website ?? null,
          logo_url: cached?.logo_url ?? null,
          last_financials: cached?.last_financials ?? null,
          dividends: cached?.dividends ?? null,
          splits: cached?.splits ?? null,
          related_companies: cached?.related_companies ?? null,
          source: ["polygon"],
          cached: true,
          as_of: cached?.updated_at ?? null,
          age_seconds: cached?.updated_at ? Math.round(ageSec(cached.updated_at)) : null,
          stale: true,
          swr: true,
        }), { headers: { ...CORS_HEADERS, "Content-Type": "application/json" } });
      }

      await acquireLock();
      try {
        console.log(`[asset-details] Refreshing stock data via polygon-company-details`);
        await fetch(`${supabaseUrl}/functions/v1/polygon-company-details`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${serviceKey}`,
          },
          body: JSON.stringify({ ticker: symbol }),
        }).catch((e) => console.error(`[asset-details] polygon-company-details error:`, e));
      } finally {
        await releaseLock();
      }
    }

    const { data: post } = await supabase
      .from("company_details")
      .select("*")
      .eq("ticker", symbol)
      .maybeSingle();

    return new Response(JSON.stringify({
      symbol,
      type: "stock",
      name: post?.name ?? null,
      description: post?.description ?? null,
      sector: post?.sector ?? null,
      industry: post?.industry ?? null,
      market_cap: post?.market_cap ?? null,
      employees: post?.employees ?? null,
      headquarters: post?.headquarters ?? null,
      website: post?.website ?? null,
      logo_url: post?.logo_url ?? null,
      last_financials: post?.last_financials ?? null,
      dividends: post?.dividends ?? null,
      splits: post?.splits ?? null,
      related_companies: post?.related_companies ?? null,
      source: ["polygon"],
      cached: true,
      as_of: post?.updated_at ?? null,
      age_seconds: post?.updated_at ? Math.round(ageSec(post.updated_at)) : null,
      stale: post?.updated_at ? !isFresh(post.updated_at, TTL_SEC.stock_details) : true,
    }), { headers: { ...CORS_HEADERS, "Content-Type": "application/json" } });
  }

  // =========================
  // FOREX ROUTE
  // =========================
  if (resolvedType === "forex") {
    // Extract raw symbol from various formats
    let rawSymbol = symbol.replace("C:", "").replace("/", "");
    const displaySymbol = rawSymbol.length === 6 
      ? `${rawSymbol.slice(0, 3)}/${rawSymbol.slice(3)}` 
      : rawSymbol;
    const baseCurrency = rawSymbol.length >= 3 ? rawSymbol.slice(0, 3) : null;
    const quoteCurrency = rawSymbol.length >= 6 ? rawSymbol.slice(3, 6) : null;

    // Get latest price from live_prices
    const { data: priceData } = await supabase
      .from("live_prices")
      .select("price, change24h, updated_at, day_open, day_high, day_low")
      .eq("ticker", `C:${rawSymbol}`)
      .maybeSingle();

    // Get forex pair info if available
    const { data: pairInfo } = await supabase
      .from("poly_fx_pairs")
      .select("name, base_currency, quote_currency")
      .eq("ticker", `C:${rawSymbol}`)
      .maybeSingle();

    return new Response(JSON.stringify({
      symbol: displaySymbol,
      type: "forex",
      base_currency: baseCurrency,
      quote_currency: quoteCurrency,
      name: pairInfo?.name || displaySymbol,
      price: priceData?.price ?? null,
      change_24h: priceData?.change24h ?? null,
      day_open: priceData?.day_open ?? null,
      day_high: priceData?.day_high ?? null,
      day_low: priceData?.day_low ?? null,
      source: ["massive"],
      cached: true,
      as_of: priceData?.updated_at ?? null,
      notes: "Forex data from Massive (Polygon.io) API",
    }), { headers: { ...CORS_HEADERS, "Content-Type": "application/json" } });
  }

  // =========================
  // CRYPTO ROUTE
  // =========================
  // 1) Find coingecko_id via cg_master (using cg_id column)
  // cg_master stores symbols in lowercase, so query with exact match
  const symbolLower = symbol.toLowerCase();
  const { data: cg } = await supabase
    .from("cg_master")
    .select("cg_id, symbol, name")
    .eq("symbol", symbolLower)
    .limit(5);

  // Take the first exact match (should be unique for most symbols)
  const match = (cg || [])[0] || null;
  const coingeckoId = match?.cg_id || null;

  console.log(`[asset-details] cg_master lookup: found ${cg?.length || 0} matches, coingeckoId=${coingeckoId}`);

  // 2) Read crypto_details cache
  const { data: cached } = await supabase
    .from("crypto_details")
    .select("*")
    .eq("symbol", symbol)
    .maybeSingle();

  const fresh = cached?.expires_at && new Date(cached.expires_at) > now;

  // 3) If missing/stale -> SWR refresh
  if ((!cached || !fresh) && coingeckoId) {
    if (cached && (await lockIsActive())) {
      console.log(`[asset-details] Returning stale crypto data (SWR lock active)`);
      // Merge social data
      const { data: social } = await supabase
        .from("crypto_snapshot")
        .select("galaxy_score, alt_rank, sentiment, social_volume_24h, updated_at")
        .eq("symbol", symbol)
        .maybeSingle();

      return new Response(JSON.stringify({
        symbol,
        type: "crypto",
        coingecko_id: cached?.coingecko_id ?? coingeckoId,
        name: cached?.name ?? match?.name ?? null,
        description: cached?.description ?? null,
        categories: cached?.categories ?? [],
        links: cached?.links ?? {},
        image: cached?.image ?? {},
        supply: cached?.supply ?? {},
        market: cached?.market ?? {},
        social: social ? {
          galaxy_score: social.galaxy_score,
          alt_rank: social.alt_rank,
          sentiment: social.sentiment,
          social_volume_24h: social.social_volume_24h,
          updated_at: social.updated_at,
        } : null,
        source: ["coingecko", "lunarcrush"],
        cached: true,
        as_of: cached?.updated_at ?? null,
        age_seconds: cached?.updated_at ? Math.round(ageSec(cached.updated_at)) : null,
        stale: true,
        swr: true,
      }), { headers: { ...CORS_HEADERS, "Content-Type": "application/json" } });
    }

    await acquireLock();
    try {
      const cgKey = Deno.env.get("COINGECKO_API_KEY");
      const url = `https://api.coingecko.com/api/v3/coins/${coingeckoId}?localization=false&tickers=false&market_data=true&community_data=true&developer_data=true&sparkline=false`;

      console.log(`[asset-details] Fetching CoinGecko data for ${coingeckoId}`);
      const res = await fetch(url, {
        headers: cgKey ? { "x-cg-pro-api-key": cgKey } : {},
      });

      if (res.ok) {
        const d = await res.json();

        const payload = {
          symbol,
          coingecko_id: coingeckoId,
          name: d?.name ?? match?.name ?? null,
          description: d?.description?.en ?? null,
          categories: Array.isArray(d?.categories) ? d.categories : [],
          links: d?.links ?? {},
          image: d?.image ?? {},
          market: {
            market_cap: d?.market_data?.market_cap?.usd ?? null,
            fdv: d?.market_data?.fully_diluted_valuation?.usd ?? null,
          },
          supply: {
            circulating: d?.market_data?.circulating_supply ?? null,
            total: d?.market_data?.total_supply ?? null,
            max: d?.market_data?.max_supply ?? null,
          },
          developer: d?.developer_data ?? {},
          community: d?.community_data ?? {},
          source: "coingecko",
          updated_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + TTL_SEC.crypto_details * 1000).toISOString(),
        };

        await supabase.from("crypto_details").upsert(payload, { onConflict: "symbol" });
        console.log(`[asset-details] Cached crypto_details for ${symbol}`);
      } else {
        console.error(`[asset-details] CoinGecko API error: ${res.status} ${res.statusText}`);
      }
    } catch (e) {
      console.error(`[asset-details] CoinGecko fetch error:`, e);
    } finally {
      await releaseLock();
    }
  }

  // 4) Read post-refresh cache + merge LunarCrush social
  const { data: post } = await supabase
    .from("crypto_details")
    .select("*")
    .eq("symbol", symbol)
    .maybeSingle();

  const { data: social } = await supabase
    .from("crypto_snapshot")
    .select("galaxy_score, alt_rank, sentiment, social_volume_24h, updated_at, categories")
    .eq("symbol", symbol)
    .maybeSingle();

  return new Response(JSON.stringify({
    symbol,
    type: "crypto",
    coingecko_id: post?.coingecko_id ?? coingeckoId,
    name: post?.name ?? match?.name ?? null,
    description: post?.description ?? null,
    categories: (post?.categories?.length ? post.categories : (social?.categories ?? [])),
    links: post?.links ?? {},
    image: post?.image ?? {},
    supply: post?.supply ?? {},
    market: post?.market ?? {},
    social: social ? {
      galaxy_score: social.galaxy_score,
      alt_rank: social.alt_rank,
      sentiment: social.sentiment,
      social_volume_24h: social.social_volume_24h,
      updated_at: social.updated_at,
    } : null,
    source: ["coingecko", "lunarcrush"].filter(Boolean),
    cached: true,
    as_of: post?.updated_at ?? null,
    age_seconds: post?.updated_at ? Math.round(ageSec(post.updated_at)) : null,
    stale: post?.expires_at ? !(new Date(post.expires_at) > now) : true,
    notes: !coingeckoId ? "No coingecko_id match in cg_master for this symbol." : undefined,
  }), { headers: { ...CORS_HEADERS, "Content-Type": "application/json" } });
});
