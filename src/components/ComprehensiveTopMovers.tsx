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
              <div key={coin.symbol}>
                <div className="flex items-center justify-between py-3 border-b border-border/30 last:border-0 hover:bg-accent/20 transition-colors rounded-lg cursor-pointer group" onClick={() => handleTokenClick(coin.symbol)}>
                  <div className="flex items-center gap-3 flex-1">
                    <span className="text-sm text-muted-foreground w-4">{index + 1}</span>
                    <div className="flex-1">
                      <div className="font-medium flex items-center gap-2">
                        <span className="text-foreground group-hover:text-primary transition-colors">{coin.name}</span>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="text-xs px-2 py-1 h-6 bg-primary/10 text-primary hover:bg-primary/20 font-mono"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleTokenClick(coin.symbol);
                          }}
                        >
                          {coin.symbol.toUpperCase()}
                          <ExternalLink className="w-3 h-3 ml-1" />
                        </Button>
                        {coin.market_cap_rank && coin.market_cap_rank <= 10 && (
                          <Crown className="w-3 h-3 text-yellow-500" />
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        #{coin.market_cap_rank || 'N/A'}
                      </div>
                    </div>
                  </div>
                  <div className="text-right flex items-center gap-3">
                    <div className="h-12 w-20 hidden md:block">
                      <MiniChart symbol={`${coin.symbol.toUpperCase()}USD`} theme={theme} />
                    </div>
                    <div>
                      <div className="font-semibold text-foreground">{formatPrice(coin.price)}</div>
                      <Badge variant="outline" className="text-green-500 border-green-500/20 bg-green-500/10 font-semibold">
                        +{coin.change_24h?.toFixed(2)}%
                      </Badge>
                    </div>
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
        <CardContent className="space-y-3">
          {losers.length > 0 ? (
            losers.slice(0, 5).map((coin: TopMover, index: number) => (
              <div key={coin.symbol}>
                <div className="flex items-center justify-between py-3 border-b border-border/30 last:border-0 hover:bg-accent/20 transition-colors rounded-lg cursor-pointer group" onClick={() => handleTokenClick(coin.symbol)}>
                  <div className="flex items-center gap-3 flex-1">
                    <span className="text-sm text-muted-foreground w-4">{index + 1}</span>
                    <div className="flex-1">
                      <div className="font-medium flex items-center gap-2">
                        <span className="text-foreground group-hover:text-primary transition-colors">{coin.name}</span>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="text-xs px-2 py-1 h-6 bg-primary/10 text-primary hover:bg-primary/20 font-mono"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleTokenClick(coin.symbol);
                          }}
                        >
                          {coin.symbol.toUpperCase()}
                          <ExternalLink className="w-3 h-3 ml-1" />
                        </Button>
                        {coin.market_cap_rank && coin.market_cap_rank <= 10 && (
                          <Crown className="w-3 h-3 text-yellow-500" />
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        #{coin.market_cap_rank || 'N/A'}
                      </div>
                    </div>
                  </div>
                  <div className="text-right flex items-center gap-3">
                    <div className="h-12 w-20 hidden md:block">
                      <MiniChart symbol={`${coin.symbol.toUpperCase()}USD`} theme={theme} />
                    </div>
                    <div>
                      <div className="font-semibold text-foreground">{formatPrice(coin.price)}</div>
                      <Badge variant="outline" className="text-red-500 border-red-500/20 bg-red-500/10 font-semibold">
                        {coin.change_24h?.toFixed(2)}%
                      </Badge>
                    </div>
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
        <CardContent className="space-y-3">
          {trending.length > 0 ? (
            trending.slice(0, 5).map((coin: TrendingCoin, index: number) => (
              <div key={coin.symbol || index}>
                <div className="flex items-center justify-between py-3 border-b border-border/30 last:border-0 hover:bg-accent/20 transition-colors rounded-lg cursor-pointer group" onClick={() => coin.symbol && handleTokenClick(coin.symbol)}>
                  <div className="flex items-center gap-3 flex-1">
                    <span className="text-sm text-muted-foreground w-4">{index + 1}</span>
                    <div className="flex-1">
                      <div className="font-medium flex items-center gap-2">
                        <span className="text-foreground group-hover:text-primary transition-colors">{coin.name || 'Unknown'}</span>
                        {coin.symbol && (
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="text-xs px-2 py-1 h-6 bg-primary/10 text-primary hover:bg-primary/20 font-mono"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleTokenClick(coin.symbol!);
                            }}
                          >
                            {coin.symbol.toUpperCase()}
                            <ExternalLink className="w-3 h-3 ml-1" />
                          </Button>
                        )}
                        {coin.market_cap_rank && coin.market_cap_rank <= 50 && (
                          <Star className="w-3 h-3 text-yellow-500" />
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        #{coin.market_cap_rank || 'N/A'}
                      </div>
                    </div>
                  </div>
                  <div className="text-right flex items-center gap-3">
                    {coin.symbol && (
                      <div className="h-12 w-20 hidden md:block">
                        <MiniChart symbol={`${coin.symbol.toUpperCase()}USD`} theme={theme} />
                      </div>
                    )}
                    <div>
                      <Badge variant="outline" className="text-yellow-500 border-yellow-500/20 bg-yellow-500/10 font-semibold">
                        🔥 Hot
                      </Badge>
                    </div>
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