import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface NewsItem {
  id: string;
  title: string;
  description?: string;
  published_utc: string;
  article_url: string;
  tickers?: string[];
  keywords?: string[];
  sentiment?: 'positive' | 'negative' | 'neutral';
  sentiment_score?: number;
}

interface AssetSentiment {
  ticker: string;
  assetName: string;
  assetType: string;
  score: number;
  label: string;
  positive: number;
  negative: number;
  neutral: number;
  total: number;
  trendDirection: string;
  scoreChange: number;
  keywords: string[];
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { polygonArticles } = await req.json();

    if (!polygonArticles || polygonArticles.length === 0) {
      console.log('No Polygon articles provided');
      return new Response(
        JSON.stringify({ message: 'No articles to process' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    console.log(`Processing ${polygonArticles.length} Polygon articles for asset sentiment`);

    // Group articles by ticker
    const tickerGroups = new Map<string, NewsItem[]>();
    
    polygonArticles.forEach((article: NewsItem) => {
      if (article.tickers && article.tickers.length > 0) {
        article.tickers.forEach(ticker => {
          const normalizedTicker = ticker.toUpperCase();
          if (!tickerGroups.has(normalizedTicker)) {
            tickerGroups.set(normalizedTicker, []);
          }
          tickerGroups.get(normalizedTicker)!.push(article);
        });
      }
    });

    console.log(`Found ${tickerGroups.size} unique tickers`);

    const assetSentiments: AssetSentiment[] = [];
    const timestamp = new Date();

    // Calculate sentiment for each asset
    for (const [ticker, articles] of tickerGroups) {
      const positive = articles.filter(a => a.sentiment === 'positive').length;
      const negative = articles.filter(a => a.sentiment === 'negative').length;
      const neutral = articles.filter(a => a.sentiment === 'neutral').length;
      const total = articles.length;

      // Calculate weighted sentiment score: (positive - negative) / total * 100
      const score = total > 0 ? ((positive - negative) / total) * 100 : 0;

      // Determine sentiment label
      let label = 'neutral';
      if (score > 20) label = 'bullish';
      else if (score < -20) label = 'bearish';

      // Get previous snapshot for trend detection
      const { data: prevSnapshot } = await supabase
        .from('asset_sentiment_snapshots')
        .select('sentiment_score')
        .eq('asset_symbol', ticker)
        .order('timestamp', { ascending: false })
        .limit(1)
        .maybeSingle();

      const prevScore = prevSnapshot?.sentiment_score || 0;
      const scoreChange = score - prevScore;
      
      let trendDirection = 'stable';
      if (scoreChange > 5) trendDirection = 'up';
      else if (scoreChange < -5) trendDirection = 'down';

      // Resolve asset name from ticker_mappings
      const { data: mapping } = await supabase
        .from('ticker_mappings')
        .select('display_name, type')
        .eq('symbol', ticker)
        .maybeSingle();

      const assetName = mapping?.display_name || ticker;
      const assetType = mapping?.type || 'unknown';

      // Extract top keywords
      const keywordCounts = new Map<string, number>();
      articles.forEach(article => {
        article.keywords?.forEach(keyword => {
          keywordCounts.set(keyword, (keywordCounts.get(keyword) || 0) + 1);
        });
      });

      const topKeywords = Array.from(keywordCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([keyword]) => keyword);

      assetSentiments.push({
        ticker,
        assetName,
        assetType,
        score,
        label,
        positive,
        negative,
        neutral,
        total,
        trendDirection,
        scoreChange,
        keywords: topKeywords
      });
    }

    // Get top 10 assets by article count
    const top10 = assetSentiments
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);

    console.log(`Top 10 assets: ${top10.map(a => a.ticker).join(', ')}`);

    // Clean up old snapshots first
    await supabase.rpc('cleanup_old_asset_sentiments');

    // Store snapshots in database
    const insertPromises = top10.map(asset =>
      supabase.from('asset_sentiment_snapshots').insert({
        timestamp,
        asset_symbol: asset.ticker,
        asset_name: asset.assetName,
        asset_type: asset.assetType,
        sentiment_score: asset.score,
        sentiment_label: asset.label,
        positive_count: asset.positive,
        negative_count: asset.negative,
        neutral_count: asset.neutral,
        total_articles: asset.total,
        trend_direction: asset.trendDirection,
        score_change: asset.scoreChange,
        polygon_articles_count: asset.total,
        top_keywords: asset.keywords
      })
    );

    await Promise.all(insertPromises);

    console.log(`Successfully stored sentiment for ${top10.length} assets`);

    return new Response(
      JSON.stringify({
        success: true,
        processed: top10.length,
        timestamp,
        assets: top10.map(a => ({
          symbol: a.ticker,
          name: a.assetName,
          score: a.score,
          label: a.label,
          articles: a.total
        }))
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error) {
    console.error('Error calculating asset sentiment:', error);
    const message = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({ error: message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
