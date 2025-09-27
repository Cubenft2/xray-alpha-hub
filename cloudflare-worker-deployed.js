// Cloudflare Worker — XRayCrypto News (aggregate + briefs + prices + charts)

// ---------- CORS helpers ----------
const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET,POST,OPTIONS",
  "access-control-allow-headers": "Content-Type,User-Agent,Authorization",
  "cache-control": "no-store, max-age=0, must-revalidate",
};
const ok  = (obj, status = 200, headers = {}) =>
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
    "https://decrypt.co/feed","https://messari.io/rss","https://cryptoslate.com/feed/",
    "https://bitcoinmagazine.com/feed","https://blockworks.co/feeds/rss","https://thedefiant.io/feed",
    "https://blog.chain.link/feed/","https://protos.com/feed/","https://ambcrypto.com/feed/",
    "https://beincrypto.com/feed/","https://coingape.com/feed/","https://coinpedia.org/feed/",
    "https://cryptopotato.com/feed/","https://www.newsbtc.com/feed/",
    "https://blog.chainalysis.com/feed/","https://dune.com/blog/rss.xml",
  ],
  social: [
    "https://www.reddit.com/r/CryptoCurrency/.rss","https://www.reddit.com/r/CryptoMarkets/.rss",
    "https://www.reddit.com/r/Bitcoin/.rss","https://www.reddit.com/r/Ethereum/.rss",
    "https://www.reddit.com/r/Solana/.rss","https://www.reddit.com/r/ethfinance/.rss",
    "https://www.reddit.com/r/defi/.rss","https://www.reddit.com/r/altcoin/.rss",
    "https://news.google.com/rss/search?q=crypto%20fomo%20OR%20altseason%20OR%20memecoin%20OR%20airdrop&hl=en-US&gl=US&ceid=US:en",
    "https://news.google.com/rss/search?q=bitcoin%20dominance%20OR%20btc%20liquidations%20OR%20funding%20rates&hl=en-US&gl=US&ceid=US:en",
    "https://news.google.com/rss/search?q=%22whale%20alert%22%20OR%20%22large%20transaction%22%20crypto&hl=en-US&gl=US&ceid=US:en",
  ],
  etf: [
    "https://news.google.com/rss/search?q=bitcoin%20etf%20OR%20ethereum%20etf%20OR%20crypto%20etf&hl=en-US&gl=US&ceid=US:en",
    "https://www.sec.gov/cgi-bin/browse-edgar?action=getcurrent&type=8-K&output=atom",
    "https://feeds.a.dj.com/rss/RSSMarketsMain.xml",
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
};

// ---------- RSS fetch & parse ----------
async function fetchFeed(u) {
  try {
    const host = new URL(u).hostname.replace(/^www\./, "");
    if (!isAllowed(host)) return [];
    const res = await fetch(u, { headers: { "User-Agent": "XRNewsWorker/1.0" }, signal: AbortSignal.timeout(10000) });
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
    } catch (_) {}

    // Fallback regex for quirky feeds
    if (!items.length && /<item[\s>]/i.test(text)) {
      const rx = /<item[\s\S]*?<title[^>]*>([\s\S]*?)<\/title>[\s\S]*?<link[^>]*>([\s\S]*?)<\/link>[\s\S]*?(?:<pubDate[^>]*>([\s\S]*?)<\/pubDate>|<updated[^>]*>([\s\S]*?)<\/updated>)?/gi;
      let m;
      while ((m = rx.exec(text))) {
        const title = (m[1] || "").replace(/<!\[CDATA\[|\]\]>/g, "").trim();
        const link  = (m[2] || "").replace(/<!\[CDATA\[|\]\]>/g, "").trim();
        const pub   = (m[3] || m[4] || "").trim();
        const date  = pub ? new Date(pub) : new Date();
        if (!isNaN(date.getTime())) {
          const source = new URL(link || u).hostname.replace(/^www\./, "");
          if (title && (link || u)) items.push({ title, link, date: +date, source });
        }
      }
    }
    return items.filter((x) => isAllowed((x.source || "").replace(/^www\./, "")));
  } catch (_) {
    return [];
  }
}

