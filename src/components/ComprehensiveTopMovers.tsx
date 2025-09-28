import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, Star, Crown } from 'lucide-react';

interface TopMover {
  name: string;
  symbol: string;
  change_24h: number;
  price: number;
  market_cap_rank?: number;
}

interface TrendingCoin {
  name: string;
  symbol: string;
  market_cap_rank?: number;
}

interface ComprehensiveTopMoversProps {
  marketData: any;
}

export function ComprehensiveTopMovers({ marketData }: ComprehensiveTopMoversProps) {
  if (!marketData?.content_sections?.market_data) {
    return null;
  }

  const data = marketData.content_sections.market_data;
  const gainers = data.top_gainers || [];
  const losers = data.top_losers || [];
  const trending = data.trending_coins || [];

  const formatPrice = (price: number) => {
    if (price < 0.01) return `$${price.toFixed(6)}`;
    if (price < 1) return `$${price.toFixed(4)}`;
    return `$${price.toLocaleString()}`;
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Top Gainers */}
      <Card className="xr-card">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <TrendingUp className="w-5 h-5 text-green-500" />
            Top Gainers (24h)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {gainers.length > 0 ? (
            gainers.slice(0, 5).map((coin: TopMover, index: number) => (
              <div key={coin.symbol} className="flex items-center justify-between py-2 border-b border-border/30 last:border-0">
                <div className="flex items-center gap-3">
                  <span className="text-sm text-muted-foreground w-4">{index + 1}</span>
                  <div>
                    <div className="font-medium flex items-center gap-1">
                      {coin.name}
                      {coin.market_cap_rank && coin.market_cap_rank <= 10 && (
                        <Crown className="w-3 h-3 text-yellow-500" />
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {coin.symbol.toUpperCase()} • #{coin.market_cap_rank || 'N/A'}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-medium text-sm">{formatPrice(coin.price)}</div>
                  <Badge variant="outline" className="text-green-500 border-green-500/20 bg-green-500/10">
                    +{coin.change_24h?.toFixed(2)}%
                  </Badge>
                </div>
              </div>
            ))
          ) : (
            <p className="text-muted-foreground text-center py-4">No gainer data available</p>
          )}
        </CardContent>
      </Card>

      {/* Top Losers */}
      <Card className="xr-card">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <TrendingDown className="w-5 h-5 text-red-500" />
            Top Losers (24h)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {losers.length > 0 ? (
            losers.slice(0, 5).map((coin: TopMover, index: number) => (
              <div key={coin.symbol} className="flex items-center justify-between py-2 border-b border-border/30 last:border-0">
                <div className="flex items-center gap-3">
                  <span className="text-sm text-muted-foreground w-4">{index + 1}</span>
                  <div>
                    <div className="font-medium flex items-center gap-1">
                      {coin.name}
                      {coin.market_cap_rank && coin.market_cap_rank <= 10 && (
                        <Crown className="w-3 h-3 text-yellow-500" />
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {coin.symbol.toUpperCase()} • #{coin.market_cap_rank || 'N/A'}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-medium text-sm">{formatPrice(coin.price)}</div>
                  <Badge variant="outline" className="text-red-500 border-red-500/20 bg-red-500/10">
                    {coin.change_24h?.toFixed(2)}%
                  </Badge>
                </div>
              </div>
            ))
          ) : (
            <p className="text-muted-foreground text-center py-4">No loser data available</p>
          )}
        </CardContent>
      </Card>

      {/* Trending/Hot Coins */}
      <Card className="xr-card">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Star className="w-5 h-5 text-yellow-500" />
            Trending Coins
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {trending.length > 0 ? (
            trending.slice(0, 5).map((coin: TrendingCoin, index: number) => (
              <div key={coin.symbol || index} className="flex items-center justify-between py-2 border-b border-border/30 last:border-0">
                <div className="flex items-center gap-3">
                  <span className="text-sm text-muted-foreground w-4">{index + 1}</span>
                  <div>
                    <div className="font-medium flex items-center gap-1">
                      {coin.name || 'Unknown'}
                      {coin.market_cap_rank && coin.market_cap_rank <= 50 && (
                        <Star className="w-3 h-3 text-yellow-500" />
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {coin.symbol?.toUpperCase() || 'N/A'} • #{coin.market_cap_rank || 'N/A'}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <Badge variant="outline" className="text-yellow-500 border-yellow-500/20 bg-yellow-500/10">
                    Hot
                  </Badge>
                </div>
              </div>
            ))
          ) : (
            <p className="text-muted-foreground text-center py-4">No trending data available</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}