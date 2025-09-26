// Cloudflare Worker — XRayCrypto News (aggregate + social, briefs, mix, generator)

// ---------- CORS helpers ----------
const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET,POST,OPTIONS",
  "access-control-allow-headers": "Content-Type,User-Agent,Authorization",
  "cache-control": "no-cache",
};
const ok = (obj, status = 200, headers = {}) =>
  new Response(JSON.stringify(obj, null, 2), { status, headers: { "content-type": "application/json; charset=utf-8", ...CORS, ...headers } });
const txt = (s, status = 200, headers = {}) =>
  new Response(String(s), { status, headers: { "content-type": "text/plain; charset=utf-8", ...CORS, ...headers } });

// ---------- allowlist & feeds ----------
const ALLOW = [
  // Crypto
  "coindesk.com","cointelegraph.com","theblock.co","decrypt.co","messari.io","cryptoslate.com",
  "bitcoinmagazine.com","blockworks.co","thedefiant.io","protos.com","ambcrypto.com",
  "beincrypto.com","coingape.com","chain.link","coinpedia.org","cryptopotato.com","newsbtc.com",

  // Markets / Business
  "reuters.com","cnbc.com","foxbusiness.com","apnews.com","wsj.com","feeds.a.dj.com",
  "finance.yahoo.com","ft.com","rss.cnn.com","nytimes.com","marketwatch.com",
  "moneycontrol.com","theguardian.com","bbc.co.uk","feeds.bbci.co.uk",

  // Macro / Official
  "federalreserve.gov","bls.gov","bea.gov","home.treasury.gov","ecb.europa.eu","bankofengland.co.uk","sec.gov",

  // Social / Buzz
  "reddit.com","www.reddit.com","substack.com","medium.com","github.com",

  // Meta (search)
  "news.google.com",
];
const isAllowed = (h) => ALLOW.some((dom) => h === dom || h.endsWith("." + dom));

const FEEDS = {
  crypto: [
    "https://www.coindesk.com/arc/outboundfeeds/rss/","https://cointelegraph.com/rss","https://www.theblock.co/rss.xml",
    "https://decrypt.co/feed","https://messari.io/rss","https://blog.chain.link/feed/","https://cryptoslate.com/feed/",
    "https://bitcoinmagazine.com/feed","https://blockworks.co/feeds/rss","https://thedefiant.io/feed",
    "https://protos.com/feed/","https://ambcrypto.com/feed/","https://beincrypto.com/feed/","https://coingape.com/feed/",
    "https://coinpedia.org/feed/","https://cryptopotato.com/feed/","https://www.newsbtc.com/feed/",
  ],
  stocks: [
    "https://feeds.a.dj.com/rss/RSSMarketsMain.xml","https://www.reuters.com/markets/us/rss",
    "https://www.cnbc.com/id/100003114/device/rss/rss.html","https://feeds.foxbusiness.com/foxbusiness/latest",
    "https://apnews.com/hub/apf-business?output=rss","https://finance.yahoo.com/news/rssindex",
    "https://www.ft.com/markets/rss","https://rss.cnn.com/rss/money_latest.rss",
    "https://rss.nytimes.com/services/xml/rss/nyt/Business.xml","https://www.marketwatch.com/feeds/topstories",
    "https://www.marketwatch.com/feeds/marketpulse","https://www.moneycontrol.com/rss/business.xml",
    "https://www.moneycontrol.com/rss/marketreports.xml","https://www.moneycontrol.com/rss/economy.xml",
    "https://www.theguardian.com/uk/business/rss","http://feeds.bbci.co.uk/news/business/rss.xml",
  ],
  ipo: [
    "https://www.reuters.com/markets/companies/rss",
    "https://www.cnbc.com/id/10000108/device/rss/rss.html",
    "https://feeds.a.dj.com/rss/RSSWorldNews.xml",
    "https://www.marketwatch.com/feeds/ipowatch",
    "https://finance.yahoo.com/news/rssindex",
    "https://www.ft.com/companies/rss",
    "https://news.google.com/rss/search?q=IPO%20OR%20%22going%20public%22%20OR%20%22public%20offering%22%20crypto%20OR%20blockchain&hl=en-US&gl=US&ceid=US:en",
  ],
  macro: [
    "https://www.reuters.com/world/rss","https://apnews.com/hub/apf-topnews?output=rss",
    "https://news.google.com/rss/search?q=market%20volatility%20OR%20stocks%20selloff%20OR%20crypto%20crash&hl=en-US&gl=US&ceid=US:en",
    "https://www.federalreserve.gov/feeds/press_all.xml","https://www.bls.gov/feed/news_release.rss",
    "https://www.bea.gov/rss.xml","https://home.treasury.gov/rss/press.xml","https://www.ecb.europa.eu/press/rss/press.xml",
    "https://www.bankofengland.co.uk/boeapps/rss/feeds.aspx?feed=News",
    "https://www.sec.gov/cgi-bin/browse-edgar?action=getcurrent&type=8-K&output=atom",
  ],
  social: [
    // Reddit (hot/top via RSS/Atom)
    "https://www.reddit.com/r/CryptoCurrency/.rss",
    "https://www.reddit.com/r/CryptoMarkets/.rss",
    "https://www.reddit.com/r/Bitcoin/.rss",
    "https://www.reddit.com/r/Ethereum/.rss",
    "https://www.reddit.com/r/Solana/.rss",
    "https://www.reddit.com/r/ethfinance/.rss",
    "https://www.reddit.com/r/defi/.rss",

    // Buzz via Google News (narratives / FOMO terms)
    "https://news.google.com/rss/search?q=crypto%20fomo%20OR%20altseason%20OR%20memecoin%20OR%20airdrop&hl=en-US&gl=US&ceid=US:en",
    "https://news.google.com/rss/search?q=bitcoin%20dominance%20OR%20btc%20liquidations%20OR%20funding%20rates&hl=en-US&gl=US&ceid=US:en",
  ],
};

