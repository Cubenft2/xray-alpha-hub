import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TrendingUp, TrendingDown, Activity } from 'lucide-react';

interface PriceData {
  symbol: string;
  name: string;
  price: number;
  change_24h: number;
  volume: number;
  sentiment?: number;
}

interface PriceSnapshotTableProps {
  data?: PriceData[];
  className?: string;
}

export function PriceSnapshotTable({ data = [], className = "" }: PriceSnapshotTableProps) {
  const formatPrice = (price: number) => {
    if (price >= 1) return `$${price.toFixed(2)}`;
    if (price >= 0.01) return `$${price.toFixed(4)}`;
    return `$${price.toFixed(6)}`;
  };

  const formatVolume = (volume: number) => {
    if (volume >= 1e9) return `$${(volume / 1e9).toFixed(1)}B`;
    if (volume >= 1e6) return `$${(volume / 1e6).toFixed(1)}M`;
    if (volume >= 1e3) return `$${(volume / 1e3).toFixed(1)}K`;
    return `$${volume.toFixed(0)}`;
  };

  const getSentimentIcon = (sentiment?: number) => {
    if (!sentiment) return null;
    return sentiment > 0 ? (
      <TrendingUp className="h-3 w-3 text-success" />
    ) : (
      <TrendingDown className="h-3 w-3 text-destructive" />
    );
  };

  return (
    <Card className={`xr-card ${className}`}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl">
          <Activity className="h-6 w-6 text-primary" />
          Market Reaction — Live Snapshot
        </CardTitle>
      </CardHeader>
      <CardContent>
        {data.length > 0 ? (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="font-pixel">Asset</TableHead>
                  <TableHead className="text-right font-pixel">Price</TableHead>
                  <TableHead className="text-right font-pixel">24h %</TableHead>
                  <TableHead className="text-right font-pixel">Volume</TableHead>
                  <TableHead className="text-center font-pixel">Sentiment</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((asset) => (
                  <TableRow key={asset.symbol} className="hover:bg-background/50">
                    <TableCell>
                      <div>
                        <div className="font-semibold">{asset.symbol}</div>
                        <div className="text-xs text-muted-foreground truncate max-w-24">
                          {asset.name}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatPrice(asset.price)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge 
                        variant={asset.change_24h >= 0 ? 'default' : 'destructive'}
                        className="text-xs"
                      >
                        {asset.change_24h >= 0 ? '+' : ''}{asset.change_24h.toFixed(2)}%
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {formatVolume(asset.volume)}
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        {getSentimentIcon(asset.sentiment)}
                        {asset.sentiment && (
                          <span className="text-xs">
                            {asset.sentiment.toFixed(1)}
                          </span>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Market data loading...</p>
            <p className="text-xs">CoinGecko & Binance feeds</p>
          </div>
        )}
        
        <div className="mt-4 text-center">
          <Badge variant="outline" className="text-xs font-pixel">
            CoinGecko Pro + Binance + LunarCrush
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}