async function computeAggregate(sourcesParam, q) {
  const sources = new Set((sourcesParam || "crypto,stocks,macro,social,ipo,etf").toLowerCase().split(",").map(s => s.trim()).filter(Boolean));
  const toFetch = [];
  if (sources.has("crypto")) toFetch.push(...FEEDS.crypto);
  if (sources.has("stocks")) toFetch.push(...FEEDS.stocks);
  if (sources.has("macro"))  toFetch.push(...FEEDS.macro);
  if (sources.has("social")) toFetch.push(...FEEDS.social);
  if (sources.has("ipo"))    toFetch.push(...FEEDS.ipo);
  if (sources.has("etf"))    toFetch.push(...FEEDS.etf);

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

  // rank by recency × source trust
  const now = Date.now();
  const SOURCE_WEIGHT = (host = "") => {
    const h = host.toLowerCase();
    if (h.includes("reuters")) return 1.25;
    if (h.includes("apnews")) return 1.18;
    if (h.includes("federalreserve") || h.includes("bls.gov") || h.includes("bea.gov") || h.includes("sec.gov")) return 1.3;
    if (h.includes("cnbc") || h.includes("ft.com") || h.includes("wsj.com")) return 1.12;
    if (h.includes("coindesk") || h.includes("cointelegraph") || h.includes("theblock")) return 1.1;
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

// ---------- Quotes (Daily Stoic first via KV, fallback internal) ----------
async function getQuoteForDate(env, dateISO) {
  const key = `quote:${dateISO}`;
  const saved = await env.MARKET_KV.get(key, { type: "json" });
  if (saved?.text) return saved;
  const pool = [
    { text: ""You have power over your mind — not outside events." — Marcus Aurelius", tag: "discipline" },
    { text: ""We suffer more in imagination than in reality." — Seneca", tag: "perspective" },
    { text: ""No great thing is created suddenly." — Epictetus", tag: "patience" },
  ];
  return pool[(new Date(dateISO).getUTCDate()) % pool.length];
}

// ---------- Asset resolution (dynamic via KV) ----------
const DEFAULT_USD_PAIRS   = ["USDT","USD","FDUSD","USDC","BUSD"];
const BINANCE_MAP = { BTC: "BTCUSDT", ETH: "ETHUSDT", SOL: "SOLUSDT", DOGE: "DOGEUSDT", XRP: "XRPUSDT" };

async function getAssetMap(env, sym) {
  const key = `assetmap:${sym.toUpperCase()}`;
  const row = await env.MARKET_KV.get(key, { type: "json" });
  return row || null;
}
function guessBinancePair(sym) {
  for (const q of DEFAULT_USD_PAIRS) return `${sym}${q}`;
  return `${sym}USDT`;
}
function guessTVSymbol(sym) {
  return `BINANCE:${sym}USDT`;
}
async function resolveAsset(env, sym) {
  const up = sym.toUpperCase();
  const fromKV = await getAssetMap(env, up);
  return {
    tv: fromKV?.tv || guessTVSymbol(up),
    binance_pair: fromKV?.binance_pair || BINANCE_MAP[up] || guessBinancePair(up),
    coingecko_id: fromKV?.coingecko_id || ""
  };
}

// ---------- Price helpers (CoinGecko Pro if key, fallback Binance) with 120s KV cache ----------
async function fetchBinancePair(pair) {
  const r = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${pair}`, { signal: AbortSignal.timeout(8000) });
  if (!r.ok) return null;
  const j = await r.json();
  if (!j || !j.lastPrice) return null;
  return { price: parseFloat(j.lastPrice), change24h_pct: parseFloat(j.priceChangePercent), source: "binance" };
}

async function snapshotPrices(env, symbols) {
  // 120s coalescing window per set of symbols and provider
  const sorted = [...symbols].map(s => s.toUpperCase()).sort();
  const provider = (env.PRICE_PROVIDER || "binance").toLowerCase();
  const bucket = Math.floor(Date.now() / 120_000); // 2-minute window
  const cacheKey = `prices:v1:${provider}:${bucket}:${sorted.join(",")}`;

  // Try KV cache first
  try {
    const cached = await env.MARKET_KV.get(cacheKey, { type: "json" });
    if (cached && typeof cached === "object") return cached;
  } catch (_) {}

  // Live fetch if cache miss
  const out = {};
  const key = env.COINGECKO_API_KEY || "";
  const resolved = await Promise.all(sorted.map(sym => resolveAsset(env, sym)));

  // CoinGecko batch (when ids exist)
  const cgIds = resolved.map((r, i) => ({ id: r.coingecko_id, sym: sorted[i] })).filter(x => x.id);
  if (cgIds.length && key) {
    const list = cgIds.map(x => x.id).join("%2C");
    const r = await fetch(
      `https://pro-api.coingecko.com/api/v3/simple/price?ids=${list}&vs_currencies=usd&include_24hr_change=true`,
      { headers: { "x-cg-pro-api-key": key }, signal: AbortSignal.timeout(8000) }
    );
    if (r.ok) {
      const j = await r.json();
      for (const { id, sym } of cgIds) {
        const row = j[id];
        if (row) out[sym] = { price: row.usd, change24h_pct: row.usd_24h_change, source: "coingecko_pro" };
      }
    }
  }

  // Fill gaps via Binance public
  await Promise.all(resolved.map(async (r, idx) => {
    const sym = sorted[idx];
    if (out[sym]) return;
    const pair = r.binance_pair;
    const dato = await fetchBinancePair(pair);
    if (dato) out[sym] = dato;
  }));

  // Store snapshot in KV (120s TTL)
  try {
    await env.MARKET_KV.put(cacheKey, JSON.stringify(out), { expirationTtl: 120 });
  } catch (_) {}

  return out;
}

