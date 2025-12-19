import { Link } from 'react-router-dom';
import { ArrowUpDown, ArrowUp, ArrowDown, AlertTriangle } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

import { TokenCard, SortKey, SortDirection, isSuspiciousToken, isLowLiquidity } from '@/hooks/useTokenCards';
import { cn } from '@/lib/utils';

interface TokenScreenerTableProps {
  tokens: TokenCard[];
  sortKey: SortKey;
  sortDirection: SortDirection;
  onSort: (key: SortKey) => void;
  isLoading: boolean;
}

function formatPrice(value: number | null): string {
  if (value === null || value === undefined) return '-';
  if (value >= 1000) return `$${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
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

function formatPercent(value: number | null): string {
  if (value === null || value === undefined) return '-';
  const formatted = value.toFixed(2);
  return value >= 0 ? `+${formatted}%` : `${formatted}%`;
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
    <div className="flex items-center gap-1">
      <div className="flex gap-0.5">
        {Array.from({ length: segments }).map((_, i) => (
          <div
            key={i}
            className={cn(
              "w-2 h-3 rounded-sm",
              i < filled ? "bg-yellow-500" : "bg-muted"
            )}
          />
        ))}
      </div>
      <span className="text-xs text-muted-foreground ml-1">{score}</span>
    </div>
  );
}

function SentimentBar({ sentiment }: { sentiment: number | null }) {
  if (sentiment === null || sentiment === undefined) return <span className="text-muted-foreground">-</span>;
  
  const isBullish = sentiment >= 50;
  const width = Math.min(100, Math.max(0, sentiment));
  const emoji = sentiment >= 60 ? '😊' : sentiment >= 40 ? '😐' : '😞';
  
  return (
    <div className="flex items-center gap-2 min-w-[100px]">
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

function SortIcon({ column, sortKey, sortDirection }: { column: SortKey; sortKey: SortKey; sortDirection: SortDirection }) {
  if (sortKey !== column) {
    return <ArrowUpDown className="h-3 w-3 text-muted-foreground" />;
  }
  return sortDirection === 'asc' 
    ? <ArrowUp className="h-3 w-3 text-primary" />
    : <ArrowDown className="h-3 w-3 text-primary" />;
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

function PercentChange({ value, compact }: { value: number | null; compact?: boolean }) {
  if (value === null || value === undefined) return <span className="text-muted-foreground">-</span>;
  
  const isPositive = value >= 0;
  return (
    <span className={cn(
      "font-mono tabular-nums",
      compact ? "text-xs" : "text-sm",
      isPositive ? "text-green-500" : "text-red-500"
    )}>
      {isPositive ? '+' : ''}{value.toFixed(2)}%
    </span>
  );
}

function DataSourceBadge({ polygonSupported }: { polygonSupported: boolean | null }) {
  if (polygonSupported) {
    return (
      <Badge variant="outline" className="text-[10px] px-1 py-0 bg-green-500/10 text-green-500 border-green-500/30">
        LIVE
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

export function TokenScreenerTable({ tokens, sortKey, sortDirection, onSort, isLoading }: TokenScreenerTableProps) {
  const columns: { key: SortKey; label: string; className?: string }[] = [
    { key: 'market_cap_rank', label: '#' },
    { key: 'price_usd', label: 'Price' },
    { key: 'change_1h_pct', label: '1h %' },
    { key: 'change_24h_pct', label: '24h %' },
    { key: 'change_7d_pct', label: '7d %' },
    { key: 'market_cap', label: 'Market Cap' },
    { key: 'volume_24h_usd', label: 'Volume 24h' },
    { key: 'galaxy_score', label: 'Galaxy' },
    { key: 'alt_rank', label: 'AltRank' },
    { key: 'sentiment', label: 'Sentiment' },
    { key: 'social_volume_24h', label: 'Social' },
  ];

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 10 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="w-full rounded-md border bg-card">
      <ScrollArea className="w-full">
        <Table className="min-w-[1400px]">
          <TableHeader className="sticky top-0 bg-card z-10">
            <TableRow>
              <TableHead className="w-[50px] sticky left-0 bg-card z-20">
                <button
                  onClick={() => onSort('market_cap_rank')}
                  className="flex items-center gap-1 hover:text-foreground transition-colors"
                >
                  #
                  <SortIcon column="market_cap_rank" sortKey={sortKey} sortDirection={sortDirection} />
                </button>
              </TableHead>
              <TableHead className="min-w-[160px] sticky left-[50px] bg-card z-20">Token</TableHead>
              {columns.slice(1).map(col => (
                <TableHead key={col.key} className="text-right whitespace-nowrap">
                  <button
                    onClick={() => onSort(col.key)}
                    className="flex items-center gap-1 ml-auto hover:text-foreground transition-colors"
                  >
                    {col.label}
                    <SortIcon column={col.key} sortKey={sortKey} sortDirection={sortDirection} />
                  </button>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {tokens.map((token) => (
              <TableRow
                key={token.canonical_symbol}
                className="hover:bg-muted/50 transition-colors group"
              >
                <TableCell className="font-medium text-muted-foreground sticky left-0 bg-card">
                  <Link to={`/token/${token.canonical_symbol}`} className="block">
                    {token.market_cap_rank || '-'}
                  </Link>
                </TableCell>
                <TableCell className="sticky left-[50px] bg-card">
                  <Link to={`/token/${token.canonical_symbol}`} className="flex items-center gap-2">
                    {token.logo_url ? (
                      <img
                        src={token.logo_url}
                        alt={token.canonical_symbol}
                        className="w-8 h-8 rounded-full"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-sm font-medium">
                        {token.canonical_symbol?.charAt(0)}
                      </div>
                    )}
                    <div className="flex flex-col">
                      <div className="flex items-center gap-1">
                        <span className="font-semibold">{token.canonical_symbol}</span>
                        <DataSourceBadge polygonSupported={token.polygon_supported} />
                        <LiquidityWarningBadge marketCap={token.market_cap} volume={token.volume_24h_usd} polygonSupported={token.polygon_supported} />
                      </div>
                      <span className="text-muted-foreground text-xs truncate max-w-[100px]">
                        {token.name}
                      </span>
                    </div>
                  </Link>
                </TableCell>
                <TableCell className="text-right font-mono">
                  <Link to={`/token/${token.canonical_symbol}`} className="block">
                    {formatPrice(token.price_usd)}
                  </Link>
                </TableCell>
                <TableCell className="text-right">
                  <Link to={`/token/${token.canonical_symbol}`} className="block">
                    <PercentChange value={token.change_1h_pct} compact />
                  </Link>
                </TableCell>
                <TableCell className="text-right">
                  <Link to={`/token/${token.canonical_symbol}`} className="block">
                    <PercentChange value={token.change_24h_pct} />
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
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </div>
  );
}
