import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Zap, TrendingUp, TrendingDown, Activity } from 'lucide-react';
import { PriceUpdate } from '@/hooks/useWebSocketPrices';
import { cn } from '@/lib/utils';

interface TokenLiveOHLCProps {
  livePrice: PriceUpdate | null;
  symbol: string;
}

export function TokenLiveOHLC({ livePrice, symbol }: TokenLiveOHLCProps) {
  if (!livePrice) {
    return null;
  }

  const formatPrice = (value: number | null | undefined) => {
    if (value === null || value === undefined || isNaN(value)) return 'N/A';
    if (value >= 1000) return `$${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
    if (value >= 1) return `$${value.toFixed(2)}`;
    if (value < 0.0001) return `$${value.toFixed(8)}`;
    return `$${value.toFixed(4)}`;
  };

  // Compact format for bid/ask - no decimals for large prices to prevent mobile jumping
  const formatPriceCompact = (value: number | null | undefined) => {
    if (value === null || value === undefined || isNaN(value)) return 'N/A';
    if (value >= 1000) return `$${Math.round(value).toLocaleString()}`;
    if (value >= 1) return `$${value.toFixed(2)}`;
    if (value < 0.0001) return `$${value.toFixed(6)}`;
    return `$${value.toFixed(4)}`;
  };

  const formatVolume = (value: number | null | undefined) => {
    if (value === null || value === undefined) return 'N/A';
    if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
    if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
    if (value >= 1e3) return `$${(value / 1e3).toFixed(1)}K`;
    return `$${value.toFixed(0)}`;
  };

  const change = livePrice.change24h ?? 0;
  const isPositive = change >= 0;

  return (
    <Card className="border-green-500/30 bg-green-500/5">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Zap className="h-4 w-4 text-green-400" />
          <span className="text-green-400">Live WebSocket Data</span>
          <Badge variant="outline" className="text-[10px] bg-green-500/20 text-green-400 border-green-500/50 ml-auto">
            <Activity className="h-3 w-3 mr-1 animate-pulse" />
            STREAMING
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
          {/* Current Price */}
          <div className="col-span-2 md:col-span-1">
            <div className="text-xs text-muted-foreground mb-1">Price</div>
            <div className="text-2xl font-bold">{formatPrice(livePrice.price)}</div>
            <div className={cn(
              "flex items-center gap-1 text-sm mt-1",
              isPositive ? "text-green-500" : "text-red-500"
            )}>
              {isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              {isPositive ? '+' : ''}{change.toFixed(2)}%
            </div>
          </div>

          {/* Open */}
          <div>
            <div className="text-xs text-muted-foreground mb-1">Open</div>
            <div className="font-medium">{formatPrice(livePrice.open)}</div>
          </div>

          {/* High */}
          <div>
            <div className="text-xs text-muted-foreground mb-1">High</div>
            <div className="font-medium text-green-500">{formatPrice(livePrice.high)}</div>
          </div>

          {/* Low */}
          <div>
            <div className="text-xs text-muted-foreground mb-1">Low</div>
            <div className="font-medium text-red-500">{formatPrice(livePrice.low)}</div>
          </div>

          {/* Close */}
          <div>
            <div className="text-xs text-muted-foreground mb-1">Close</div>
            <div className="font-medium">{formatPrice(livePrice.close)}</div>
          </div>

          {/* VWAP */}
          <div>
            <div className="text-xs text-muted-foreground mb-1">VWAP</div>
            <div className="font-medium">{formatPrice(livePrice.vwap)}</div>
          </div>

          {/* Volume */}
          <div>
            <div className="text-xs text-muted-foreground mb-1">Volume</div>
            <div className="font-medium">{formatVolume(livePrice.volume)}</div>
          </div>
        </div>

        <div className="mt-3 pt-3 border-t border-border/50 flex flex-col sm:flex-row sm:items-center sm:justify-between text-xs text-muted-foreground gap-1">
          <span className="truncate">Bid: {formatPriceCompact(livePrice.bid)} | Ask: {formatPriceCompact(livePrice.ask)}</span>
          <span className="truncate">
            Last update: {livePrice.timestamp 
              ? new Date(livePrice.timestamp).toLocaleTimeString() 
              : 'N/A'}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
