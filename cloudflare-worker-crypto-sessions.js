var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// Crypto-focused market brief worker with premarket/postmarket sessions
var worker_default = {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "access-control-allow-origin": "*",
          "access-control-allow-methods": "GET,POST,OPTIONS",
          "access-control-allow-headers": "Content-Type,User-Agent,Authorization",
          "access-control-max-age": "86400"
        }
      });
    }
    const withCORS = /* @__PURE__ */ __name((body, init = {}) => new Response(body, {
      ...init,
      headers: {
        "access-control-allow-origin": "*",
        "access-control-allow-methods": "GET,POST,OPTIONS",
        "cache-control": "no-cache",
        ...init.headers || {}
      }
    }), "withCORS");
    const json = /* @__PURE__ */ __name((obj, status = 200) => withCORS(JSON.stringify(obj, null, 2), {
      status,
      headers: { "content-type": "application/json; charset=utf-8" }
    }), "json");
    
    // Crypto-first allowed hosts
    const ALLOW = [
      // Crypto sources - PRIMARY FOCUS
      "coindesk.com", "cointelegraph.com", "theblock.co", "decrypt.co", "messari.io", "cryptoslate.com",
      "bitcoinmagazine.com", "blockworks.co", "thedefiant.io", "protos.com", "ambcrypto.com", "beincrypto.com",
      "coingape.com", "chain.link", "coinpedia.org", "cryptopotato.com", "coinmarketcap.com", "coingecko.com",
      // Traditional finance (crypto-relevant only)
      "reuters.com", "cnbc.com", "foxbusiness.com", "apnews.com", "finance.yahoo.com", "marketwatch.com",
      // Macro (affecting crypto)
      "federalreserve.gov", "bls.gov", "bea.gov", "home.treasury.gov", "sec.gov"
    ];
    
    const isAllowedHost = /* @__PURE__ */ __name((h) => ALLOW.some((dom) => h === dom || h.endsWith("." + dom)), "isAllowedHost");
    const escapeHtml = /* @__PURE__ */ __name((s = "") => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]), "escapeHtml");
    
    if (url.pathname === "/health") {
      return json({ ok: true, service: "xraycrypto-news-crypto-sessions", time: (/* @__PURE__ */ new Date()).toISOString() });
    }
    
    if (url.pathname === "/marketbrief/feed/index.json") {
      const feed = await env.MARKET_KV.get("feed:index", { type: "json" }) || { latest: null, items: [] };
      return json(feed);
    }
    
    if (url.pathname.startsWith("/marketbrief/briefs/") && url.pathname.endsWith(".json")) {
      const slug = url.pathname.split("/").pop().replace(".json", "");
      const brief = await env.MARKET_KV.get(`brief:${slug}`, { type: "json" });
      if (!brief) return json({ error: "not found" }, 404);
      return json(brief);
    }
    
    if (url.pathname === "/marketbrief/latest.json") {
      const feed = await env.MARKET_KV.get("feed:index", { type: "json" });
      if (!feed?.latest) return json({ error: "no-latest" }, 404);
      const brief = await env.MARKET_KV.get(`brief:${feed.latest}`, { type: "json" });
      if (!brief) return json({ error: "not-found" }, 404);
      return json(brief);
    }
    
    // Handle session-specific briefs: 2025-09-26-premarket.json or 2025-09-26-postmarket.json
    if (/^\/marketbrief\/\d{4}-\d{2}-\d{2}(-premarket|-postmarket)?\.json$/.test(url.pathname)) {
      const slug = url.pathname.slice("/marketbrief/".length).replace(".json", "");
      let brief = await env.MARKET_KV.get(`brief:${slug}`, { type: "json" });
      
      // Fallback: if no session specified, try to get the latest session for that date
      if (!brief && !slug.includes('-premarket') && !slug.includes('-postmarket')) {
        const postmarketSlug = `${slug}-postmarket`;
        const premarketSlug = `${slug}-premarket`;
        brief = await env.MARKET_KV.get(`brief:${postmarketSlug}`, { type: "json" }) ||
               await env.MARKET_KV.get(`brief:${premarketSlug}`, { type: "json" });
      }
      
      if (!brief) return json({ error: "not-found" }, 404);
      return json(brief);
    }
    
    if (url.pathname === "/marketbrief/generate" && request.method === "POST") {
      try {
        const body = await request.text();
        const { session } = body ? JSON.parse(body) : {};
        const result = await generateAndStoreBrief(env, session);
        return json({ ok: true, slug: result.slug, keys: result.keys, session: result.session });
      } catch (err) {
        return json({ ok: false, error: String(err) }, 500);
      }
    }
    
    // Default fallback
    return json({ error: "endpoint not found" }, 404);
  },
  
  // Scheduled function runs twice daily: premarket (9 AM UTC) and postmarket (9 PM UTC)
  async scheduled(event, env, ctx) {
    const now = new Date();
    const hour = now.getUTCHours();
    
    // Determine session based on time
    let session;
    if (hour >= 8 && hour <= 15) {
      session = 'premarket';  // 8 AM - 3 PM UTC (covers Asian/European premarket)
    } else {
      session = 'postmarket'; // 4 PM - 7 AM UTC (covers US market close and overnight)
    }
    
    ctx.waitUntil(generateAndStoreBrief(env, session).catch((err) => {
      console.error(`Scheduled ${session} brief generation failed:`, err);
    }));
  }
};