// ---------- TradingView Mini Charts (dynamic, uses resolver) ----------
async function buildMiniChartsHTMLWithResolve(env, assets = [], theme = "dark") {
  const tvSymbols = [];
  for (const a of (assets || [])) {
    const cfg = await resolveAsset(env, a);
    if (cfg.tv) tvSymbols.push(cfg.tv);
  }
  const syms = tvSymbols.filter(Boolean).slice(0, 8);
  if (!syms.length) return "";
  const items = syms.map(sym => `
    <div class="chart-card">
      <div class="tradingview-widget-container">
        <div class="tradingview-widget-container__widget"></div>
        <script type="text/javascript" src="https://s3.tradingview.com/external-embedding/embed-widget-mini-symbol-overview.js" async>
        {
          "symbol": "${sym}",
          "width": "100%",
          "height": "220",
          "locale": "en",
          "dateRange": "1D",
          "colorTheme": "${theme}",
          "autosize": true,
          "isTransparent": true,
          "largeChartUrl": "",
          "noTimeScale": false
        }
        </script>
      </div>
    </div>
  `).join("");

  return `
  <section class="mini-charts">
    <h2>Mini Charts</h2>
    <div class="chart-grid">
      ${items}
    </div>
  </section>`;
}

// ---------- generator ----------
async function generateAndStoreBrief(env, opts = {}) {
  const today = new Date();
  const dateSlug = today.toISOString().slice(0,10);

  if (!env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is required");
  if (!env.MARKET_KV)      throw new Error("MARKET_KV binding is required");

  // Session (explicit > fallback)
  let session = (opts.session === 'premarket' || opts.session === 'postmarket') ? opts.session : null;
  if (!session) session = (today.getUTCHours() < 16 ? 'premarket' : 'postmarket');
  const briefSlug = `${dateSlug}-${session}`;

  if (!opts.force) {
    const existing = await env.MARKET_KV.get(`brief:${briefSlug}`, { type: "json" });
    if (existing) return { slug: briefSlug, session, regenerated: false };
  }

  const focus = Array.isArray(opts.symbols) && opts.symbols.length
    ? opts.symbols.map(s => s.toUpperCase())
    : (env.FOCUS_ASSETS || "BTC,ETH,SOL,DOGE,XRP").split(",").map(s=>s.trim().toUpperCase());

  // Aggregate news
  const agg = await computeAggregate("crypto,social,etf,stocks,macro", "");
  const items = (agg.top || []).slice(0, 20).map(it => ({
    title: it.title, url: it.link, source: it.source,
    published_at: new Date(it.date).toISOString(),
    description: it.description || "", relevance_score: 1
  }));

  // Quote, audience, prices
  const quote    = await getQuoteForDate(env, dateSlug);
  const audience = (env.AUDIENCE_LEVEL || "balanced");
  const prices   = await snapshotPrices(env, focus);

  // System prompt (MB_STYLE can override)
  const systemPrompt = (env.MB_STYLE || `
You are the voice of XRayCrypto's Market Brief.
Identity: American Latino, world-traveled sport fisherman turned markets storyteller.
Tone: sharp, plainspoken, confident, lightly witty. No "dude" or bro-talk. Original vocabulary.
Signature: EVERY brief begins with "Let's talk about something."

Time-based lens
- Premarket (cron 12:00 UTC): forward-looking, decisive phrasing ("watch for…", "momentum building…").
- Postmarket (cron 20:15 UTC): reflective, contextual, past tense ("resulted in…", "following today's…").
- Crypto runs 24/7; same persona. Use memes sparingly, only for color.

Structure (strict)
1. Title — narrative, not generic
2. Executive Summary — 2–3 sentences
3. <div class="market-brief-opener"><p><strong>Let's talk about something.</strong> [Hook]</p></div>
4. Sections (each 2–3 short paragraphs):
   - What Happened
   - Why It Matters
   - Market Reaction
   - What to Watch Next
   - Last Word
5. One rotating mini-section: Chart of the Tide | Whale Watch | Word on the Docks | Deep Water | Shallow End
6. Wisdom for the Waters — insert the given Daily Stoic quote (wisdom_passage)

Data rules
- Focus assets: BTC, ETH, SOL, DOGE, XRP (+ provided).
- Use the provided price snapshot (numbers + 24h % change). Never invent stats.
- Sources ranked: official/Reuters/AP/SEC > crypto trades (CoinDesk/Blockworks/Decrypt) > social (Reddit/Google News). Prefer fresh + trusted.

Audience
- Audience level: ${audience}. If balanced: explain jargon briefly on first use (e.g., "funding turned positive (longs paying fees)").
- If casual: simplify further. If pro: tighter on-chain terms allowed, skip basics.

Rules
- Never fabricate news, numbers, or quotes.
- Stick to provided headlines, price snapshot, and quote.
- Output valid JSON only with fields:
  { "title","summary","article_html","last_word","wisdom_passage","social_text",
    "sources","focus_assets","mini_section","sentiment_score","session" }
`.trim());

  const userPrompt = `Date: ${dateSlug}
Session: ${session.toUpperCase()}
Audience: ${audience}
Focus Assets: ${focus.join(", ")}

Live Price Snapshot (USD, ~now):
${JSON.stringify(prices, null, 2)}

Daily Quote (use as wisdom_passage; short, integrate naturally):
${JSON.stringify(quote)}

Fresh headlines (ranked, crypto-first):
${JSON.stringify(items, null, 2)}

Rules:
1) Start with "Let's talk about something."
2) Use the exact five-section HTML structure.
3) Choose one mini-section.
4) Keep it readable for a balanced audience; decode jargon briefly on first use.
5) Cite ideas in prose; links will be listed. Do not fabricate.`;

  const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: env.OPENAI_MODEL || "gpt-5.1-mini",
      max_completion_tokens: 2000,
      messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
      response_format: { type: "json_object" }
    })
  });
  if (!openaiRes.ok) throw new Error(`OpenAI API error ${openaiRes.status}: ${await openaiRes.text()}`);

  let content = {};
  try {
    const data = await openaiRes.json();
    content = JSON.parse(data.choices?.[0]?.message?.content || "{}");
  } catch (_) {}

  if (!content.wisdom_passage && quote?.text) content.wisdom_passage = quote.text;

  const brief = {
    slug: briefSlug,
    date: dateSlug,
    session,
    title: content.title || `Crypto Market Brief — ${session === 'premarket' ? 'Pre-Market' : 'Post-Market'} — ${dateSlug}`,
    summary: content.summary || "Daily crypto market analysis and key developments.",
    article_html: content.article_html || "<p>Market analysis coming soon.</p>",
    last_word: content.last_word || "Stay disciplined. The ocean rewards patience.",
    wisdom_passage: content.wisdom_passage || quote?.text || "",
    social_text: content.social_text || `Market Brief (${session}): ${(content.summary || "").slice(0, 120)} #crypto`,
    focus_assets: content.focus_assets || focus,
    mini_section: content.mini_section || "Chart of the Tide",
    sentiment_score: content.sentiment_score || "neutral",
    author: "XRayCrypto News",
    price_snapshot: prices,
    og_image: `https://news.xraycrypto.io/marketbrief/charts/${dateSlug}/og_cover_${session}.png`,
    canonical: `https://news.xraycrypto.io/marketbrief/${briefSlug}`,
    generated_at: new Date().toISOString(),
    sources: items.slice(0, 15).map(i => ({ label: i.source || "source", url: i.url, type: "primary" }))
  };

  await env.MARKET_KV.put(`brief:${briefSlug}`, JSON.stringify(brief), { expirationTtl: 60 * 60 * 24 * 30 });

  const feed = await env.MARKET_KV.get("feed:index", { type: "json" }) || { items: [] };
  feed.latest = briefSlug;
  feed.items = [briefSlug, ...(feed.items || []).filter(s => s !== briefSlug)].slice(0, 50);
  await env.MARKET_KV.put("feed:index", JSON.stringify(feed));

  return { slug: briefSlug, keys: [briefSlug], session, regenerated: true };
}

