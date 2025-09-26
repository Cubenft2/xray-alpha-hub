// Fixed Cloudflare Worker - Replace your current worker with this
export default {
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

    const withCORS = (body, init = {}) => new Response(body, {
      ...init,
      headers: {
        "access-control-allow-origin": "*",
        "access-control-allow-methods": "GET,POST,OPTIONS",
        "cache-control": "no-store, max-age=0, must-revalidate",
        ...init.headers || {}
      }
    });

    const json = (obj, status = 200) => withCORS(JSON.stringify(obj, null, 2), {
      status,
      headers: { "content-type": "application/json; charset=utf-8" }
    });

    // Simple XML parser for RSS feeds
    function parseXMLFeed(xmlText) {
      const items = [];
      
      // Parse RSS items
      const rssItemRegex = /<item[^>]*>(.*?)<\/item>/gs;
      let match;
      
      while ((match = rssItemRegex.exec(xmlText)) !== null) {
        const itemContent = match[1];
        
        const titleMatch = itemContent.match(/<title[^>]*>\s*<!\[CDATA\[(.*?)\]\]>\s*<\/title>|<title[^>]*>(.*?)<\/title>/s);
        const linkMatch = itemContent.match(/<link[^>]*>(.*?)<\/link>/s);
        const pubDateMatch = itemContent.match(/<pubDate[^>]*>(.*?)<\/pubDate>/s);
        const descMatch = itemContent.match(/<description[^>]*>\s*<!\[CDATA\[(.*?)\]\]>\s*<\/description>|<description[^>]*>(.*?)<\/description>/s);
        
        const title = (titleMatch?.[1] || titleMatch?.[2] || '').trim();
        const link = (linkMatch?.[1] || '').trim();
        const pubDate = (pubDateMatch?.[1] || '').trim();
        const description = (descMatch?.[1] || descMatch?.[2] || '').trim();
        
        if (title && link) {
          items.push({
            title: title.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&'),
            link: link,
            date: pubDate ? new Date(pubDate).getTime() : Date.now(),
            source: new URL(link).hostname.replace(/^www\./, ''),
            description: description.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').substring(0, 200)
          });
        }
      }

      // Parse Atom entries if no RSS items found
      if (items.length === 0) {
        const atomEntryRegex = /<entry[^>]*>(.*?)<\/entry>/gs;
        while ((match = atomEntryRegex.exec(xmlText)) !== null) {
          const entryContent = match[1];
          
          const titleMatch = entryContent.match(/<title[^>]*>(.*?)<\/title>/s);
          const linkMatch = entryContent.match(/<link[^>]*href=["'](.*?)["'][^>]*>/s);
          const updatedMatch = entryContent.match(/<updated[^>]*>(.*?)<\/updated>/s);
          const summaryMatch = entryContent.match(/<summary[^>]*>(.*?)<\/summary>/s);
          
          const title = (titleMatch?.[1] || '').trim();
          const link = (linkMatch?.[1] || '').trim();
          const updated = (updatedMatch?.[1] || '').trim();
          const summary = (summaryMatch?.[1] || '').trim();
          
          if (title && link) {
            items.push({
              title: title.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&'),
              link: link,
              date: updated ? new Date(updated).getTime() : Date.now(),
              source: new URL(link).hostname.replace(/^www\./, ''),
              description: summary.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').substring(0, 200)
            });
          }
        }
      }
      
      return items;
    }

    if (url.pathname.endsWith("/aggregate")) {
      const sourcesParam = (url.searchParams.get("sources") || "crypto").toLowerCase();
      const sources = new Set(sourcesParam.split(",").map(s => s.trim()).filter(Boolean));

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
          "https://www.investing.com/rss/news_25.rss",
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
          "https://www.investing.com/rss/news_301.rss",
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

      async function fetchFeed(feedUrl) {
        try {
          console.log(`Fetching feed: ${feedUrl}`);
          const response = await fetch(feedUrl, {
            headers: {
              'User-Agent': 'XRNewsWorker/1.0 (+https://xraycrypto.io)',
              'Accept': 'application/rss+xml, application/xml, text/xml'
            }
          });

          if (!response.ok) {
            console.error(`Feed fetch failed: ${feedUrl} - ${response.status}`);
            return [];
          }

          const xmlText = await response.text();
          console.log(`Feed content length: ${xmlText.length}`);
          
          const items = parseXMLFeed(xmlText);
          console.log(`Parsed ${items.length} items from ${feedUrl}`);
          
          return items;
        } catch (error) {
          console.error(`Error fetching feed ${feedUrl}:`, error);
          return [];
        }
      }

      const toFetch = [];
      if (sources.has("crypto")) toFetch.push(...FEEDS.crypto);
      if (sources.has("stocks")) toFetch.push(...FEEDS.stocks);
      if (sources.has("macro")) toFetch.push(...FEEDS.macro);

      console.log(`Fetching ${toFetch.length} feeds...`);

      // Fetch feeds in parallel but with some delay to avoid overwhelming servers
      const results = await Promise.all(toFetch.map(feedUrl => fetchFeed(feedUrl)));
      
      let allItems = [];
      for (const items of results) {
        allItems.push(...items);
      }

      // Remove duplicates
      const seen = new Set();
      allItems = allItems.filter(item => {
        const key = item.link || item.title;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      console.log(`Total items after deduplication: ${allItems.length}`);

      // Sort by date
      const latest = [...allItems].sort((a, b) => b.date - a.date).slice(0, 20);
      
      // Score items (more recent = higher score)
      const now = Date.now();
      const scored = allItems.map(item => ({
        ...item,
        score: 1 / Math.max(1, (now - item.date) / (1000 * 60 * 60)) // Higher score for more recent
      }));
      
      const top = scored.sort((a, b) => b.score - a.score).slice(0, 20);

      return json({
        count: allItems.length,
        latest: latest,
        top: top
      });
    }

    // Handle other endpoints...
    if (url.pathname === "/health") {
      return json({ ok: true, service: "xraycrypto-news", time: new Date().toISOString() });
    }

    return new Response("Not Found", { status: 404 });
  }
};