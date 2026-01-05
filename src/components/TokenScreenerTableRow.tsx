import { Link } from 'react-router-dom';
import { AlertTriangle, Zap } from 'lucide-react';
import { TableCell, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { TokenCard, isSuspiciousToken, isLowLiquidity } from '@/hooks/useTokenCards';
import { cn } from '@/lib/utils';
import { TokenFlagButton } from '@/components/TokenFlagButton';
import { PriceUpdate } from '@/hooks/useWebSocketPrices';
import { useState, useEffect, useRef } from 'react';

interface TokenScreenerTableRowProps {
  token: TokenCard;
  livePrice?: PriceUpdate | null;
}

function formatPrice(value: number | null): string {
  if (value === null || value === undefined) return '-';
  // Always use consistent decimal places to prevent layout shift
  if (value >= 1000) return `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (value >= 1) return `$${value.toFixed(2)}`;
  if (value >= 0.0001) return `$${value.toFixed(4)}`;
  return `$${value.toFixed(8)}`;
}

function formatLargeNumber(value: number | null): string {
  if (value === null || value === undefined) return '-';
  if (value >= 1e12) return `$${(value / 1e12).toFixed(2)}T`;
  if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
  if (value >= 1e3) return `$${(value / 1e3).toFixed(1)}K`;
  return `$${value.toFixed(0)}`;
}

function formatSocialVolume(value: number | null): string {
  if (value === null || value === undefined) return '-';
  if (value >= 1e6) return `${(value / 1e6).toFixed(1)}M`;
  if (value >= 1e3) return `${(value / 1e3).toFixed(1)}K`;
  return value.toFixed(0);
}

function GalaxyScoreBar({ score }: { score: number | null }) {
  if (score === null || score === undefined) return <span className="text-muted-foreground">-</span>;
  const segments = 5;
  const filled = Math.round((score / 100) * segments);
  
  return (
    <div className="flex items-center gap-0.5">
      <div className="flex gap-px">
        {Array.from({ length: segments }).map((_, i) => (
          <div
            key={i}
            className={cn(
              "w-1.5 h-2.5 rounded-sm",
              i < filled ? "bg-yellow-500" : "bg-muted"
            )}
          />
        ))}
      </div>
      <span className="text-xs text-muted-foreground ml-0.5">{score}</span>
    </div>
  );
}

function SentimentBar({ sentiment }: { sentiment: number | null }) {
  if (sentiment === null || sentiment === undefined) return <span className="text-muted-foreground">-</span>;
  
  const isBullish = sentiment >= 50;
  const width = Math.min(100, Math.max(0, sentiment));
  const emoji = sentiment >= 60 ? '😊' : sentiment >= 40 ? '😐' : '😞';
  
  return (
    <div className="flex items-center gap-1.5 min-w-[80px]">
      <span className="text-sm">{emoji}</span>
      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
        <div 
          className={cn(
            "h-full rounded-full transition-all",
            isBullish ? "bg-green-500" : "bg-red-500"
          )}
          style={{ width: `${width}%` }}
        />
      </div>
      <span className={cn(
        "text-xs font-medium min-w-[32px]",
        isBullish ? "text-green-500" : "text-red-500"
      )}>
        {sentiment.toFixed(0)}%
      </span>
    </div>
  );
}

function AltRankBadge({ rank }: { rank: number | null }) {
  if (rank === null || rank === undefined) return <span className="text-muted-foreground">-</span>;
  
  let variant: 'default' | 'secondary' | 'outline' = 'outline';
  let className = '';
  
  if (rank <= 10) {
    variant = 'default';
    className = 'bg-yellow-500 hover:bg-yellow-600 text-black';
  } else if (rank <= 50) {
    variant = 'secondary';
    className = 'bg-slate-400 hover:bg-slate-500 text-black';
  } else if (rank <= 100) {
    variant = 'secondary';
    className = 'bg-amber-700 hover:bg-amber-800 text-white';
  }
  
  return (
    <Badge variant={variant} className={cn("text-xs", className)}>
      #{rank}
    </Badge>
  );
}

function PercentChange({ value, compact, flash }: { value: number | null; compact?: boolean; flash?: 'up' | 'down' | null }) {
  if (value === null || value === undefined) return <span className="text-muted-foreground tabular-nums min-w-[52px] inline-block text-right">-</span>;
  
  const isPositive = value >= 0;
  return (
    <span className={cn(
      "font-mono tabular-nums transition-colors duration-300 px-1 rounded min-w-[52px] inline-block text-right",
      compact ? "text-xs" : "text-sm",
      isPositive ? "text-green-500" : "text-red-500",
      flash === 'up' && "bg-green-500/20",
      flash === 'down' && "bg-red-500/20"
    )}>
      {isPositive ? '+' : ''}{value.toFixed(2)}%
    </span>
  );
}

function DataSourceBadge({ polygonSupported, isLive }: { polygonSupported: boolean | null; isLive: boolean }) {
  if (isLive) {
    return (
      <Badge variant="outline" className="text-[10px] px-1 py-0 bg-green-500/20 text-green-400 border-green-500/50 gap-0.5">
        <Zap className="h-2.5 w-2.5" />
        LIVE
      </Badge>
    );
  }
  if (polygonSupported) {
    return (
      <Badge variant="outline" className="text-[10px] px-1 py-0 bg-green-500/10 text-green-500 border-green-500/30">
        POLY
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-[10px] px-1 py-0 bg-blue-500/10 text-blue-500 border-blue-500/30">
      LC
    </Badge>
  );
}

function LiquidityWarningBadge({ marketCap, volume, polygonSupported }: { 
  marketCap: number | null; 
  volume: number | null;
  polygonSupported: boolean | null;
}) {
  const suspicious = isSuspiciousToken(marketCap, volume, polygonSupported);
  const lowLiquidity = isLowLiquidity(volume);
  
  if (suspicious) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger>
            <Badge variant="outline" className="text-[10px] px-1 py-0 bg-red-500/10 text-red-500 border-red-500/30 gap-0.5">
              <AlertTriangle className="h-3 w-3" />
              ⚠️
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <p className="text-xs">Suspicious: High market cap with very low volume</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }
  
  if (lowLiquidity) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger>
            <Badge variant="outline" className="text-[10px] px-1 py-0 bg-amber-500/10 text-amber-500 border-amber-500/30">
              Low Vol
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <p className="text-xs">Low liquidity: 24h volume under $10K</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }
  
  return null;
}

export function TokenScreenerTableRow({ token, livePrice }: TokenScreenerTableRowProps) {
  const [priceFlash, setPriceFlash] = useState<'up' | 'down' | null>(null);
  const prevPriceRef = useRef<number | null>(null);
  
  // Merge live price with DB price (live takes priority)
  const displayPrice = livePrice?.price ?? token.price_usd;
  const displayChange = livePrice?.change24h ?? token.change_24h_pct;
  const isLive = !!livePrice;

  // Flash animation on price change
  useEffect(() => {
    if (livePrice?.price && prevPriceRef.current !== null) {
      if (livePrice.price > prevPriceRef.current) {
        setPriceFlash('up');
      } else if (livePrice.price < prevPriceRef.current) {
        setPriceFlash('down');
      }
      const timer = setTimeout(() => setPriceFlash(null), 500);
      return () => clearTimeout(timer);
    }
    prevPriceRef.current = livePrice?.price ?? token.price_usd;
  }, [livePrice?.price, token.price_usd]);

  return (
    <TableRow className="hover:bg-muted/50 transition-colors group">
      <TableCell className="font-medium text-muted-foreground text-xs sticky left-0 bg-card">
        <Link to={`/token/${token.canonical_symbol}`} className="block">
          {token.market_cap_rank || '-'}
        </Link>
      </TableCell>
      <TableCell className="sticky left-[40px] bg-card">
        <Link to={`/token/${token.canonical_symbol}`} className="flex items-center gap-2">
          {token.logo_url ? (
            <img
              src={token.logo_url}
              alt={token.canonical_symbol}
              className="w-6 h-6 rounded-full"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          ) : (
            <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs font-medium">
              {token.canonical_symbol?.charAt(0)}
            </div>
          )}
          <div className="flex flex-col">
            <div className="flex items-center gap-1">
              <span className="font-semibold">{token.canonical_symbol}</span>
              <DataSourceBadge polygonSupported={token.polygon_supported} isLive={isLive} />
              <LiquidityWarningBadge marketCap={token.market_cap} volume={token.volume_24h_usd} polygonSupported={token.polygon_supported} />
            </div>
            <span className="text-muted-foreground text-xs truncate max-w-[80px]">
              {token.name}
            </span>
          </div>
        </Link>
      </TableCell>
      <TableCell className="text-right font-mono">
        <Link to={`/token/${token.canonical_symbol}`} className="block">
          <span className={cn(
            "tabular-nums transition-colors duration-300 px-1 rounded inline-block min-w-[70px] text-right text-sm",
            priceFlash === 'up' && "text-green-400 bg-green-500/20",
            priceFlash === 'down' && "text-red-400 bg-red-500/20"
          )}>
            {formatPrice(displayPrice)}
          </span>
        </Link>
      </TableCell>
      <TableCell className="text-right">
        <Link to={`/token/${token.canonical_symbol}`} className="block">
          <PercentChange value={token.change_1h_pct} compact />
        </Link>
      </TableCell>
      <TableCell className="text-right">
        <Link to={`/token/${token.canonical_symbol}`} className="block">
          <PercentChange value={displayChange} flash={isLive ? priceFlash : null} />
        </Link>
      </TableCell>
      <TableCell className="text-right">
        <Link to={`/token/${token.canonical_symbol}`} className="block">
          <PercentChange value={token.change_7d_pct} compact />
        </Link>
      </TableCell>
      <TableCell className="text-right font-mono text-sm">
        <Link to={`/token/${token.canonical_symbol}`} className="block">
          {formatLargeNumber(token.market_cap)}
        </Link>
      </TableCell>
      <TableCell className="text-right font-mono text-sm">
        <Link to={`/token/${token.canonical_symbol}`} className="block">
          {formatLargeNumber(token.volume_24h_usd)}
        </Link>
      </TableCell>
      <TableCell className="text-right">
        <Link to={`/token/${token.canonical_symbol}`} className="block">
          <GalaxyScoreBar score={token.galaxy_score} />
        </Link>
      </TableCell>
      <TableCell className="text-right">
        <Link to={`/token/${token.canonical_symbol}`} className="block">
          <AltRankBadge rank={token.alt_rank} />
        </Link>
      </TableCell>
      <TableCell className="text-right">
        <Link to={`/token/${token.canonical_symbol}`} className="block">
          <SentimentBar sentiment={token.sentiment} />
        </Link>
      </TableCell>
      <TableCell className="text-right font-mono text-sm">
        <Link to={`/token/${token.canonical_symbol}`} className="block">
          💬 {formatSocialVolume(token.social_volume_24h)}
        </Link>
      </TableCell>
      <TableCell className="text-center w-[50px]">
        <TokenFlagButton symbol={token.canonical_symbol} compact />
      </TableCell>
    </TableRow>
  );
}
