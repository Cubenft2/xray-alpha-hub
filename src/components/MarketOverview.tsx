import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, DollarSign, Activity } from 'lucide-react';

interface MarketOverviewProps {
  marketData: any;
}

export function MarketOverview({ marketData }: MarketOverviewProps) {
  if (!marketData?.content_sections?.market_data) {
    return null;
  }

  const data = marketData.content_sections.market_data;
  
  const formatCurrency = (value: number) => {
    if (value >= 1e12) return `$${(value / 1e12).toFixed(2)}T`;
    if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
    if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
    return `$${value.toLocaleString()}`;
  };

  const getFearGreedColor = (value: number) => {
    if (value <= 25) return 'text-red-500 border-red-500/20 bg-red-500/10';
    if (value <= 45) return 'text-orange-500 border-orange-500/20 bg-orange-500/10';
    if (value <= 55) return 'text-yellow-500 border-yellow-500/20 bg-yellow-500/10';
    if (value <= 75) return 'text-green-500 border-green-500/20 bg-green-500/10';
    return 'text-emerald-500 border-emerald-500/20 bg-emerald-500/10';
  };

  const getTrendIcon = (trend: number) => {
    if (trend > 0) return <TrendingUp className="w-4 h-4 text-green-500" />;
    if (trend < 0) return <TrendingDown className="w-4 h-4 text-red-500" />;
    return <Activity className="w-4 h-4 text-muted-foreground" />;
  };

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Total Market Cap */}
      <Card className="xr-card">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Market Cap</p>
              <p className="text-2xl font-bold">
                {formatCurrency(data.total_market_cap || 0)}
              </p>
            </div>
            <DollarSign className="w-8 h-8 text-primary/60" />
          </div>
        </CardContent>
      </Card>

      {/* 24h Volume */}
      <Card className="xr-card">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">24h Volume</p>
              <p className="text-2xl font-bold">
                {formatCurrency(data.total_volume || 0)}
              </p>
            </div>
            <Activity className="w-8 h-8 text-primary/60" />
          </div>
        </CardContent>
      </Card>

      {/* Fear & Greed Index */}
      <Card className="xr-card">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Fear & Greed</p>
              <div className="flex items-center gap-2">
                <p className="text-2xl font-bold">{data.fear_greed_index || 50}</p>
                {getTrendIcon(data.fear_greed_trend || 0)}
              </div>
              <Badge 
                variant="outline" 
                className={`mt-1 ${getFearGreedColor(data.fear_greed_index || 50)}`}
              >
                {data.fear_greed_label || 'Neutral'}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Biggest Mover */}
      <Card className="xr-card">
        <CardContent className="p-6">
          <div>
            <p className="text-sm text-muted-foreground">Biggest Mover</p>
            {data.biggest_mover ? (
              <>
                <p className="font-bold text-lg truncate">
                  {data.biggest_mover.name}
                </p>
                <div className="flex items-center gap-2">
                  <Badge 
                    variant="outline" 
                    className={data.biggest_mover.change_24h > 0 
                      ? 'text-green-500 border-green-500/20 bg-green-500/10' 
                      : 'text-red-500 border-red-500/20 bg-red-500/10'
                    }
                  >
                    {data.biggest_mover.change_24h > 0 ? '+' : ''}
                    {data.biggest_mover.change_24h?.toFixed(1)}%
                  </Badge>
                </div>
              </>
            ) : (
              <p className="text-muted-foreground">No significant moves</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}