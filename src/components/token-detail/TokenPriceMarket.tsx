import { TrendingUp, TrendingDown } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface TokenPriceMarketProps {
  priceUsd: number | null;
  change1hPct: number | null;
  change24hPct: number | null;
  change7dPct: number | null;
  change30dPct: number | null;
  high24h: number | null;
  low24h: number | null;
  athPrice: number | null;
  atlPrice: number | null;
  marketCap: number | null;
  volume24h: number | null;
  marketDominance: number | null;
  circulatingSupply: number | null;
  totalSupply: number | null;
  fullyDilutedValuation: number | null;
}

export function TokenPriceMarket({
  priceUsd,
  change1hPct,
  change24hPct,
  change7dPct,
  change30dPct,
  high24h,
  low24h,
  athPrice,
  atlPrice,
  marketCap,
  volume24h,
  marketDominance,
  circulatingSupply,
  totalSupply,
  fullyDilutedValuation,
}: TokenPriceMarketProps) {
  const formatCurrency = (value: number | null) => {
    if (value === null || value === undefined || isNaN(value)) return 'N/A';
    if (value >= 1e12) return `$${(value / 1e12).toFixed(2)}T`;
    if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
    if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
    if (value >= 1e3) return `$${(value / 1e3).toFixed(2)}K`;
    if (value < 0.0001) return `$${value.toFixed(8)}`;
    if (value < 1) return `$${value.toFixed(4)}`;
    return `$${value.toFixed(2)}`;
  };

  const formatSupply = (value: number | null) => {
    if (value === null) return 'N/A';
    if (value >= 1e12) return `${(value / 1e12).toFixed(2)}T`;
    if (value >= 1e9) return `${(value / 1e9).toFixed(2)}B`;
    if (value >= 1e6) return `${(value / 1e6).toFixed(2)}M`;
    return value.toLocaleString();
  };

  const formatPercent = (value: number | null) => {
    if (value === null) return null;
    const color = value >= 0 ? 'text-green-500' : 'text-destructive';
    const icon = value >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />;
    return (
      <span className={`flex items-center gap-1 ${color}`}>
        {icon}
        {value >= 0 ? '+' : ''}{value.toFixed(2)}%
      </span>
    );
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Price Card */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-muted-foreground">Price</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-baseline gap-3 flex-wrap">
            <span className="text-4xl font-bold">{formatCurrency(priceUsd)}</span>
            {change24hPct !== null && (
              <Badge variant={change24hPct >= 0 ? 'default' : 'destructive'} className="text-sm">
                {change24hPct >= 0 ? '+' : ''}{change24hPct.toFixed(2)}% (24h)
              </Badge>
            )}
          </div>

          <div className="grid grid-cols-4 gap-2 text-sm">
            <div className="text-center">
              <div className="text-muted-foreground">1h</div>
              <div>{formatPercent(change1hPct) || 'N/A'}</div>
            </div>
            <div className="text-center">
              <div className="text-muted-foreground">24h</div>
              <div>{formatPercent(change24hPct) || 'N/A'}</div>
            </div>
            <div className="text-center">
              <div className="text-muted-foreground">7d</div>
              <div>{formatPercent(change7dPct) || 'N/A'}</div>
            </div>
            <div className="text-center">
              <div className="text-muted-foreground">30d</div>
              <div>{formatPercent(change30dPct) || 'N/A'}</div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-2 border-t">
            <div>
              <div className="text-xs text-muted-foreground">24h High</div>
              <div className="font-medium">{formatCurrency(high24h)}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">24h Low</div>
              <div className="font-medium">{formatCurrency(low24h)}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">All-Time High</div>
              <div className="font-medium">{formatCurrency(athPrice)}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">All-Time Low</div>
              <div className="font-medium">{formatCurrency(atlPrice)}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Market Card */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-muted-foreground">Market</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Market Cap</span>
            <span className="font-semibold">{formatCurrency(marketCap)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">24h Volume</span>
            <span className="font-semibold">{formatCurrency(volume24h)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">FDV</span>
            <span className="font-semibold">{formatCurrency(fullyDilutedValuation)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Market Dominance</span>
            <span className="font-semibold">
              {marketDominance !== null ? `${marketDominance.toFixed(2)}%` : 'N/A'}
            </span>
          </div>
          <div className="flex justify-between pt-2 border-t">
            <span className="text-muted-foreground">Circulating Supply</span>
            <span className="font-semibold">{formatSupply(circulatingSupply)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Total Supply</span>
            <span className="font-semibold">{formatSupply(totalSupply)}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
