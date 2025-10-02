import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { TrendingUp, TrendingDown, DollarSign, Activity, ExternalLink } from 'lucide-react';

interface MarketOverviewProps {
  marketData: any;
}

export function MarketOverview({ marketData }: MarketOverviewProps) {
  const navigate = useNavigate();

  if (!marketData?.content_sections?.market_data) {
    return null;
  }

  const data = marketData.content_sections.market_data;
  
  // Hide if all key metrics are zero/empty
  const hasData = data.total_market_cap > 0 || data.total_volume > 0 || 
                  data.fear_greed_index > 0 || data.biggest_mover;
  
  if (!hasData) {
    return (
      <Card className="xr-card">
        <CardContent className="p-6 text-center">
          <p className="text-muted-foreground">Market overview data temporarily unavailable</p>
        </CardContent>
      </Card>
    );
  }

  const handleCryptoNavigation = () => {
    navigate('/crypto');
  };

  const handleStockNavigation = () => {
    navigate('/markets');
  };
  
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
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Total Market Cap */}
      <Card className="xr-card hover:bg-accent/20 transition-colors cursor-pointer group" onClick={handleCryptoNavigation}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-green-500" />
              <div>
                <p className="text-sm text-muted-foreground">Total Market Cap</p>
                <p className="text-xl font-bold text-green-500 group-hover:text-green-400 transition-colors">
                  {formatCurrency(data.total_market_cap || 0)}
                </p>
              </div>
            </div>
            <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100 transition-opacity">
              <ExternalLink className="w-4 h-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 24h Volume */}
      <Card className="xr-card hover:bg-accent/20 transition-colors cursor-pointer group" onClick={handleCryptoNavigation}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-blue-500" />
              <div>
                <p className="text-sm text-muted-foreground">24h Volume</p>
                <p className="text-xl font-bold text-blue-500 group-hover:text-blue-400 transition-colors">
                  {formatCurrency(data.total_volume || 0)}
                </p>
              </div>
            </div>
            <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100 transition-opacity">
              <ExternalLink className="w-4 h-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Fear & Greed Index */}
      <Card className="xr-card hover:bg-accent/20 transition-colors cursor-pointer group" onClick={handleStockNavigation}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {getTrendIcon(data.fear_greed_trend || 0)}
              <div>
                <p className="text-sm text-muted-foreground">Fear & Greed</p>
                <div className="flex items-center gap-2">
                  <p className="text-xl font-bold text-foreground">
                    {data.fear_greed_index || 50}
                  </p>
                  <Badge variant="outline" className={`${getFearGreedColor(data.fear_greed_index || 50)} font-semibold`}>
                    {data.fear_greed_label || 'Neutral'}
                  </Badge>
                </div>
              </div>
            </div>
            <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100 transition-opacity">
              <ExternalLink className="w-4 h-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Biggest Mover */}
      <Card className="xr-card hover:bg-accent/20 transition-colors cursor-pointer group" onClick={handleCryptoNavigation}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-yellow-500" />
              <div>
                <p className="text-sm text-muted-foreground">Biggest Mover</p>
                {data.biggest_mover ? (
                  <>
                    <div className="space-y-1">
                      <p className="text-lg font-bold text-foreground">
                        {data.biggest_mover.name}
                      </p>
                      <div className="flex items-center gap-2">
                        {data.biggest_mover.change_24h && (
                          <Badge 
                            variant="outline" 
                            className={`${data.biggest_mover.change_24h > 0 
                              ? 'text-green-500 border-green-500/20 bg-green-500/10' 
                              : 'text-red-500 border-red-500/20 bg-red-500/10'
                            } font-semibold text-xs`}
                          >
                            {data.biggest_mover.change_24h > 0 ? '+' : ''}
                            {data.biggest_mover.change_24h.toFixed(2)}%
                          </Badge>
                        )}
                      </div>
                    </div>
                  </>
                ) : (
                  <p className="text-muted-foreground">No data available</p>
                )}
              </div>
            </div>
            <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100 transition-opacity">
              <ExternalLink className="w-4 h-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}