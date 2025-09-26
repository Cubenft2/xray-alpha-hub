var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// worker.js
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
        "cache-control": "no-store, max-age=0, must-revalidate",
        ...init.headers || {}
      }
    }), "withCORS");
    const json = /* @__PURE__ */ __name((obj, status = 200) => withCORS(JSON.stringify(obj, null, 2), {
      status,
      headers: { "content-type": "application/json; charset=utf-8" }
    }), "json");
    const ALLOW = [
      // Crypto
      "coindesk.com",
      "cointelegraph.com",
      "theblock.co",
      "decrypt.co",
      "messari.io",
      "cryptoslate.com",
      "bitcoinmagazine.com",
      "blockworks.co",
      "thedefiant.io",
      "protos.com",
      "ambcrypto.com",
      "beincrypto.com",
      "coingape.com",
      "chain.link",
      "coinpedia.org",
      "cryptopotato.com",
      // Markets / Business
      "reuters.com",
      "cnbc.com",
      "foxbusiness.com",
      "apnews.com",
      "wsj.com",
      "feeds.a.dj.com",
      "finance.yahoo.com",
      "ft.com",
      "rss.cnn.com",
      "nytimes.com",
      "marketwatch.com",
      "moneycontrol.com",
      "theguardian.com",
      "bbc.co.uk",
      "feeds.bbci.co.uk",
      // Macro / Official
      "federalreserve.gov",
      "bls.gov",
      "bea.gov",
      "home.treasury.gov",
      "ecb.europa.eu",
      "bankofengland.co.uk",
      "sec.gov",
      // Meta
      "news.google.com"
    ];
    const isAllowedHost = /* @__PURE__ */ __name((h) => ALLOW.some((dom) => h === dom || h.endsWith("." + dom)), "isAllowedHost");
    const origin = `${url.protocol}//${url.host}`;
    const FEED_URL = `${origin}/marketbrief/feed/index.json`;
    const BRIEF_URL = /* @__PURE__ */ __name((slug) => `${origin}/marketbrief/briefs/${slug}.json`, "BRIEF_URL");
    async function getFeedViaOrigin() {
      const r = await fetch(FEED_URL, { cf: { cacheTtl: 120, cacheEverything: true } });
      if (!r.ok) throw new Error("Feed fetch failed: " + r.status);
      return r.json();
    }
    __name(getFeedViaOrigin, "getFeedViaOrigin");
    async function getBriefViaOrigin(slug) {
      const r = await fetch(BRIEF_URL(slug), { cf: { cacheTtl: 120, cacheEverything: true } });
      if (!r.ok) throw new Error("Brief fetch failed: " + slug + " -> " + r.status);
      return r.json();
    }
    __name(getBriefViaOrigin, "getBriefViaOrigin");
    const escapeHtml = /* @__PURE__ */ __name((s = "") => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]), "escapeHtml");
    const articleSchema = /* @__PURE__ */ __name((brief) => JSON.stringify({
      "@context": "https://schema.org",
      "@type": "NewsArticle",
      headline: brief.title,
      datePublished: brief.date,
      dateModified: brief.date,
      author: { "@type": "Organization", name: brief.author || "XRayCrypto News" },
      image: brief.og_image,
      description: brief.summary,
      mainEntityOfPage: brief.canonical
    }), "articleSchema");
    if (url.pathname === "/health") {
      return json({ ok: true, service: "xraycrypto-news", time: (/* @__PURE__ */ new Date()).toISOString() });
    }
    if (url.pathname === "/mix") {
      const limit = Math.min(Math.max(parseInt(url.searchParams.get("limit") || "9", 10), 1), 20);
      const symbolsParam = (url.searchParams.get("symbols") || "BTC,ETH,SOL").split(",").map((s) => s.trim().toUpperCase()).filter(Boolean);
      const now = Date.now();
      const items = [];
      let i = 0;
      for (const sym of symbolsParam) {
        for (let k = 0; k < Math.ceil(limit / symbolsParam.length); k++) {
          items.push({
            title: `Demo headline for ${sym} #${k + 1}`,
            url: `https://example.com/${sym.toLowerCase()}/${now - i * 1e3}`,
            source: "demo",
            published_at: new Date(now - i * 3600 * 1e3).toISOString()
          });
          i++;
        }
      }
      return json({ count: items.length, items: items.slice(0, limit) });
    }
    if (url.pathname.endsWith("/fetch")) {
      const target = url.searchParams.get("url");
      if (!target) return withCORS("Missing url", { status: 400, headers: { "content-type": "text/plain" } });
      let targetUrl;
      try {
        targetUrl = new URL(target);
      } catch {
        return withCORS("Invalid url", { status: 400, headers: { "content-type": "text/plain" } });
      }
      if (!/^https?:$/.test(targetUrl.protocol)) return withCORS("Only http(s) allowed", { status: 400 });
      const host = targetUrl.hostname.replace(/^www\./, "");
      if (!isAllowedHost(host)) return withCORS("Host not allowed", { status: 403 });
      try {
        const r = await fetch(targetUrl.toString(), { headers: { "User-Agent": "XRNewsWorker/1.0" } });
        const body = await r.text();
        const ct2 = r.headers.get("content-type") || (targetUrl.pathname.endsWith(".xml") ? "application/xml; charset=utf-8" : "application/rss+xml; charset=utf-8");
        return withCORS(body, { status: r.status, headers: { "content-type": ct2 } });
      } catch (err) {
        return withCORS(`Upstream fetch failed: ${err}`, { status: 502, headers: { "content-type": "text/plain" } });
      }
    }
    if (url.pathname.endsWith("/aggregate")) {
      const sourcesParam = (url.searchParams.get("sources") || "crypto").toLowerCase();
      const q = (url.searchParams.get("q") || "").trim();
      const sources = new Set(sourcesParam.split(",").map((s) => s.trim()).filter(Boolean));
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
        stocks: [
          "https://feeds.a.dj.com/rss/RSSMarketsMain.xml",
          "https://www.reuters.com/markets/us/rss",
          "https://www.cnbc.com/id/100003114/device/rss/rss.html",
          "https://feeds.foxbusiness.com/foxbusiness/latest",
          "https://apnews.com/hub/apf-business?output=rss",
          "https://finance.yahoo.com/news/rssindex",
          "https://www.ft.com/markets/rss",
          "https://rss.cnn.com/rss/money_latest.rss",
          "https://rss.nytimes.com/services/xml/rss/nyt/Business.xml",
          "https://www.marketwatch.com/feeds/topstories",
          "https://www.marketwatch.com/feeds/marketpulse",
          "https://www.moneycontrol.com/rss/business.xml",
          "https://www.moneycontrol.com/rss/marketreports.xml",
          "https://www.moneycontrol.com/rss/economy.xml",
          "https://www.theguardian.com/uk/business/rss",
          "http://feeds.bbci.co.uk/news/business/rss.xml"
        ],
        macro: [
          "https://www.reuters.com/world/rss",
          "https://apnews.com/hub/apf-topnews?output=rss",
          "https://news.google.com/rss/search?q=market%20volatility%20OR%20stocks%20selloff%20OR%20crypto%20crash&hl=en-US&gl=US&ceid=US:en",
          "https://www.federalreserve.gov/feeds/press_all.xml",
          "https://www.bls.gov/feed/news_release.rss",
          "https://www.bea.gov/rss.xml",
          "https://home.treasury.gov/rss/press.xml",
          "https://www.ecb.europa.eu/press/rss/press.xml",
          "https://www.bankofengland.co.uk/boeapps/rss/feeds.aspx?feed=News",
          "https://www.sec.gov/cgi-bin/browse-edgar?action=getcurrent&type=8-K&output=atom"
        ]
      };
      async function fetchFeed(u) {
        try {
          const host = new URL(u).hostname.replace(/^www\./, "");
          if (!isAllowedHost(host)) return [];
          const res = await fetch(u, { headers: { "User-Agent": "XRNewsWorker/1.0" } });
          if (!res.ok) throw new Error("HTTP " + res.status);
          const text = await res.text();
          const doc = new DOMParser().parseFromString(text, "text/xml");
          const items = [];
          doc.querySelectorAll("item").forEach((it) => {
            const title = it.querySelector("title")?.textContent?.trim() || "";
            const link = it.querySelector("link")?.textContent?.trim() || "";
            const pub = it.querySelector("pubDate")?.textContent || it.querySelector("dc\\:date")?.textContent || "";
            const date = pub ? new Date(pub) : /* @__PURE__ */ new Date();
            const source = new URL(link || u).hostname.replace(/^www\./, "");
            if (title && (link || u)) items.push({ title, link, date: +date, source });
          });
          doc.querySelectorAll("entry").forEach((it) => {
            const title = it.querySelector("title")?.textContent?.trim() || "";
            const link = it.querySelector("link")?.getAttribute("href") || "";
            const pub = it.querySelector("updated")?.textContent || it.querySelector("published")?.textContent || "";
            const date = pub ? new Date(pub) : /* @__PURE__ */ new Date();
            const source = new URL(link || u).hostname.replace(/^www\./, "");
            if (title && (link || u)) items.push({ title, link, date: +date, source });
          });
          return items.filter((x) => isAllowedHost((x.source || "").replace(/^www\./, "")));
        } catch {
          return [];
        }
      }
      __name(fetchFeed, "fetchFeed");
      const toFetch = [];
      if (sources.has("crypto")) toFetch.push(...FEEDS.crypto);
      if (sources.has("stocks")) toFetch.push(...FEEDS.stocks);
      if (sources.has("macro")) toFetch.push(...FEEDS.macro);
      const MAX = 6, chunks = [];
      for (let i = 0; i < toFetch.length; i += MAX) chunks.push(toFetch.slice(i, i + MAX));
      let all = [];
      for (const group of chunks) {
        const results = await Promise.all(group.map(fetchFeed));
        for (const arr of results) all.push(...arr);
      }
      const seen = /* @__PURE__ */ new Set();
      all = all.filter((x) => {
        const key = x.link || "t:" + x.title;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      const qLower = (q || "").toLowerCase();
      if (qLower) {
        all = all.filter(
          (x) => x.title.toLowerCase().includes(qLower) || (x.source || "").toLowerCase().includes(qLower)
        );
      }
      const now = Date.now();
      const SOURCE_WEIGHT = /* @__PURE__ */ __name((host) => {
        if (host.includes("reuters")) return 1.2;
        if (host.includes("apnews")) return 1.15;
        if (host.includes("cnbc")) return 1.1;
        if (host.includes("coindesk") || host.includes("cointelegraph") || host.includes("theblock")) return 1.1;
        if (host.includes("federalreserve") || host.includes("bls.gov") || host.includes("bea.gov")) return 1.2;
        return 1;
      }, "SOURCE_WEIGHT");
      const score = /* @__PURE__ */ __name((item) => {
        const ageMin = Math.max(1, (now - item.date) / 6e4);
        const recency = 1 / ageMin;
        return recency * SOURCE_WEIGHT(item.source || "");
      }, "score");
      const latest = [...all].sort((a, b) => b.date - a.date);
      const top = [...all].sort((a, b) => score(b) - score(a)).slice(0, 25);
      return json({ count: all.length, latest: latest.slice(0, 50), top });
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
    if (/^\/marketbrief\/\d{4}-\d{2}-\d{2}\.json$/.test(url.pathname)) {
      const slug = url.pathname.slice("/marketbrief/".length).replace(".json", "");
      const brief = await env.MARKET_KV.get(`brief:${slug}`, { type: "json" });
      if (!brief) return json({ error: "not-found" }, 404);
      return json(brief);
    }
    if (url.pathname === "/marketbrief/latest" || /^\/marketbrief\/\d{4}-\d{2}-\d{2}$/.test(url.pathname)) {
      try {
        let slug;
        if (url.pathname === "/marketbrief/latest") {
          const feed = await env.MARKET_KV.get("feed:index", { type: "json" });
          if (!feed?.latest) throw new Error("no-latest");
          slug = feed.latest;
        } else {
          slug = url.pathname.split("/").pop();
        }
        const brief = await env.MARKET_KV.get(`brief:${slug}`, { type: "json" });
        if (!brief) throw new Error("not-found");
        const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>${escapeHtml(brief.title)}</title>
  <meta name="description" content="${escapeHtml(brief.summary)}"/>
  <meta property="og:title" content="${escapeHtml(brief.title)}">
  <meta property="og:description" content="${escapeHtml(brief.summary)}">
  <meta property="og:image" content="${brief.og_image}">
  <meta property="og:type" content="article">
  <meta name="twitter:card" content="summary_large_image">
  <link rel="canonical" href="${brief.canonical}">
  <script type="application/ld+json">${articleSchema(brief)}<\/script>
  <style>
    body{font-family:system-ui,Segoe UI,Arial,sans-serif;max-width:920px;margin:24px auto;padding:0 16px;line-height:1.6;background:#0b0c10;color:#e7e7e7}
    a{color:#66fcf1}
    header,footer{opacity:.9}
    .charts img{max-width:100%;display:block;margin:12px 0;border:1px solid #222}
  </style>
</head>
<body>
  <header><a href="/marketbrief.html"> Market Brief</a></header>
  <main>
    <h1>${escapeHtml(brief.title)}</h1>
    <p><em>${escapeHtml(brief.date)}</em></p>
    ${brief.article_html}
    <p><strong>Last Word:</strong> ${escapeHtml(brief.last_word || "")}</p>
    <p><strong>Sources:</strong> ${(brief.sources || []).map((s) => `<a href="${s.url}" rel="noopener">${escapeHtml(s.label)}</a>`).join("  ")}</p>
  </main>
  <footer><small> ${escapeHtml(brief.author || "XRayCrypto News")}</small></footer>
</body>
</html>`;
        return withCORS(html, { status: 200, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=120" } });
      } catch (e) {
        return withCORS("Not found: " + e.message, { status: 404, headers: { "content-type": "text/plain; charset=utf-8" } });
      }
    }
    if (url.pathname === "/marketbrief/generate" && request.method === "POST") {
      try {
        const result = await generateAndStoreBrief(env);
        return json({ ok: true, slug: result.slug, keys: result.keys });
      } catch (err) {
        return json({ ok: false, error: String(err) }, 500);
      }
    }
    const originRes = await fetch(request);
    const ct = originRes.headers.get("content-type") || "";
    if (!ct.includes("text/html")) return originRes;
    let briefForInject;
    try {
      const feed = await env.MARKET_KV.get("feed:index", { type: "json" });
      if (feed?.latest) {
        briefForInject = await env.MARKET_KV.get(`brief:${feed.latest}`, { type: "json" });
      }
    } catch {
    }
    if (!briefForInject) {
      try {
        const feed = await getFeedViaOrigin();
        briefForInject = await getBriefViaOrigin(feed.latest);
      } catch {
        return originRes;
      }
    }
    const injected = `
      <article class="brief">
        <p><em>Lets talk about something.</em></p>
        ${briefForInject.article_html}
        <p><strong>Last Word:</strong> ${escapeHtml(briefForInject.last_word || "")}</p>
        <p class="muted"><a href="/marketbrief/${briefForInject.slug}">Permalink</a></p>
      </article>
    `;
    const rewriter = new HTMLRewriter().on("#brief-content[data-latest-brief]", {
      element(el) {
        el.setInnerContent(injected, { html: true });
      }
    }).on("head", {
      element(el) {
        el.append(`
            <meta property="og:title" content="${escapeHtml(briefForInject.title)}">
            <meta property="og:description" content="${escapeHtml(briefForInject.summary)}">
            <meta property="og:image" content="${briefForInject.og_image}">
            <meta name="twitter:card" content="summary_large_image">
            <link rel="canonical" href="${briefForInject.canonical}">
            <script type="application/ld+json">${articleSchema(briefForInject)}<\/script>
          `, { html: true });
      }
    });
    return rewriter.transform(originRes);
  },
  async scheduled(event, env, ctx) {
    ctx.waitUntil(generateAndStoreBrief(env).catch(() => {
    }));
  }
};

async function generateAndStoreBrief(env) {
  const today = /* @__PURE__ */ new Date();
  const yyyy = today.getUTCFullYear();
  const mm = String(today.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(today.getUTCDate()).padStart(2, "0");
  const slug = `${yyyy}-${mm}-${dd}`;
  
  // Fetch real news from all sources using the same logic as /aggregate endpoint
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
      "https://thedefiant.io/feed"
    ],
    stocks: [
      "https://feeds.a.dj.com/rss/RSSMarketsMain.xml",
      "https://www.reuters.com/markets/us/rss",
      "https://www.cnbc.com/id/100003114/device/rss/rss.html",
      "https://feeds.foxbusiness.com/foxbusiness/latest",
      "https://apnews.com/hub/apf-business?output=rss",
      "https://finance.yahoo.com/news/rssindex",
      "https://www.marketwatch.com/feeds/topstories"
    ],
    macro: [
      "https://www.reuters.com/world/rss",
      "https://apnews.com/hub/apf-topnews?output=rss",
      "https://www.federalreserve.gov/feeds/press_all.xml",
      "https://www.bls.gov/feed/news_release.rss"
    ]
  };

  const ALLOW = [
    "coindesk.com", "cointelegraph.com", "theblock.co", "decrypt.co", "messari.io", "chain.link", "cryptoslate.com",
    "bitcoinmagazine.com", "blockworks.co", "thedefiant.io", "reuters.com", "cnbc.com", "foxbusiness.com", 
    "finance.yahoo.com", "apnews.com", "federalreserve.gov", "bls.gov", "marketwatch.com", "feeds.a.dj.com"
  ];

  const isAllowedHost = (h) => ALLOW.some((dom) => h === dom || h.endsWith("." + dom));

  async function fetchFeed(u) {
    try {
      const host = new URL(u).hostname.replace(/^www\./, "");
      if (!isAllowedHost(host)) return [];
      const res = await fetch(u, { headers: { "User-Agent": "XRNewsWorker/1.0" } });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const text = await res.text();
      const doc = new DOMParser().parseFromString(text, "text/xml");
      const items = [];
      
      doc.querySelectorAll("item").forEach((it) => {
        const title = it.querySelector("title")?.textContent?.trim() || "";
        const link = it.querySelector("link")?.textContent?.trim() || "";
        const pub = it.querySelector("pubDate")?.textContent || "";
        const date = pub ? new Date(pub) : new Date();
        const source = new URL(link || u).hostname.replace(/^www\./, "");
        if (title && (link || u)) items.push({ title, link, date: +date, source });
      });
      
      doc.querySelectorAll("entry").forEach((it) => {
        const title = it.querySelector("title")?.textContent?.trim() || "";
        const link = it.querySelector("link")?.getAttribute("href") || "";
        const pub = it.querySelector("updated")?.textContent || it.querySelector("published")?.textContent || "";
        const date = pub ? new Date(pub) : new Date();
        const source = new URL(link || u).hostname.replace(/^www\./, "");
        if (title && (link || u)) items.push({ title, link, date: +date, source });
      });
      
      return items.filter((x) => isAllowedHost((x.source || "").replace(/^www\./, "")));
    } catch {
      return [];
    }
  }

  // Fetch from all feed categories
  const toFetch = [...FEEDS.crypto, ...FEEDS.stocks, ...FEEDS.macro];
  const MAX = 6, chunks = [];
  for (let i = 0; i < toFetch.length; i += MAX) chunks.push(toFetch.slice(i, i + MAX));
  
  let allNews = [];
  for (const group of chunks) {
    const results = await Promise.all(group.map(fetchFeed));
    for (const arr of results) allNews.push(...arr);
  }

  // Remove duplicates and get latest 25 items
  const seen = new Set();
  allNews = allNews.filter((x) => {
    const key = x.link || "t:" + x.title;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Sort by date and get top 25 latest items for the AI prompt
  const items = allNews
    .sort((a, b) => b.date - a.date)
    .slice(0, 25)
    .map(item => ({
      title: item.title,
      url: item.link,
      source: item.source,
      published_at: new Date(item.date).toISOString()
    }));

  const systemPrompt = `You're a sharp market analyst with John Oliver's wit—explaining markets like a smart friend at the bar, armed with receipts.

🎯 SIGNATURE TONE:
- Lightly sarcastic but never mean-spirited—like pointing out when someone's "fishing in dead water"
- Smart friend who's done their homework and knows how to read the market like reading water
- Call out obvious BS—know when institutions are "trolling for suckers" vs real opportunities
- Use "Look," "Here's the thing," "And get this" as natural transitions
- Weave in fishing wisdom: "baiting the hook," "schools moving," "feeding frenzy," "cut bait and run"
- No corporate fluff—if retail got played "hook, line and sinker," just say it
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
- Fresh fishing analogies—"dead water" vs "feeding frenzy," "caught a big one" vs "small fry"
- If retail's getting played, say they're "trolling for suckers" or got caught "hook, line and sinker"
- If there's genuine innovation, celebrate it—"deep sea fishing" for real value vs "shallow water" plays
- Neutral but never bland—know when "the fish aren't biting" vs when there's a "school moving"

Return JSON with fields: title, summary, article_html, last_word.`;
  
  const userPrompt = `Here are today's fresh news headlines from major sources. Use them to create analysis and insights (titles, links, timestamps):

${JSON.stringify(items, null, 2)}
`;

  const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0.5,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      response_format: { type: "json_object" }
    })
  });
  if (!openaiRes.ok) {
    const text = await openaiRes.text();
    throw new Error(`OpenAI error ${openaiRes.status}: ${text}`);
  }
  const data = await openaiRes.json();
  let content;
  try {
    content = JSON.parse(data.choices?.[0]?.message?.content || "{}");
  } catch {
    content = { title: "Market Brief", summary: "", article_html: "<p>No content.</p>", last_word: "" };
  }
  const brief = {
    slug,
    date: `${yyyy}-${mm}-${dd}`,
    title: content.title || `Market Brief  ${yyyy}-${mm}-${dd}`,
    summary: content.summary || "Daily market wrap.",
    article_html: content.article_html || "<p>(No article_html returned)</p>",
    last_word: content.last_word || "",
    author: "XRayCrypto News",
    og_image: "https://xraycrypto.io/img/og-marketbrief.png",
    canonical: `https://xraycrypto-news.xrprat.workers.dev/marketbrief/${slug}`,
    sources: items.slice(0, 10).map((i) => ({ label: i.source || "source", url: i.url }))
  };
  await env.MARKET_KV.put(`brief:${slug}`, JSON.stringify(brief), {
    expirationTtl: 60 * 60 * 24 * 90
  });
  const feedKey = "feed:index";
  const feed = await env.MARKET_KV.get(feedKey, { type: "json" }) || { latest: null, items: [] };
  const newItems = [{ slug, title: brief.title, date: brief.date, canonical: brief.canonical }, ...feed.items || []].filter(Boolean).slice(0, 50);
  await env.MARKET_KV.put(feedKey, JSON.stringify({ latest: slug, items: newItems }));
  return { slug, keys: [`brief:${slug}`, "feed:index"] };
}
__name(generateAndStoreBrief, "generateAndStoreBrief");
export {
  worker_default as default
};