// ---------- RSS fetch & parse ----------
async function fetchFeed(u) {
  try {
    const host = new URL(u).hostname.replace(/^www\./, "");
    if (!isAllowed(host)) return [];
    const res = await fetch(u, { 
      headers: { "User-Agent": "XRNewsWorker/1.0" },
      cf: { timeout: 10000 } // 10 second timeout
    });
    if (!res.ok) throw new Error("HTTP " + res.status);
    const text = await res.text();
    const items = [];
    
    try {
      const doc = new DOMParser().parseFromString(text, "text/xml");
      
      // RSS
      doc.querySelectorAll("item").forEach((it) => {
        const title = it.querySelector("title")?.textContent?.trim() || "";
        const link  = it.querySelector("link")?.textContent?.trim() || "";
        const pub   = it.querySelector("pubDate")?.textContent || it.querySelector("dc\\:date")?.textContent || "";
        const desc  = it.querySelector("description")?.textContent?.trim() || "";
        const date  = pub ? new Date(pub) : new Date();
        const source = new URL(link || u).hostname.replace(/^www\./, "");
        if (title && (link || u)) items.push({ title, link, date: +date, source, description: desc });
      });
      
      // Atom
      doc.querySelectorAll("entry").forEach((it) => {
        const title = it.querySelector("title")?.textContent?.trim() || "";
        const linkEl = it.querySelector("link");
        const link  = linkEl?.getAttribute("href") || linkEl?.textContent?.trim() || "";
        const pub   = it.querySelector("updated")?.textContent || it.querySelector("published")?.textContent || "";
        const desc  = it.querySelector("summary")?.textContent?.trim() || it.querySelector("content")?.textContent?.trim() || "";
        const date  = pub ? new Date(pub) : new Date();
        const source = new URL(link || u).hostname.replace(/^www\./, "");
        if (title && (link || u)) items.push({ title, link, date: +date, source, description: desc });
      });
    } catch (parseError) {
      // console.log(`Parse error for ${u}:`, parseError);
    }

    // Fallback simple regex for quirky feeds
    if (!items.length && /<item[\s>]/i.test(text)) {
      const rx = /<item[\s\S]*?<title[^>]*>([\s\S]*?)<\/title>[\s\S]*?<link[^>]*>([\s\S]*?)<\/link>[\s\S]*?(?:<pubDate[^>]*>([\s\S]*?)<\/pubDate>|<updated[^>]*>([\s\S]*?)<\/updated>)?/gi;
      let m; 
      while ((m = rx.exec(text))) {
        const title = (m[1] || "").replace(/<!\[CDATA\[|\]\]>/g, "").trim();
        const link  = (m[2] || "").replace(/<!\[CDATA\[|\]\]>/g, "").trim();
        const pub   = (m[3] || m[4] || "").trim();
        const date  = pub ? new Date(pub) : new Date();
        if (!isNaN(date.getTime())) { // Valid date check
          const source = new URL(link || u).hostname.replace(/^www\./, "");
          if (title && (link || u)) items.push({ title, link, date: +date, source });
        }
      }
    }

    return items.filter((x) => isAllowed((x.source || "").replace(/^www\./, "")));
  } catch (fetchError) {
    // console.log(`Fetch error for ${u}:`, fetchError);
    return [];
  }
}

