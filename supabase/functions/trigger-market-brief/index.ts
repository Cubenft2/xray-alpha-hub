import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

interface NewsItem {
  title: string;
  url: string;
  source: string;
  published_at: string;
}

interface NewsData {
  crypto?: NewsItem[];
  stocks?: NewsItem[];
  trump?: NewsItem[];
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { force = false, notes = "" } = await req.json().catch(() => ({}));
    
    console.log('Triggering market brief generation...');
    console.log('Force:', force);
    console.log('Notes:', notes);
    
    // Get fresh news from multiple sources using the news-fetch function
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
    const newsRes = await fetch('https://odncvfiuzliyohxrsigc.supabase.co/functions/v1/news-fetch', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${anonKey}`,
        'apikey': anonKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ limit: 20 })
    });
    
    if (!newsRes.ok) {
      throw new Error(`News fetch failed: ${newsRes.status}`);
    }
    
    const newsData: NewsData = await newsRes.json();
    console.log('News data received:', newsData);
    
    // Create a comprehensive brief using the news data
    const today = new Date();
    const dateStr = today.toISOString().split('T')[0];
    const timestamp = today.toISOString();
    
    // Aggregate all news items for analysis
    const allNews: NewsItem[] = [
      ...(newsData.crypto || []),
      ...(newsData.stocks || []),
      ...(newsData.trump || [])
    ].slice(0, 15);
    
    // Create article content based on real news
    let articleHtml = '<h2>🚀 Crypto Headlines</h2>\n';
    
    if (newsData.crypto && newsData.crypto.length > 0) {
      articleHtml += '<ul>\n';
      newsData.crypto.slice(0, 5).forEach((item: NewsItem) => {
        articleHtml += `<li><strong><a href="${item.url}" target="_blank">${item.title}</a></strong><br><small>Source: ${item.source} | ${new Date(item.published_at).toLocaleString()}</small></li>\n`;
      });
      articleHtml += '</ul>\n';
    } else {
      articleHtml += '<p>No crypto news available at this time.</p>\n';
    }
    
    articleHtml += '\n<h2>📈 Stock Market News</h2>\n';
    
    if (newsData.stocks && newsData.stocks.length > 0) {
      articleHtml += '<ul>\n';
      newsData.stocks.slice(0, 5).forEach((item: NewsItem) => {
        articleHtml += `<li><strong><a href="${item.url}" target="_blank">${item.title}</a></strong><br><small>Source: ${item.source} | ${new Date(item.published_at).toLocaleString()}</small></li>\n`;
      });
      articleHtml += '</ul>\n';
    } else {
      articleHtml += '<p>No stock market news available at this time.</p>\n';
    }
    
    if (newsData.trump && newsData.trump.length > 0) {
      articleHtml += '\n<h2>🏛️ Political & Economic News</h2>\n';
      articleHtml += '<ul>\n';
      newsData.trump.slice(0, 3).forEach((item: NewsItem) => {
        articleHtml += `<li><strong><a href="${item.url}" target="_blank">${item.title}</a></strong><br><small>Source: ${item.source} | ${new Date(item.published_at).toLocaleString()}</small></li>\n`;
      });
      articleHtml += '</ul>\n';
    }
    
    articleHtml += '\n<h2>Market Summary</h2>\n';
    articleHtml += '<p>This market brief aggregates the latest news from cryptocurrency, stock market, and economic sources. ';
    articleHtml += `Generated at ${today.toLocaleString()} with ${allNews.length} news items from various financial news sources.</p>\n`;
    
    articleHtml += '\n<h2>What\'s Next</h2>\n';
    articleHtml += '<p>Stay tuned for developing stories across crypto and traditional markets. Key areas to watch include regulatory developments, ';
    articleHtml += 'Federal Reserve announcements, and major cryptocurrency project updates. This brief will be updated as new information becomes available.</p>\n';

    const freshBrief = {
      slug: dateStr + '-live',
      date: dateStr,
      title: `Live Market Brief — ${dateStr} — Real-Time News Update`,
      summary: `Real-time market update with ${allNews.length} fresh news items from crypto, stocks, and economic markets.`,
      article_html: articleHtml,
      last_word: 'Stay informed with real news, real data, and real market movements. This brief contains actual news sources and links.',
      generated_at: timestamp,
      sources: allNews.map((item: NewsItem) => ({
        url: item.url,
        label: `${item.source}: ${item.title.substring(0, 50)}...`
      })),
      focus_assets: ['BTC', 'ETH', 'SPX'], // Default focus assets
      author: 'XRayCrypto Live News',
      canonical: `https://your-domain.com/marketbrief/${dateStr}-live`
    };
    
    console.log('Fresh brief generated:', freshBrief.title);
    console.log('Total news items processed:', allNews.length);
    
    return new Response(JSON.stringify({
      success: true,
      message: 'Market brief generated successfully with real news',
      result: freshBrief
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error triggering market brief generation:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Failed to trigger market brief generation';
    
    return new Response(JSON.stringify({
      success: false,
      error: errorMessage
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});