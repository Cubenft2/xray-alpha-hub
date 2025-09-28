import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { TrendingUp, TrendingDown, Activity, Zap, Target } from 'lucide-react';

interface SocialSentiment {
  id: string;
  asset_symbol: string;
  asset_name: string;
  sentiment_score: number;
  social_volume: number;
  social_volume_24h_change: number;
  galaxy_score: number;
  trending_rank: number;
  data_timestamp: string;
}

export function SocialSentimentDashboard() {
  const { data: sentimentData, isLoading } = useQuery({
    queryKey: ['social_sentiment_dashboard'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('social_sentiment')
        .select('*')
        .order('data_timestamp', { ascending: false })
        .limit(12);
      
      if (error) throw error;
      return data as SocialSentiment[];
    },
    refetchInterval: 30000 // Refresh every 30 seconds
  });

  const getSentimentColor = (score: number) => {
    if (score > 40) return 'text-green-500';
    if (score > 0) return 'text-green-400'; 
    if (score > -40) return 'text-red-400';
    return 'text-red-500';
  };

  const getSentimentIcon = (score: number) => {
    if (score > 20) return <TrendingUp className="h-4 w-4 text-green-500" />;
    if (score < -20) return <TrendingDown className="h-4 w-4 text-red-500" />;
    return <Activity className="h-4 w-4 text-yellow-500" />;
  };

  const getVolumeChangeColor = (change: number) => {
    if (change > 50) return 'text-green-500 font-bold';
    if (change > 0) return 'text-green-400';
    if (change > -50) return 'text-red-400';
    return 'text-red-500';
  };

  if (isLoading) {
    return (
      <Card className="xr-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            📊 Social Radar Loading...
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="h-4 bg-muted rounded mb-2"></div>
                <div className="h-2 bg-muted rounded"></div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!sentimentData || sentimentData.length === 0) {
    return (
      <Card className="xr-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            📊 Social Radar
          </CardTitle>
          <CardDescription>No social sentiment data available</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Waiting for social intelligence to be collected...
          </p>
        </CardContent>
      </Card>
    );
  }

  // Get top movers by social volume change
  const topMovers = sentimentData
    .filter(item => Math.abs(item.social_volume_24h_change) > 20)
    .sort((a, b) => Math.abs(b.social_volume_24h_change) - Math.abs(a.social_volume_24h_change))
    .slice(0, 3);

  // Get extreme sentiment
  const extremeSentiment = sentimentData
    .filter(item => Math.abs(item.sentiment_score) > 30)
    .sort((a, b) => Math.abs(b.sentiment_score) - Math.abs(a.sentiment_score))
    .slice(0, 3);

  return (
    <div className="space-y-6">
      {/* Social Radar Header */}
      <Card className="xr-card bg-gradient-to-r from-blue-500/10 to-purple-500/10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-2xl">
            📊 Social Radar - Live Intelligence
          </CardTitle>
          <CardDescription>
            Real-time social sentiment tracking powered by LunarCrush
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold">{sentimentData.length}</div>
              <p className="text-sm text-muted-foreground">Assets Tracked</p>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">{topMovers.length}</div>
              <p className="text-sm text-muted-foreground">Volume Spikes</p>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">{extremeSentiment.length}</div>
              <p className="text-sm text-muted-foreground">Extreme Sentiment</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Hot Social Activity */}
      {topMovers.length > 0 && (
        <Card className="xr-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              🔥 Hot Social Activity
            </CardTitle>
            <CardDescription>
              Assets with significant social volume changes
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {topMovers.map((item) => (
                <div key={item.id} className="flex items-center justify-between p-3 rounded-lg border">
                  <div className="flex items-center gap-3">
                    <Zap className="h-5 w-5 text-yellow-500" />
                    <div>
                      <div className="font-semibold">{item.asset_symbol}</div>
                      <div className="text-sm text-muted-foreground">{item.asset_name}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`font-bold ${getVolumeChangeColor(item.social_volume_24h_change)}`}>
                      {item.social_volume_24h_change > 0 ? '+' : ''}{item.social_volume_24h_change.toFixed(1)}%
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Vol: {item.social_volume.toLocaleString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Sentiment Extremes */}
      {extremeSentiment.length > 0 && (
        <Card className="xr-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              🎯 Sentiment Extremes
            </CardTitle>
            <CardDescription>
              Assets with very bullish or bearish sentiment
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {extremeSentiment.map((item) => (
                <div key={item.id} className="flex items-center justify-between p-3 rounded-lg border">
                  <div className="flex items-center gap-3">
                    {getSentimentIcon(item.sentiment_score)}
                    <div>
                      <div className="font-semibold">{item.asset_symbol}</div>
                      <div className="text-sm text-muted-foreground">{item.asset_name}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`font-bold ${getSentimentColor(item.sentiment_score)}`}>
                      {item.sentiment_score.toFixed(1)}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Galaxy: {item.galaxy_score.toFixed(1)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Full Social Sentiment Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {sentimentData.map((item) => (
          <Card key={item.id} className="xr-card hover:shadow-lg transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  {item.asset_symbol}
                  {getSentimentIcon(item.sentiment_score)}
                </CardTitle>
                <Badge variant="outline">#{item.trending_rank}</Badge>
              </div>
              <CardDescription>{item.asset_name}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Sentiment Score */}
              <div className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span>Sentiment</span>
                  <span className={getSentimentColor(item.sentiment_score)}>
                    {item.sentiment_score.toFixed(1)}
                  </span>
                </div>
                <Progress 
                  value={Math.abs(item.sentiment_score)} 
                  className="h-2"
                />
              </div>

              {/* Social Volume */}
              <div className="flex justify-between text-sm">
                <span>Social Volume</span>
                <div className="text-right">
                  <div className="font-medium">{item.social_volume.toLocaleString()}</div>
                  <div className={`text-xs ${getVolumeChangeColor(item.social_volume_24h_change)}`}>
                    {item.social_volume_24h_change > 0 ? '+' : ''}{item.social_volume_24h_change.toFixed(1)}%
                  </div>
                </div>
              </div>

              {/* Galaxy Score */}
              {item.galaxy_score > 0 && (
                <div className="flex justify-between text-sm">
                  <span>Galaxy Score</span>
                  <span className="font-medium">{item.galaxy_score.toFixed(1)}</span>
                </div>
              )}

              {/* Timestamp */}
              <div className="text-xs text-muted-foreground">
                Updated {new Date(item.data_timestamp).toLocaleTimeString()}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}