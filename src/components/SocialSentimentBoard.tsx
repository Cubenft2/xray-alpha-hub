import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Users, Zap, Target, TrendingUp, MessageSquare } from 'lucide-react';

interface SocialAsset {
  name: string;
  symbol: string;
  galaxy_score: number;
  alt_rank: number;
  sentiment: number;
  social_volume: number;
  social_dominance: number;
  fomo_score: number;
}

interface SocialSentimentBoardProps {
  marketData: any;
}

export function SocialSentimentBoard({ marketData }: SocialSentimentBoardProps) {
  if (!marketData?.content_sections?.market_data?.social_sentiment) {
    return null;
  }

  const socialAssets: SocialAsset[] = marketData.content_sections.market_data.social_sentiment;

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-emerald-500';
    if (score >= 60) return 'text-green-500';
    if (score >= 40) return 'text-yellow-500';
    if (score >= 20) return 'text-orange-500';
    return 'text-red-500';
  };

  const getScoreBadgeColor = (score: number) => {
    if (score >= 80) return 'text-emerald-500 border-emerald-500/20 bg-emerald-500/10';
    if (score >= 60) return 'text-green-500 border-green-500/20 bg-green-500/10';
    if (score >= 40) return 'text-yellow-500 border-yellow-500/20 bg-yellow-500/10';
    if (score >= 20) return 'text-orange-500 border-orange-500/20 bg-orange-500/10';
    return 'text-red-500 border-red-500/20 bg-red-500/10';
  };

  const getSentimentLabel = (sentiment: number) => {
    if (sentiment >= 0.6) return 'Very Bullish';
    if (sentiment >= 0.2) return 'Bullish';
    if (sentiment >= -0.2) return 'Neutral';
    if (sentiment >= -0.6) return 'Bearish';
    return 'Very Bearish';
  };

  const formatSocialVolume = (volume: number) => {
    if (volume >= 1000000) return `${(volume / 1000000).toFixed(1)}M`;
    if (volume >= 1000) return `${(volume / 1000).toFixed(1)}K`;
    return volume.toString();
  };

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="xr-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              <div>
                <p className="text-sm text-muted-foreground">Assets Tracked</p>
                <p className="text-2xl font-bold">{socialAssets.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="xr-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-yellow-500" />
              <div>
                <p className="text-sm text-muted-foreground">Avg Galaxy Score</p>
                <p className="text-2xl font-bold">
                  {socialAssets.length > 0 
                    ? Math.round(socialAssets.reduce((sum, asset) => sum + (asset.galaxy_score || 0), 0) / socialAssets.length)
                    : 0
                  }
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="xr-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-blue-500" />
              <div>
                <p className="text-sm text-muted-foreground">Total Social Vol</p>
                <p className="text-2xl font-bold">
                  {formatSocialVolume(socialAssets.reduce((sum, asset) => sum + (asset.social_volume || 0), 0))}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="xr-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Target className="w-5 h-5 text-purple-500" />
              <div>
                <p className="text-sm text-muted-foreground">High FOMO Assets</p>
                <p className="text-2xl font-bold">
                  {socialAssets.filter(asset => (asset.fomo_score || 0) > 60).length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Social Sentiment Table */}
      <Card className="xr-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-primary" />
            Social Sentiment Analysis (LunarCrush)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {socialAssets.length > 0 ? (
              socialAssets.map((asset, index) => (
                <div key={asset.symbol} className="border border-border/30 rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-lg font-bold text-muted-foreground">#{index + 1}</span>
                      <div>
                        <h3 className="font-semibold text-lg">{asset.name}</h3>
                        <p className="text-sm text-muted-foreground">
                          {asset.symbol} • AltRank #{asset.alt_rank || 'N/A'}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge variant="outline" className={getScoreBadgeColor(asset.galaxy_score || 0)}>
                        Galaxy Score: {asset.galaxy_score || 0}/100
                      </Badge>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Galaxy Score Progress */}
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>Galaxy Score</span>
                        <span className={getScoreColor(asset.galaxy_score || 0)}>
                          {asset.galaxy_score || 0}/100
                        </span>
                      </div>
                      <Progress value={asset.galaxy_score || 0} className="h-2" />
                    </div>

                    {/* FOMO Score */}
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>FOMO Score</span>
                        <span className={getScoreColor(asset.fomo_score || 0)}>
                          {asset.fomo_score?.toFixed(0) || 0}
                        </span>
                      </div>
                      <Progress value={asset.fomo_score || 0} className="h-2" />
                    </div>

                    {/* Social Volume */}
                    <div>
                      <p className="text-sm text-muted-foreground">Social Volume</p>
                      <p className="font-semibold">{formatSocialVolume(asset.social_volume || 0)}</p>
                    </div>

                    {/* Sentiment */}
                    <div>
                      <p className="text-sm text-muted-foreground">Sentiment</p>
                      <Badge 
                        variant="outline" 
                        className={asset.sentiment >= 0 
                          ? 'text-green-500 border-green-500/20 bg-green-500/10' 
                          : 'text-red-500 border-red-500/20 bg-red-500/10'
                        }
                      >
                        {getSentimentLabel(asset.sentiment || 0)}
                      </Badge>
                    </div>
                  </div>

                  {/* Social Dominance */}
                  {asset.social_dominance && (
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>Social Dominance</span>
                        <span>{asset.social_dominance.toFixed(2)}%</span>
                      </div>
                      <Progress value={asset.social_dominance} className="h-2" />
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="text-center py-8">
                <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No social sentiment data available</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}