import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { TrendingUp, TrendingDown, Star, Crown, ExternalLink } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useLivePrices } from '@/hooks/useLivePrices';

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
  price?: number;
  change_24h?: number;
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
  const gainers: TopMover[] = data.top_gainers || [];
  const losers: TopMover[] = data.top_losers || [];
  const trending: TrendingCoin[] = data.trending_coins || [];

  // Live prices for trending coins
  const trendingSymbols = Array.from(
    new Set((trending || []).map((c) => c.symbol).filter(Boolean).map((s) => s!.toUpperCase()))
  );
  const { prices: trendingPrices } = useLivePrices(trendingSymbols);

  const formatPrice = (price: number) => {
    if (price < 0.01) return `$${price.toFixed(6)}`;
    if (price < 1) return `$${price.toFixed(4)}`;
    return `$${price.toLocaleString()}`;
  };

  const handleTokenClick = (symbol: string) => {
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
            gainers.slice(0, 5).map((coin, index) => (
              <div key={coin.symbol}>
                <div
                  className="grid grid-cols-12 items-center gap-2 py-3 border-b border-border/30 last:border-0 hover:bg-accent/20 transition-colors rounded-lg cursor-pointer group"
                  onClick={() => handleTokenClick(coin.symbol)}
                >
                  <div className="col-span-1 text-xs text-muted-foreground text-center sm:text-left">
                    {index + 1}
                  </div>

                  <div className="col-span-7 min-w-0">
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
                    <div className="text-xs text-muted-foreground truncate">#{coin.market_cap_rank || 'N/A'}</div>
                  </div>

                  <div className="col-span-4 text-right flex flex-col items-end justify-center">
                    <div className="font-semibold text-sm text-foreground">{formatPrice(coin.price)}</div>
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
            losers.slice(0, 5).map((coin, index) => (
              <div key={coin.symbol}>
                <div
                  className="grid grid-cols-12 items-center gap-2 py-3 border-b border-border/30 last:border-0 hover:bg-accent/20 transition-colors rounded-lg cursor-pointer group"
                  onClick={() => handleTokenClick(coin.symbol)}
                >
                  <div className="col-span-1 text-xs text-muted-foreground text-center sm:text-left">
                    {index + 1}
                  </div>

                  <div className="col-span-7 min-w-0">
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
                    <div className="text-xs text-muted-foreground truncate">#{coin.market_cap_rank || 'N/A'}</div>
                  </div>

                  <div className="col-span-4 text-right flex flex-col items-end justify-center">
                    <div className="font-semibold text-sm text-foreground">{formatPrice(coin.price)}</div>
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
            🔥 Trending Coins
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {trending.length > 0 ? (
            trending.slice(0, 5).map((coin, index) => {
              const pData = coin.symbol ? trendingPrices[coin.symbol.toUpperCase()] : undefined;
              const price = pData?.price ?? coin.price;
              const change = pData?.change_24h ?? coin.change_24h;

              return (
                <div key={coin.symbol || index}>
                  <div
                    className="grid grid-cols-12 items-center gap-2 py-3 border-b border-border/30 last:border-0 hover:bg-accent/20 transition-colors rounded-lg cursor-pointer group"
                    onClick={() => coin.symbol && handleTokenClick(coin.symbol)}
                  >
                    <div className="col-span-1 text-xs text-muted-foreground text-center sm:text-left">
                      {index + 1}
                    </div>

                    <div className="col-span-7 min-w-0">
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
                      <div className="text-xs text-muted-foreground truncate">#{coin.market_cap_rank || 'N/A'}</div>
                    </div>

                    <div className="col-span-4 text-right flex flex-col items-end justify-center">
                      {typeof price === 'number' ? (
                        <>
                          <div className="font-semibold text-sm text-foreground">{formatPrice(price)}</div>
                          <Badge
                            variant="outline"
                            className={`${(change ?? 0) >= 0 ? 'text-green-500 border-green-500/20 bg-green-500/10' : 'text-red-500 border-red-500/20 bg-red-500/10'} font-semibold text-xs`}
                          >
                            {(change ?? 0) >= 0 ? '+' : ''}{(change ?? 0).toFixed(2)}%
                          </Badge>
                        </>
                      ) : (
                        <>
                          <div className="font-semibold text-sm text-muted-foreground mb-1">—</div>
                          <Badge
                            variant="outline"
                            className="text-muted-foreground border-muted-foreground/20 bg-muted/10 font-semibold text-xs"
                          >
                            Trending
                          </Badge>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <p className="text-muted-foreground text-center py-4">No trending data available</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
