import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface TopMover {
  name: string;
  symbol: string;
  change_24h: number;
  price: number;
}

interface TopMoversTableProps {
  gainers: TopMover[];
  losers: TopMover[];
}

export function TopMoversTable({ gainers, losers }: TopMoversTableProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
            gainers.map((coin, index) => (
              <div key={coin.symbol} className="flex items-center justify-between py-2 border-b border-border/30 last:border-0">
                <div className="flex items-center gap-3">
                  <span className="text-sm text-muted-foreground w-4">{index + 1}</span>
                  <div>
                    <div className="font-medium">{coin.name}</div>
                    <div className="text-sm text-muted-foreground">{coin.symbol.toUpperCase()}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-medium">${coin.price?.toFixed(4)}</div>
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
            losers.map((coin, index) => (
              <div key={coin.symbol} className="flex items-center justify-between py-2 border-b border-border/30 last:border-0">
                <div className="flex items-center gap-3">
                  <span className="text-sm text-muted-foreground w-4">{index + 1}</span>
                  <div>
                    <div className="font-medium">{coin.name}</div>
                    <div className="text-sm text-muted-foreground">{coin.symbol.toUpperCase()}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-medium">${coin.price?.toFixed(4)}</div>
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
    </div>
  );
}