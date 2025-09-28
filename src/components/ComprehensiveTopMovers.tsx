import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { TrendingUp, TrendingDown, Star, Crown, ExternalLink } from 'lucide-react';
import { MiniChart } from './MiniChart';
import { useTheme } from 'next-themes';

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
  const navigate = useNavigate();
  const { theme } = useTheme();

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

  const handleTokenClick = (symbol: string) => {
    // Navigate to crypto page with the token symbol
    navigate(`/crypto?symbol=${symbol.toUpperCase()}`);
  };

  return (
    <div className="grid grid-cols-1 2xl:grid-cols-3 gap-6">
      {/* Top Gainers */}
      <Card className="xr-card">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <TrendingUp className="w-5 h-5 text-green-500" />
            Top Gainers (24h)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {gainers.length > 0 ? (
            gainers.slice(0, 5).map((coin: TopMover, index: number) => (
              <div key={coin.symbol}>
                <div 
                  className="grid grid-cols-12 items-center gap-2 py-3 border-b border-border/30 last:border-0 hover:bg-accent/20 transition-colors rounded-lg cursor-pointer group"
                  onClick={() => handleTokenClick(coin.symbol)}
                >
                  <div className="col-span-1 text-xs text-muted-foreground text-center sm:text-left">
                    {index + 1}
                  </div>

                  <div className="col-span-5 min-w-0">
                    <div className="font-medium flex items-center gap-1 flex-wrap">
                      <span className="text-foreground group-hover:text-primary transition-colors truncate">
                        {coin.name}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs px-1.5 py-0.5 h-5 bg-primary/10 text-primary hover:bg-primary/20 font-mono flex-shrink-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleTokenClick(coin.symbol);
                        }}
                      >
                        {coin.symbol.toUpperCase()}
                        <ExternalLink className="w-2.5 h-2.5 ml-1" />
                      </Button>
                      {coin.market_cap_rank && coin.market_cap_rank <= 10 && (
                        <Crown className="w-3 h-3 text-yellow-500 flex-shrink-0" />
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      #{coin.market_cap_rank || 'N/A'}
                    </div>
                  </div>

                  <div className="col-span-3 hidden xl:block">
                    <div className="h-12 w-full min-w-[100px]">
                      <MiniChart symbol={`${coin.symbol.toUpperCase()}USD`} theme={theme} />
                    </div>
                  </div>

                  <div className="col-span-3 xl:col-span-3 text-right flex flex-col items-end justify-center">
                    <div className="font-semibold text-sm text-foreground">
                      {formatPrice(coin.price)}
                    </div>
                    <Badge
                      variant="outline"
                      className="text-green-500 border-green-500/20 bg-green-500/10 font-semibold text-xs"
                    >
                      +{coin.change_24h?.toFixed(2)}%
                    </Badge>
                  </div>
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
        <CardContent className="space-y-2">
          {losers.length > 0 ? (
            losers.slice(0, 5).map((coin: TopMover, index: number) => (
              <div key={coin.symbol}>
                <div 
                  className="grid grid-cols-12 items-center gap-2 py-3 border-b border-border/30 last:border-0 hover:bg-accent/20 transition-colors rounded-lg cursor-pointer group"
                  onClick={() => handleTokenClick(coin.symbol)}
                >
                  <div className="col-span-1 text-xs text-muted-foreground text-center sm:text-left">
                    {index + 1}
                  </div>

                  <div className="col-span-5 min-w-0">
                    <div className="font-medium flex items-center gap-1 flex-wrap">
                      <span className="text-foreground group-hover:text-primary transition-colors truncate">
                        {coin.name}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs px-1.5 py-0.5 h-5 bg-primary/10 text-primary hover:bg-primary/20 font-mono flex-shrink-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleTokenClick(coin.symbol);
                        }}
                      >
                        {coin.symbol.toUpperCase()}
                        <ExternalLink className="w-2.5 h-2.5 ml-1" />
                      </Button>
                      {coin.market_cap_rank && coin.market_cap_rank <= 10 && (
                        <Crown className="w-3 h-3 text-yellow-500 flex-shrink-0" />
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      #{coin.market_cap_rank || 'N/A'}
                    </div>
                  </div>

                  <div className="col-span-3 hidden xl:block">
                    <div className="h-12 w-full min-w-[100px]">
                      <MiniChart symbol={`${coin.symbol.toUpperCase()}USD`} theme={theme} />
                    </div>
                  </div>

                  <div className="col-span-3 xl:col-span-3 text-right flex flex-col items-end justify-center">
                    <div className="font-semibold text-sm text-foreground">
                      {formatPrice(coin.price)}
                    </div>
                    <Badge
                      variant="outline"
                      className="text-red-500 border-red-500/20 bg-red-500/10 font-semibold text-xs"
                    >
                      {coin.change_24h?.toFixed(2)}%
                    </Badge>
                  </div>
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
        <CardContent className="space-y-2">
          {trending.length > 0 ? (
            trending.slice(0, 5).map((coin: TrendingCoin, index: number) => (
              <div key={coin.symbol || index}>
                <div 
                  className="grid grid-cols-12 items-center gap-2 py-3 border-b border-border/30 last:border-0 hover:bg-accent/20 transition-colors rounded-lg cursor-pointer group"
                  onClick={() => coin.symbol && handleTokenClick(coin.symbol)}
                >
                  <div className="col-span-1 text-xs text-muted-foreground text-center sm:text-left">
                    {index + 1}
                  </div>

                  <div className="col-span-5 min-w-0">
                    <div className="font-medium flex items-center gap-1 flex-wrap">
                      <span className="text-foreground group-hover:text-primary transition-colors truncate">
                        {coin.name || 'Unknown'}
                      </span>
                      {coin.symbol && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-xs px-1.5 py-0.5 h-5 bg-primary/10 text-primary hover:bg-primary/20 font-mono flex-shrink-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleTokenClick(coin.symbol!);
                          }}
                        >
                          {coin.symbol.toUpperCase()}
                          <ExternalLink className="w-2.5 h-2.5 ml-1" />
                        </Button>
                      )}
                      {coin.market_cap_rank && coin.market_cap_rank <= 50 && (
                        <Star className="w-3 h-3 text-yellow-500 flex-shrink-0" />
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      #{coin.market_cap_rank || 'N/A'}
                    </div>
                  </div>

                  {coin.symbol && (
                    <div className="col-span-3 hidden xl:block">
                      <div className="h-12 w-full min-w-[100px]">
                        <MiniChart symbol={`${coin.symbol.toUpperCase()}USD`} theme={theme} />
                      </div>
                    </div>
                  )}

                  <div className="col-span-3 xl:col-span-3 text-right flex flex-col items-end justify-center">
                    <Badge
                      variant="outline"
                      className="text-yellow-500 border-yellow-500/20 bg-yellow-500/10 font-semibold text-xs"
                    >
                      🔥 Hot
                    </Badge>
                  </div>
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