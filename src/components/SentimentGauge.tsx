import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Brain, Users, Zap } from 'lucide-react';

interface SentimentData {
  name: string;
  symbol: string;
  galaxy_score: number;
  sentiment: number;
  social_volume: number;
}

interface SentimentGaugeProps {
  fearGreedValue: number;
  fearGreedLabel: string;
  socialSentiment: SentimentData[];
}

export function SentimentGauge({ fearGreedValue, fearGreedLabel, socialSentiment }: SentimentGaugeProps) {
  const getFearGreedColor = (value: number) => {
    if (value <= 25) return 'text-red-500 border-red-500/20 bg-red-500/10';
    if (value <= 45) return 'text-orange-500 border-orange-500/20 bg-orange-500/10';
    if (value <= 55) return 'text-yellow-500 border-yellow-500/20 bg-yellow-500/10';
    if (value <= 75) return 'text-green-500 border-green-500/20 bg-green-500/10';
    return 'text-emerald-500 border-emerald-500/20 bg-emerald-500/10';
  };

  const getScoreColor = (score: number) => {
    if (score <= 30) return 'text-red-500';
    if (score <= 50) return 'text-orange-500';
    if (score <= 70) return 'text-yellow-500';
    return 'text-green-500';
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Fear & Greed Index */}
      <Card className="xr-card">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Brain className="w-5 h-5 text-primary" />
            Fear & Greed Index
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center">
          <div className="mb-4">
            <div className="text-4xl font-bold xr-gradient-text mb-2">{fearGreedValue}</div>
            <Badge variant="outline" className={getFearGreedColor(fearGreedValue)}>
              {fearGreedLabel}
            </Badge>
          </div>
          <div className="w-full bg-border rounded-full h-3 mb-2">
            <div 
              className="h-3 rounded-full xr-gradient-primary transition-all duration-1000" 
              style={{ width: `${fearGreedValue}%` }}
            ></div>
          </div>
          <p className="text-sm text-muted-foreground">
            Market sentiment indicator (0 = Extreme Fear, 100 = Extreme Greed)
          </p>
        </CardContent>
      </Card>

      {/* Social Sentiment */}
      <Card className="xr-card">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Users className="w-5 h-5 text-primary" />
            Social Sentiment
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {socialSentiment.length > 0 ? (
            socialSentiment.slice(0, 4).map((asset) => (
              <div key={asset.symbol} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{asset.symbol.toUpperCase()}</span>
                  <div className="flex items-center gap-1">
                    <Zap className="w-3 h-3 text-primary" />
                    <span className="text-sm text-muted-foreground">
                      {asset.social_volume?.toLocaleString() || 0}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <div className={`text-sm font-medium ${getScoreColor(asset.galaxy_score || 0)}`}>
                    {asset.galaxy_score || 0}/100
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Galaxy Score
                  </div>
                </div>
              </div>
            ))
          ) : (
            <p className="text-muted-foreground text-center py-4">No social data available</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}