async function computeAggregate(sourcesParam, q) {
  const sources = new Set((sourcesParam || "crypto,stocks,macro,social,ipo").toLowerCase().split(",").map(s => s.trim()).filter(Boolean));
  const toFetch = [];
  if (sources.has("crypto")) toFetch.push(...FEEDS.crypto);
  if (sources.has("stocks")) toFetch.push(...FEEDS.stocks);
  if (sources.has("macro"))  toFetch.push(...FEEDS.macro);
  if (sources.has("social")) toFetch.push(...FEEDS.social);
  if (sources.has("ipo"))    toFetch.push(...FEEDS.ipo);

  const MAX = 6, chunks = [];
  for (let i = 0; i < toFetch.length; i += MAX) chunks.push(toFetch.slice(i, i + MAX));

  let all = [];
  for (const group of chunks) {
    const results = await Promise.all(group.map(fetchFeed));
    for (const arr of results) all.push(...arr);
  }

  // dedupe by link and title
  const seen = new Set();
  all = all.filter((x) => {
    const key = (x.link || "").trim() || "t:" + x.title.trim();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // optional keyword filter
  const qLower = (q || "").toLowerCase();
  if (qLower) {
    all = all.filter(
      (x) => x.title.toLowerCase().includes(qLower) || (x.source || "").toLowerCase().includes(qLower)
    );
  }

  // rank
  const now = Date.now();
  const SOURCE_WEIGHT = (host = "") => {
    const h = host.toLowerCase();
    // Top-tier wires / official
    if (h.includes("reuters")) return 1.25;
    if (h.includes("apnews")) return 1.18;
    if (h.includes("federalreserve") || h.includes("bls.gov") || h.includes("bea.gov") || h.includes("sec.gov")) return 1.3;

    // Major business press / crypto trades
    if (h.includes("cnbc") || h.includes("ft.com") || h.includes("wsj.com")) return 1.12;
    if (h.includes("coindesk") || h.includes("cointelegraph") || h.includes("theblock")) return 1.1;

    // Social / community (slightly de-weighted)
    if (h.includes("reddit.com") || h.includes("substack.com") || h.includes("medium.com") || h.includes("github.com")) return 0.92;

    return 1;
  };
  const score = (item) => {
    const ageMin = Math.max(1, (now - item.date) / 60000);
    return (1 / ageMin) * SOURCE_WEIGHT(item.source || "");
  };

  const latest = [...all].sort((a, b) => b.date - a.date).slice(0, 50);
  const top    = [...all].sort((a, b) => score(b) - score(a)).slice(0, 25);
  return { all, latest, top };
}

// ---------- HTML helpers ----------
const escapeHtml = (s = "") =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// ---------- generator ----------
async function generateAndStoreBrief(env, opts = {}) {
  const today = new Date();
  const slug = today.toISOString().slice(0,10);

  // Check for required environment variables
  if (!env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY environment variable is required");
  }
  if (!env.MARKET_KV) {
    throw new Error("MARKET_KV binding is required");
  }

  // Avoid regen unless force
  if (!opts.force) {
    try {
      const existing = await env.MARKET_KV.get(`brief:${slug}`, { type: "json" });
      if (existing) return { slug, regenerated: false };
    } catch (kvError) {
      // console.log("KV check error:", kvError);
    }
  }

  // diversify by default (not just BTC/ETH/SOL)
  const focus = Array.isArray(opts.symbols) && opts.symbols.length
    ? opts.symbols.map(s => s.toUpperCase())
    : (env.FOCUS_ASSETS || "BTC,ETH,SOL,SPX,US10Y,OIL,DXY,EURUSD").split(",").map(s=>s.trim().toUpperCase());

  // Aggregate (now includes social and IPO)
  const agg = await computeAggregate("crypto,stocks,macro,social,ipo", "");
  const items = (agg.top || []).slice(0, 15).map(it => ({
    title: it.title, 
    url: it.link, 
    source: it.source, 
    published_at: new Date(it.date).toISOString(),
    description: it.description || ""
  }));

  // Refined John Oliver-style prompt with fishing metaphors and structured four-part flow
  const systemPrompt = (env.MB_STYLE || `You are a sharp, witty market analyst writing for XRayCrypto News. Think John Oliver explaining markets at the bar—armed with receipts and fishing stories.

🎯 SIGNATURE TONE:
- Lightly sarcastic but never mean-spirited—like explaining why someone's "fishing in shallow water"
- Smart friend who's done their homework and knows how to read the market like reading water
- Call out obvious BS but stay factual—know when institutions are "trolling for suckers" 
- Use "Look," "Here's the thing," "And get this" as natural transitions
- Weave in fishing metaphors naturally: "baiting the hook," "schools of fish," "feeding frenzy," "cut bait and run"
- No corporate fluff—if someone took the bait "hook, line and sinker," just say it
- Contractions everywhere (don't, it's, they're)—you're talking, not writing a thesis

📋 MANDATORY STRUCTURE (Four-Part Flow):
Your article_html MUST follow this exact structure:

<h2>What Happened</h2>
[2-3 paragraphs: The main event(s) that actually matter, stripped of hype]

<h2>Why It Matters</h2>
[2-3 paragraphs: Real-world implications, not speculation—why should anyone care?]

<h2>Market Reaction</h2>
[2-3 paragraphs: How markets actually responded, what the data shows]

<h2>What to Watch Next</h2>
[2-3 paragraphs: Concrete things to monitor, not vague predictions]

🎯 CONTENT RULES:
- **ONLY USE PROVIDED NEWS** - Never invent prices, events, or data
- Fresh fishing analogies—"dead water" vs "feeding frenzy," "caught a big one" vs "threw back the small fry"
- Primary sources (Fed, SEC, company statements) + quality reporting (Reuters, WSJ, CoinDesk)
- If retail's getting played, say they're "trolling for suckers" or got caught "hook, line and sinker"
- If there's genuine innovation, celebrate it—"deep sea fishing" for real opportunities vs "shallow water" plays
- Neutral but never bland—know when "the fish aren't biting" vs when there's a "school moving"
- If there's genuine innovation, celebrate it without the hype
- Neutral but never bland—have a perspective backed by facts

🚀 JSON OUTPUT:
{
  "title": "Market Brief — [Date] — [Key Theme]",
  "summary": "One honest sentence that cuts through the noise",
  "article_html": "[Four-section structure above]",
  "last_word": "One memorable thought that sticks—your signature sign-off",
  "social_text": "Twitter-ready with relevant hashtags",
  "sources": [{"url": "source_url", "label": "Source Name"}],
  "focus_assets": ["BTC", "ETH", "SPX"]
}`)

  const userPrompt = `Date: ${slug}
Focus assets (guidance, not strict): ${focus.join(", ")}

**PRIORITY: Analyze the headlines below and identify the 1-2 MAIN EVENTS that will actually impact crypto/markets. Focus your brief on these major developments, not minor news.**

**IPO & FOMO ANALYSIS: Pay special attention to:**
- Crypto companies going public (IPOs, direct listings)
- New ETF launches or approvals
- When multiple sources cover the same story = potential FOMO moment
- Social sentiment spikes (multiple Reddit/social mentions of same coin)
- Trading volume or interest surges indicated by news clustering

Top Headlines (ranked by relevance and recency):
${JSON.stringify(items, null, 2)}

${opts.notes ? `Additional context: ${opts.notes}` : ""}

**CRITICAL: Only use the real news headlines provided above. Do not invent stories, prices, or events. Base your analysis ONLY on the actual news data listed.**

Generate a comprehensive market brief covering the most significant developments from the provided headlines. Ensure proper JSON formatting.`;

  try {
    const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { 
        Authorization: `Bearer ${env.OPENAI_API_KEY}`, 
        "Content-Type": "application/json" 
      },
      body: JSON.stringify({
        model: env.OPENAI_MODEL || "gpt-4o-mini",
        temperature: 0.5,
        max_tokens: 2000,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt }, 
          { role: "user", content: userPrompt }
        ]
      })
    });
    
    if (!aiRes.ok) {
      const errorText = await aiRes.text();
      throw new Error(`OpenAI ${aiRes.status}: ${errorText}`);
    }
    
    const data = await aiRes.json();
    
    let content;
    try { 
      content = JSON.parse(data.choices?.[0]?.message?.content || "{}"); 
    } catch (parseError) { 
      // console.log("JSON parse error:", parseError);
      content = {}; 
    }

    const brief = {
      slug,
      date: slug,
      title: content.title || `Market Brief — ${slug}`,
      summary: content.summary || "Market analysis for " + slug,
      article_html: content.article_html || "<p>No content generated.</p>",
      last_word: content.last_word || "",
      social_text: content.social_text || `Market Brief for ${slug} - Key developments in crypto and traditional markets.`,
      sources: Array.isArray(content.sources) ? content.sources : [],
      focus_assets: Array.isArray(content.focus_assets) ? content.focus_assets : focus,
      og_image: `https://xraycrypto.io/marketbrief/charts/${slug}/og_cover.png`,
      author: "XRayCrypto News",
      canonical: `https://xraycrypto.io/marketbrief/${slug}`,
      generated_at: new Date().toISOString()
    };

    // Store brief
    await env.MARKET_KV.put(`brief:${slug}`, JSON.stringify(brief), { 
      expirationTtl: 60 * 60 * 24 * 90 // 90 days
    });

    // Update feed index
    const feedKey = "feed:index";
    let feed;
    try {
      feed = (await env.MARKET_KV.get(feedKey, { type: "json" })) || { latest: null, items: [] };
    } catch {
      feed = { latest: null, items: [] };
    }
    
    const newItems = [
      { slug, title: brief.title, date: brief.date, canonical: brief.canonical }, 
      ...(feed.items || [])
    ].slice(0, 50);
    
    await env.MARKET_KV.put(feedKey, JSON.stringify({ 
      latest: slug, 
      items: newItems,
      updated_at: new Date().toISOString()
    }));

    return { slug, regenerated: true };
  } catch (openaiError) {
    // console.log("OpenAI generation error:", openaiError);
    throw new Error(`Brief generation failed: ${openaiError.message}`);
  }
}

