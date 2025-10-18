import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { TopAssetsSentiment } from '@/components/TopAssetsSentiment';
import { MiniChart } from '@/components/MiniChart';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, Minus, BarChart3, Users } from 'lucide-react';
import { useTheme } from 'next-themes';

interface AssetSentiment {
  id: string;
  asset_symbol: string;
  asset_name: string;
  sentiment_score: number;
  sentiment_label: 'bullish' | 'bearish' | 'neutral';
  positive_count: number;
  negative_count: number;
  neutral_count: number;
  total_articles: number;
  trend_direction?: 'up' | 'down' | 'stable';
  top_keywords?: string[];
  timestamp: string;
}

export default function MarketBriefClean() {
  const [focusAssets, setFocusAssets] = useState<AssetSentiment[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const { theme } = useTheme();

  const fetchFocusAssets = async () => {
    try {
      const { data, error } = await supabase
        .from('asset_sentiment_snapshots')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(100);

      if (error) throw error;

      if (data && data.length > 0) {
        // Group by asset_symbol and get the latest for each
        const latestBySymbol = data.reduce((acc, item) => {
          if (!acc[item.asset_symbol] || new Date(item.timestamp) > new Date(acc[item.asset_symbol].timestamp)) {
            acc[item.asset_symbol] = item;
          }
          return acc;
        }, {} as Record<string, any>);

        // Get top 5 by total_articles
        const top5 = Object.values(latestBySymbol)
          .sort((a: any, b: any) => b.total_articles - a.total_articles)
          .slice(0, 5) as AssetSentiment[];

        setFocusAssets(top5);
        setLastUpdate(new Date());
      }
    } catch (error) {
      console.error('Error fetching focus assets:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFocusAssets();

    // Subscribe to real-time updates
    const channel = supabase
      .channel('asset-sentiment-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'asset_sentiment_snapshots'
        },
        () => {
          fetchFocusAssets();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const getSentimentBadge = (label: string, score: number) => {
    const variant = label === 'bullish' ? 'default' : label === 'bearish' ? 'destructive' : 'secondary';
    return (
      <Badge variant={variant} className="text-xs">
        {label} {score > 0 ? '+' : ''}{score.toFixed(1)}
      </Badge>
    );
  };

  const getTrendIcon = (trend?: string) => {
    if (trend === 'up') return <TrendingUp className="w-4 h-4 text-success" />;
    if (trend === 'down') return <TrendingDown className="w-4 h-4 text-destructive" />;
    return <Minus className="w-4 h-4 text-muted-foreground" />;
  };

  return (
    <div className="container mx-auto px-4 lg:px-8 py-8 max-w-7xl space-y-8">
      {/* Header */}
      <div className="space-y-4">
        <h1 className="text-3xl lg:text-4xl font-bold xr-gradient-text xr-xray-glow">
          Market Sentiment Brief
        </h1>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <div className="w-2 h-2 bg-primary rounded-full animate-pulse"></div>
          <span>Real-time sentiment analysis from latest news articles</span>
          {lastUpdate && (
            <span className="ml-2">
              • Updated {lastUpdate.toLocaleTimeString()}
            </span>
          )}
        </div>
      </div>

      {/* Top Assets Sentiment Widget */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-5 h-5 text-primary" />
          <h2 className="text-xl lg:text-2xl font-semibold xr-pixel-text">Top Asset Sentiment</h2>
        </div>
        <TopAssetsSentiment />
      </section>

      {/* Focus Assets Section */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 className="w-5 h-5 text-primary" />
          <h2 className="text-xl lg:text-2xl font-semibold xr-pixel-text">Focus Assets</h2>
        </div>
        {loading ? (
          <div className="grid grid-cols-1 gap-6">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="xr-card animate-pulse">
                <CardHeader>
                  <div className="h-6 bg-muted rounded w-1/3" />
                </CardHeader>
                <CardContent>
                  <div className="h-64 bg-muted rounded" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6">
            {focusAssets.map((asset) => (
              <Card key={asset.id} className="xr-card overflow-hidden">
                <CardHeader className="border-b border-border">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-3">
                      <CardTitle className="text-xl xr-gradient-text">{asset.asset_symbol}</CardTitle>
                      {getSentimentBadge(asset.sentiment_label, asset.sentiment_score)}
                      {getTrendIcon(asset.trend_direction)}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {asset.total_articles} article{asset.total_articles !== 1 ? 's' : ''}
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">{asset.asset_name}</p>
                </CardHeader>
                <CardContent className="p-6 lg:p-8">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Chart */}
                    <div className="h-[300px] bg-muted/20 rounded-lg overflow-hidden border border-border/50">
                      <MiniChart
                        symbol={asset.asset_symbol}
                        theme={theme === 'dark' ? 'dark' : 'light'}
                        tvOk={true}
                        showFallback={true}
                        assetType="crypto"
                      />
                    </div>

                    {/* Sentiment Breakdown */}
                    <div className="space-y-6">
                      <div>
                        <h4 className="text-sm font-semibold mb-4 flex items-center gap-2">
                          <Users className="w-4 h-4 text-primary" />
                          Sentiment Breakdown
                        </h4>
                        <div className="space-y-3">
                          <div className="flex items-center justify-between p-2 rounded-lg bg-success/10 border border-success/20">
                            <div className="flex items-center gap-2">
                              <div className="w-3 h-3 rounded-full bg-success shadow-sm" />
                              <span className="text-sm font-medium">Positive</span>
                            </div>
                            <span className="text-sm font-bold text-success">{asset.positive_count}</span>
                          </div>
                          <div className="flex items-center justify-between p-2 rounded-lg bg-destructive/10 border border-destructive/20">
                            <div className="flex items-center gap-2">
                              <div className="w-3 h-3 rounded-full bg-destructive shadow-sm" />
                              <span className="text-sm font-medium">Negative</span>
                            </div>
                            <span className="text-sm font-bold text-destructive">{asset.negative_count}</span>
                          </div>
                          <div className="flex items-center justify-between p-2 rounded-lg bg-muted/50 border border-border">
                            <div className="flex items-center gap-2">
                              <div className="w-3 h-3 rounded-full bg-muted-foreground shadow-sm" />
                              <span className="text-sm font-medium">Neutral</span>
                            </div>
                            <span className="text-sm font-bold text-muted-foreground">{asset.neutral_count}</span>
                          </div>
                        </div>
                      </div>

                      {/* Top Keywords */}
                      {asset.top_keywords && asset.top_keywords.length > 0 && (
                        <div className="border-t border-border pt-6">
                          <h4 className="text-sm font-semibold mb-3">Top Keywords</h4>
                          <div className="flex flex-wrap gap-2">
                            {asset.top_keywords.slice(0, 6).map((keyword, idx) => (
                              <Badge key={idx} variant="outline" className="text-xs">
                                {keyword}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Sentiment Score Bar */}
                      <div className="border-t border-border pt-6">
                        <h4 className="text-sm font-semibold mb-4">Sentiment Score</h4>
                        <div className="relative h-2 bg-gradient-to-r from-destructive via-muted to-success rounded-full">
                          <div 
                            className="absolute w-3 h-3 bg-primary rounded-full -top-0.5 transition-all duration-1000 shadow-lg xr-glow-primary"
                            style={{ left: `calc(${((asset.sentiment_score + 100) / 200) * 100}% - 6px)` }}
                          />
                        </div>
                        <div className="flex justify-between text-xs text-muted-foreground mt-2">
                          <span className="font-medium">-100</span>
                          <span className="font-medium">0</span>
                          <span className="font-medium">+100</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