// ---------- main handler ----------
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: {
        "access-control-allow-origin": "*",
        "access-control-allow-methods": "GET,POST,OPTIONS",
        "access-control-allow-headers": "Content-Type,User-Agent,Authorization",
        "access-control-max-age": "86400"
      }});
    }
    const withCORS = (body, init = {}) => new Response(body, {
      ...init,
      headers: {
        "access-control-allow-origin": "*",
        "access-control-allow-methods": "GET,POST,OPTIONS",
        "cache-control": "no-store, max-age=0, must-revalidate",
        ...init.headers || {}
      }
    });
    const json = (obj, status = 200) => withCORS(JSON.stringify(obj, null, 2), { status, headers: { "content-type": "application/json; charset=utf-8" } });

    if (url.pathname === "/health") return json({ ok: true, service: "xraycrypto-news", time: new Date().toISOString() });

    // Admin: set the day's Stoic quote
    if (url.pathname === "/admin/set-quote" && request.method === "POST") {
      if (request.headers.get("x-admin-key") !== env.ADMIN_KEY) return txt("forbidden", 403);
      const body = await request.json().catch(()=> ({}));
      if (!body.date || !body.text) return txt("missing date/text", 400);
      await env.MARKET_KV.put(`quote:${body.date}`, JSON.stringify({ text: body.text, tag: body.tag || "" }), { expirationTtl: 400*24*3600 });
      return ok({ ok: true });
    }

    // Admin: register/override an asset mapping
    if (url.pathname === "/admin/set-assetmap" && request.method === "POST") {
      if (request.headers.get("x-admin-key") !== env.ADMIN_KEY) return txt("forbidden", 403);
      const body = await request.json().catch(()=> ({}));
      const asset = (body.asset || "").toUpperCase();
      if (!asset) return txt("missing asset", 400);
      const rec = { tv: body.tv || "", binance_pair: body.binance_pair || "", coingecko_id: body.coingecko_id || "" };
      await env.MARKET_KV.put(`assetmap:${asset}`, JSON.stringify(rec));
      return ok({ ok: true, saved: { asset, ...rec } });
    }

    if (url.pathname.endsWith("/aggregate")) {
      const sourcesParam = (url.searchParams.get("sources") || "crypto,social,etf").toLowerCase();
      const q = (url.searchParams.get("q") || "").trim();
      const result = await computeAggregate(sourcesParam, q);
      return json({ count: result.all.length, latest: result.latest, top: result.top });
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

    // /marketbrief/YYYY-MM-DD(-premarket|-postmarket)?.json
    if (/^\/marketbrief\/\d{4}-\d{2}-\d{2}(-premarket|-postmarket)?\.json$/.test(url.pathname)) {
      const base = url.pathname.slice("/marketbrief/".length).replace(".json", "");
      let slug = base;
      let brief = await env.MARKET_KV.get(`brief:${slug}`, { type: "json" });
      if (!brief && !base.includes('-premarket') && !base.includes('-postmarket')) {
        const post = await env.MARKET_KV.get(`brief:${base}-postmarket`, { type: "json" });
        const pre  = await env.MARKET_KV.get(`brief:${base}-premarket`, { type: "json" });
        brief = post || pre;
        slug = brief ? (brief.slug || slug) : slug;
      }
      if (!brief) return json({ error: "not-found" }, 404);
      return json(brief);
    }

    // Manual generation
    if (url.pathname === "/marketbrief/generate" && request.method === "POST") {
      try {
        const body = await request.text();
        const opts = body ? JSON.parse(body) : {};
        const result = await generateAndStoreBrief(env, opts);
        return json({ ok: true, slug: result.slug, keys: result.keys, session: result.session });
      } catch (err) {
        return json({ ok: false, error: String(err) }, 500);
      }
    }

    // HTML renderers
    if (url.pathname === "/marketbrief/latest" || /^\/marketbrief\/\d{4}-\d{2}-\d{2}(-premarket|-postmarket)?$/.test(url.pathname)) {
      try {
        let slug;
        if (url.pathname === "/marketbrief/latest") {
          const feed = await env.MARKET_KV.get("feed:index", { type: "json" });
          if (!feed?.latest) throw new Error("no-latest");
          slug = feed.latest;
        } else {
          const base = url.pathname.split("/").pop();
          if (base.includes('-premarket') || base.includes('-postmarket')) {
            slug = base;
          } else {
            const post = await env.MARKET_KV.get(`brief:${base}-postmarket`, { type: "json" });
            const pre  = await env.MARKET_KV.get(`brief:${base}-premarket`, { type: "json" });
            slug = post ? `${base}-postmarket` : (pre ? `${base}-premarket` : base);
          }
        }
        const brief = await env.MARKET_KV.get(`brief:${slug}`, { type: "json" });
        if (!brief) throw new Error("not-found");

        // Build charts HTML (async because it resolves KV)
        const chartsHTML = await buildMiniChartsHTMLWithResolve(env, brief.focus_assets, "dark");

        const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>${escapeHtml(brief.title)}</title>
  <meta name="description" content="${escapeHtml(brief.summary)}"/>
  <meta property="og:title" content="${escapeHtml(brief.title)}">
  <meta property="og:description" content="${escapeHtml(brief.summary)}">
  <meta property="og:image" content="${brief.og_image}">
  <meta property="og:type" content="article">
  <meta name="twitter:card" content="summary_large_image">
  <link rel="canonical" href="${brief.canonical}">
  <style>
    body{font-family:system-ui,Segoe UI,Arial,sans-serif;max-width:920px;margin:24px auto;padding:0 16px;line-height:1.6;background:#0b0c10;color:#e7e7e7}
    a{color:#66fcf1}
    header,footer{opacity:.9}
    .market-brief-opener{background:#1a1f2e;padding:16px;border-left:4px solid #66fcf1;margin:20px 0;border-radius:4px}
    .market-brief-opener p{margin:0;font-size:1.1em}
    h2{color:#66fcf1;border-bottom:2px solid #1a1f2e;padding-bottom:8px}
    .mini-section{background:#0f1419;border:1px solid #1a1f2e;padding:16px;margin:20px 0;border-radius:8px}
    .sources{margin-top:30px;padding:15px;background:#0f1419;border-radius:6px}
    .sources a{margin-right:12px}
    .mini-charts{margin-top:24px}
    .chart-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:12px}
    .chart-card{background:#0f1419;border:1px solid #1a1f2e;border-radius:8px;padding:8px}
  </style>
</head>
<body>
  <header><a href="/marketbrief/latest">🎣 XRayCrypto Market Brief</a></header>
  <main>
    <h1>${escapeHtml(brief.title)}</h1>
    <p><em>${escapeHtml(brief.date)} • ${brief.session === 'premarket' ? '🌅 Pre-Market' : '🌆 Post-Market'} Session</em></p>
    ${brief.article_html}
    ${chartsHTML}
    ${brief.wisdom_passage ? `<div class="mini-section"><strong>Wisdom for the Waters:</strong> <em>${escapeHtml(brief.wisdom_passage)}</em></div>` : ''}
    <div class="sources">
      <strong>Sources:</strong> ${(brief.sources || []).map((s) => `<a href="${s.url}" rel="noopener" target="_blank">${escapeHtml(s.label)}</a>`).join(" • ")}
    </div>
  </main>
  <footer><small>⚡ ${escapeHtml(brief.author || "XRayCrypto News")} • Generated: ${brief.generated_at ? new Date(brief.generated_at).toLocaleString() : 'N/A'}</small></footer>
</body>
</html>`;
        return withCORS(html, { status: 200, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=300" } });
      } catch (e) {
        return withCORS(`Brief not found: ${e.message}`, { status: 404, headers: { "content-type": "text/plain; charset=utf-8" } });
      }
    }

    return json({ error: "endpoint not found" }, 404);
  },

  // Cron → session mapping (UTC): 0 12 * * * (premarket), 15 20 * * * (postmarket)
  async scheduled(event, env, ctx) {
    const cron = event.cron || "";
    const session = (cron === "0 12 * * *") ? "premarket" :
                    (cron === "15 20 * * *") ? "postmarket" :
                    (new Date().getUTCHours() < 16 ? "premarket" : "postmarket");
    ctx.waitUntil(
      generateAndStoreBrief(env, { force: true, session })
        .catch((err) => console.error(`Scheduled ${session} brief generation failed:`, err))
    );
  }
};