// ---------- Worker export ----------
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS")
      return new Response(null, { status: 204, headers: CORS });

    try {
      // Health
      if (url.pathname === "/health")
        return ok({ ok: true, service: "xraycrypto-news", time: new Date().toISOString() });

      // Proxy-fetch for site lists (raw XML)
      if (url.pathname.endsWith("/fetch")) {
        const target = url.searchParams.get("url");
        if (!target) return txt("Missing url", 400);
        let targetUrl;
        try { targetUrl = new URL(target); } catch { return txt("Invalid url", 400); }
        const host = targetUrl.hostname.replace(/^www\./, "");
        if (!isAllowed(host)) return txt("Host not allowed", 403);
        try {
          const r = await fetch(targetUrl.toString(), { 
            headers: { "User-Agent": "XRNewsWorker/1.0" },
            cf: { timeout: 10000 }
          });
          const body = await r.text();
          const ct = r.headers.get("content-type")
            || (targetUrl.pathname.endsWith(".xml") ? "application/xml; charset=utf-8" : "application/rss+xml; charset=utf-8");
          return new Response(body, { status: r.status, headers: { ...CORS, "content-type": ct } });
        } catch (err) {
          return txt(`Upstream fetch failed: ${err}`, 502);
        }
      }

      // Aggregate (now includes social by default)
      if (url.pathname.endsWith("/aggregate")) {
        const sources = (url.searchParams.get("sources") || "crypto,stocks,macro,social").toLowerCase();
        const q = (url.searchParams.get("q") || "").trim();
        const out = await computeAggregate(sources, q);
        return ok({ count: out.all.length, latest: out.latest, top: out.top });
      }

      // Mixed headlines (derived from aggregate)
      if (url.pathname === "/mix") {
        const limit = Math.min(Math.max(parseInt(url.searchParams.get("limit") || "9", 10), 1), 50);
        const sources = (url.searchParams.get("sources") || "crypto,stocks,macro,social").toLowerCase();
        const q = (url.searchParams.get("q") || "").trim();
        const out = await computeAggregate(sources, q);
        const items = (out.latest || []).slice(0, limit).map(it => ({
          title: it.title, url: it.link, source: it.source, published_at: new Date(it.date).toISOString()
        }));
        return ok({ count: items.length, items });
      }

      // Feed index
      if (url.pathname === "/marketbrief/feed/index.json") {
        if (!env.MARKET_KV) return ok({ error: "KV not configured" }, 500);
        const feed = await env.MARKET_KV.get("feed:index", { type: "json" }) || { latest: null, items: [] };
        return ok(feed);
      }

      // Brief JSON by slug
      if (url.pathname.startsWith("/marketbrief/briefs/") && url.pathname.endsWith(".json")) {
        if (!env.MARKET_KV) return ok({ error: "KV not configured" }, 500);
        const slug = url.pathname.split("/").pop().replace(".json", "");
        const brief = await env.MARKET_KV.get(`brief:${slug}`, { type: "json" });
        if (!brief) return ok({ error: "not-found" }, 404);
        return ok(brief);
      }

      // Latest brief JSON
      if (url.pathname === "/marketbrief/latest.json") {
        if (!env.MARKET_KV) return ok({ error: "KV not configured" }, 500);
        const feed = await env.MARKET_KV.get("feed:index", { type: "json" });
        if (!feed?.latest) return ok({ error: "no-latest" }, 404);
        const brief = await env.MARKET_KV.get(`brief:${feed.latest}`, { type: "json" });
        if (!brief) return ok({ error: "not-found" }, 404);
        return ok(brief);
      }

      // Brief JSON by date
      if (/^\/marketbrief\/\d{4}-\d{2}-\d{2}\.json$/.test(url.pathname)) {
        if (!env.MARKET_KV) return ok({ error: "KV not configured" }, 500);
        const slug = url.pathname.split("/").pop().replace(".json", "");
        const brief = await env.MARKET_KV.get(`brief:${slug}`, { type: "json" });
        if (!brief) return ok({ error: "not-found" }, 404);
        return ok(brief);
      }

      // Rendered HTML brief (latest or by date)
      if (url.pathname === "/marketbrief/latest" || /^\/marketbrief\/\d{4}-\d{2}-\d{2}$/.test(url.pathname)) {
        if (!env.MARKET_KV) return txt("KV not configured", 500);
        
        let slug;
        if (url.pathname === "/marketbrief/latest") {
          const feed = await env.MARKET_KV.get("feed:index", { type: "json" });
          slug = feed?.latest;
          if (!slug) return txt("No latest brief found", 404);
        } else {
          slug = url.pathname.split("/").pop();
        }
        
        const brief = await env.MARKET_KV.get(`brief:${slug}`, { type: "json" });
        if (!brief) return txt("Brief not found", 404);

        const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>${escapeHtml(brief.title || "")}</title>
  <meta name="description" content="${escapeHtml(brief.summary || "")}"/>
  <meta property="og:title" content="${escapeHtml(brief.title || "")}">
  <meta property="og:description" content="${escapeHtml(brief.summary || "")}">
  <meta property="og:image" content="${brief.og_image || ""}">
  <meta property="og:type" content="article">
  <meta name="twitter:card" content="summary_large_image">
  <link rel="canonical" href="${brief.canonical || ""}">
  <style>
    body{font-family:system-ui,Segoe UI,Arial,sans-serif;max-width:920px;margin:24px auto;padding:0 16px;line-height:1.6;background:#0b0c10;color:#e7e7e7}
    a{color:#66fcf1} header,footer{opacity:.9}
    .brief img{max-width:100%;display:block;margin:12px 0;border:1px solid #222}
    .meta{color:#999;font-size:0.9em;margin:1em 0;}
  </style>
</head>
<body>
  <header><a href="/marketbrief.html">← Market Brief</a></header>
  <main class="brief">
    <h1>${escapeHtml(brief.title || "")}</h1>
    <div class="meta">
      <time datetime="${brief.date}">${brief.date}</time>
      ${brief.focus_assets && brief.focus_assets.length ? ` • Focus: ${brief.focus_assets.join(", ")}` : ""}
    </div>
    ${brief.article_html || ""}
    ${brief.last_word ? `<p><strong>Last Word:</strong> ${escapeHtml(brief.last_word)}</p>` : ""}
    ${Array.isArray(brief.sources) && brief.sources.length
        ? `<div class="meta"><strong>Sources:</strong> ${
            brief.sources.map(s => `<a href="${escapeHtml(s.url || "")}" rel="noopener" target="_blank">${escapeHtml(s.label || s.url || "")}</a>`).join(" • ")
          }</div>`
        : ""}
  </main>
  <footer><small>© ${new Date().getFullYear()} ${escapeHtml(brief.author || "XRayCrypto News")} • Generated ${brief.generated_at ? new Date(brief.generated_at).toLocaleString() : "recently"}</small></footer>
</body>
</html>`;
        return new Response(html, { 
          status: 200, 
          headers: { 
            ...CORS, 
            "content-type": "text/html; charset=utf-8", 
            "cache-control": "public, max-age=300" // 5 minutes cache
          } 
        });
      }

      // Generate brief (POST)
      if (url.pathname === "/marketbrief/generate" && request.method === "POST") {
        try {
          const body = await request.json().catch(() => ({}));
          const result = await generateAndStoreBrief(env, body);
          return ok({ ok: true, slug: result.slug, regenerated: result.regenerated });
        } catch (e) {
          return ok({ ok: false, error: String(e) }, 500);
        }
      }

      return txt("Not found", 404);
      
    } catch (error) {
      console.log("Worker error:", error);
      return ok({ error: "Internal server error", details: String(error) }, 500);
    }
  },

  async scheduled(event, env, ctx) {
    // Daily brief generation at 9 AM UTC
    ctx.waitUntil(
      generateAndStoreBrief(env, { force: false })
        .then(result => console.log("Scheduled brief generated:", result.slug))
        .catch(error => console.log("Scheduled generation failed:", error))
    );
  }
};