async function generateAndStoreBrief(env, session = null) {
  const today = new Date();
  const yyyy = today.getUTCFullYear();
  const mm = String(today.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(today.getUTCDate()).padStart(2, "0");
  
  // Auto-detect session if not provided
  if (!session) {
    const hour = today.getUTCHours();
    session = (hour >= 8 && hour <= 15) ? 'premarket' : 'postmarket';
  }
  
  const slug = `${yyyy}-${mm}-${dd}-${session}`;
  console.log(`Generating ${session} brief with slug: ${slug}`);
  
  // CRYPTO-FIRST NEWS FEEDS - prioritize crypto sources
  const FEEDS = {
    crypto: [
      "https://www.coindesk.com/arc/outboundfeeds/rss/",
      "https://cointelegraph.com/rss",
      "https://www.theblock.co/rss.xml",
      "https://decrypt.co/feed",
      "https://messari.io/rss",
      "https://blog.chain.link/feed/",
      "https://cryptoslate.com/feed/",
      "https://bitcoinmagazine.com/feed",
      "https://blockworks.co/feeds/rss",
      "https://thedefiant.io/feed",
      "https://protos.com/feed/",
      "https://ambcrypto.com/feed/",
      "https://beincrypto.com/feed/",
      "https://coingape.com/feed/",
      "https://coinpedia.org/feed/",
      "https://cryptopotato.com/feed/"
    ],
    // Only include traditional finance sources that regularly cover crypto
    markets: [
      "https://www.reuters.com/markets/us/rss",
      "https://www.cnbc.com/id/100003114/device/rss/rss.html",
      "https://feeds.foxbusiness.com/foxbusiness/latest",
      "https://finance.yahoo.com/news/rssindex"
    ],
    // Macro events that significantly affect crypto
    macro: [
      "https://www.federalreserve.gov/feeds/press_all.xml",
      "https://www.bls.gov/feed/news_release.rss",
      "https://www.sec.gov/cgi-bin/browse-edgar?action=getcurrent&type=8-K&output=atom"
    ]
  };

  const ALLOW = [
    "coindesk.com", "cointelegraph.com", "theblock.co", "decrypt.co", "messari.io", "chain.link", "cryptoslate.com",
    "bitcoinmagazine.com", "blockworks.co", "thedefiant.io", "protos.com", "ambcrypto.com", "beincrypto.com", 
    "coingape.com", "coinpedia.org", "cryptopotato.com", "reuters.com", "cnbc.com", "foxbusiness.com", 
    "finance.yahoo.com", "federalreserve.gov", "bls.gov", "sec.gov"
  ];

  const isAllowedHost = (h) => ALLOW.some((dom) => h === dom || h.endsWith("." + dom));

  async function fetchFeed(u) {
    try {
      const host = new URL(u).hostname.replace(/^www\./, "");
      if (!isAllowedHost(host)) return [];
      const res = await fetch(u, { 
        headers: { "User-Agent": "XRCryptoBot/2.0" },
        cf: { timeout: 10000 }
      });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const text = await res.text();
      const doc = new DOMParser().parseFromString(text, "text/xml");
      const items = [];
      
      // RSS format
      doc.querySelectorAll("item").forEach((it) => {
        const title = it.querySelector("title")?.textContent?.trim() || "";
        const link = it.querySelector("link")?.textContent?.trim() || "";
        const pub = it.querySelector("pubDate")?.textContent || "";
        const date = pub ? new Date(pub) : new Date();
        const source = new URL(link || u).hostname.replace(/^www\./, "");
        if (title && (link || u)) items.push({ title, link, date: +date, source });
      });
      
      // Atom format
      doc.querySelectorAll("entry").forEach((it) => {
        const title = it.querySelector("title")?.textContent?.trim() || "";
        const link = it.querySelector("link")?.getAttribute("href") || "";
        const pub = it.querySelector("updated")?.textContent || it.querySelector("published")?.textContent || "";
        const date = pub ? new Date(pub) : new Date();
        const source = new URL(link || u).hostname.replace(/^www\./, "");
        if (title && (link || u)) items.push({ title, link, date: +date, source });
      });
      
      return items.filter((x) => isAllowedHost((x.source || "").replace(/^www\./, "")));
    } catch (err) {
      console.error(`Feed fetch failed for ${u}:`, err.message);
      return [];
    }
  }

  // Prioritize crypto feeds heavily - fetch crypto feeds twice
  const toFetch = [
    ...FEEDS.crypto, 
    ...FEEDS.crypto, // Double crypto content
    ...FEEDS.markets, 
    ...FEEDS.macro
  ];
  
  const MAX = 5, chunks = [];
  for (let i = 0; i < toFetch.length; i += MAX) chunks.push(toFetch.slice(i, i + MAX));
  
  let allNews = [];
  for (const group of chunks) {
    const results = await Promise.all(group.map(fetchFeed));
    for (const arr of results) allNews.push(...arr);
  }

  // Remove duplicates
  const seen = new Set();
  allNews = allNews.filter((x) => {
    const key = x.link || "t:" + x.title;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Crypto-first sorting: heavily prioritize crypto sources
  const cryptoSources = ["coindesk", "cointelegraph", "theblock", "decrypt", "messari", "cryptoslate", "bitcoinmagazine", "blockworks", "thedefiant"];
  allNews.sort((a, b) => {
    const aCrypto = cryptoSources.some(cs => (a.source || "").includes(cs));
    const bCrypto = cryptoSources.some(cs => (b.source || "").includes(cs));
    
    if (aCrypto && !bCrypto) return -1;
    if (!aCrypto && bCrypto) return 1;
    return b.date - a.date; // Then sort by recency
  });

  // Get top 35 items for better content
  const items = allNews
    .slice(0, 35)
    .map(item => ({
      title: item.title,
      url: item.link,
      source: item.source,
      published_at: new Date(item.date).toISOString()
    }));

  console.log(`Fetched ${items.length} news items for ${session} brief`);

  // Session-specific context and focus
  const sessionContext = session === 'premarket' 
    ? "This is the PREMARKET crypto brief (before US markets open). Focus on overnight crypto price movements, Asian market developments, major news that broke overnight, and key events/data to watch as US markets open. Target crypto traders preparing for the US session."
    : "This is the POSTMARKET crypto brief (after US markets close). Focus on how the day's events affected crypto markets, evening developments, regulatory news, and overnight/tomorrow setup. Target crypto traders reviewing the day and planning ahead.";

  const systemPrompt = `You are a crypto-native analyst who gets it. Write like someone who's been in this space, speaks the language, and knows what retail traders actually care about.

${sessionContext}

Write a 4-5 paragraph crypto market brief with this vibe:

🔥 PERSONALITY & TONE:
- Write like you're texting a crypto friend who knows their stuff
- Use crypto slang naturally (HODL, diamond hands, paper hands, ape, moon, rekt, etc.)
- Be conversational but informed - like you've got alpha to share
- Show genuine excitement about good moves, frustration about bad ones
- Call out obvious BS and hype when you see it

🚀 CRYPTO-FIRST EVERYTHING:
- Lead with BTC/ETH price action and what it means for the space
- Cover altcoin narratives, DeFi plays, meme coin chaos, NFT drama
- Layer-2 developments, new protocols, airdrops, governance votes
- Traditional markets only matter when they're moving crypto

📊 SESSION VIBES:
- PREMARKET: "What happened while we slept?" - overnight moves, Asia action, prep for US session
- POSTMARKET: "How'd we do today?" - review performance, what's next, overnight setup

✍️ WRITING STYLE:
- Start paragraphs with energy ("BTC just..." "Ethereum traders..." "Meanwhile in DeFi...")
- Include real numbers (prices, percentages, volumes) but make them hit different
- Reference crypto Twitter sentiment, whale moves, on-chain data
- End with a spicy "Last Word" that crypto natives will relate to

🎯 STRUCTURE:
1. Hook with biggest crypto move/news of the session
2. BTC/ETH analysis with specific price levels and what they mean
3. Altcoin/DeFi/narrative plays - what's hot, what's not
4. Macro stuff (Fed, regulations) but only as it affects our bags
5. Forward look - what to watch, where the alpha might be

Return JSON with: title, summary, article_html, last_word, focus_assets (array like ["BTC", "ETH", "SOL", "MATIC"])`;
  
  const userPrompt = `${sessionContext}

Fresh headlines from crypto and relevant market sources (prioritized for crypto content):

${JSON.stringify(items.slice(0, 25), null, 2)}

Create a crypto-focused market analysis using these headlines. Focus on actionable insights for crypto traders.`;

  const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0.7,
      max_tokens: 1500,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      response_format: { type: "json_object" }
    })
  });

  if (!openaiRes.ok) {
    const text = await openaiRes.text();
    throw new Error(`OpenAI API error ${openaiRes.status}: ${text}`);
  }

  const data = await openaiRes.json();
  let content;
  try {
    content = JSON.parse(data.choices?.[0]?.message?.content || "{}");
  } catch (parseErr) {
    console.error("Failed to parse OpenAI response:", parseErr);
    content = { 
      title: `Crypto Market Brief — ${session === 'premarket' ? 'Premarket Alert' : 'Market Close'} — ${yyyy}-${mm}-${dd}`, 
      summary: "Crypto market analysis and key developments.", 
      article_html: "<p>Crypto market analysis temporarily unavailable. Check back soon for the latest updates.</p>", 
      last_word: "Stay crypto-curious and trade wisely!",
      focus_assets: ["BTC", "ETH", "SOL"]
    };
  }

  const sessionLabel = session === 'premarket' ? 'Premarket Alert' : 'Market Close';
  
  const brief = {
    slug,
    date: `${yyyy}-${mm}-${dd}`,
    session,
    title: content.title || `Crypto Market Brief — ${sessionLabel} — ${yyyy}-${mm}-${dd}`,
    summary: content.summary || "Daily crypto market analysis and key developments.",
    article_html: content.article_html || "<p>Crypto market analysis coming soon.</p>",
    last_word: content.last_word || "Keep stacking sats and stay informed! 🚀",
    focus_assets: content.focus_assets || ["BTC", "ETH", "SOL"],
    social_text: `🚀 ${sessionLabel}: ${(content.summary || 'Crypto market update').slice(0, 120)}... #Crypto #Bitcoin #DeFi`,
    author: "XRayCrypto News",
    og_image: `https://xraycrypto.io/marketbrief/charts/${yyyy}-${mm}-${dd}/og_cover_${session}.png`,
    canonical: `https://xraycrypto-news.xrprat.workers.dev/marketbrief/${slug}`,
    generated_at: new Date().toISOString(),
    sources: items.slice(0, 20).map((i) => ({ label: i.source || "source", url: i.url }))
  };

  // Store the brief
  await env.MARKET_KV.put(`brief:${slug}`, JSON.stringify(brief), {
    expirationTtl: 60 * 60 * 24 * 90 // 90 days retention
  });

  console.log(`Stored brief: ${slug}`);

  // Update feed index to point to latest brief
  const feedKey = "feed:index";
  const feed = await env.MARKET_KV.get(feedKey, { type: "json" }) || { latest: null, items: [] };
  const newItems = [
    { 
      slug, 
      title: brief.title, 
      date: brief.date, 
      session: brief.session, 
      canonical: brief.canonical,
      generated_at: brief.generated_at
    }, 
    ...(feed.items || [])
  ].filter(Boolean).slice(0, 100); // Keep last 100 briefs
  
  await env.MARKET_KV.put(feedKey, JSON.stringify({ 
    latest: slug, 
    items: newItems 
  }));

  console.log(`Updated feed index with latest: ${slug}`);
  return { slug, keys: [`brief:${slug}`, "feed:index"], session };
}
__name(generateAndStoreBrief, "generateAndStoreBrief");

export {
  worker_default as default
};