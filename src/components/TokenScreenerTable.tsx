import { useNavigate } from 'react-router-dom';
import { ArrowUpDown, ArrowUp, ArrowDown, TrendingUp, TrendingDown } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { TokenCard, SortKey, SortDirection } from '@/hooks/useTokenCards';
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

function SentimentIndicator({ sentiment }: { sentiment: number | null }) {
  if (sentiment === null || sentiment === undefined) return <span className="text-muted-foreground">-</span>;
  
  const isBullish = sentiment >= 50;
  
  return (
    <div className="flex items-center gap-1">
      {isBullish ? (
        <TrendingUp className="h-4 w-4 text-green-500" />
      ) : (
        <TrendingDown className="h-4 w-4 text-red-500" />
      )}
      <span className={cn(
        "text-sm font-medium",
        isBullish ? "text-green-500" : "text-red-500"
      )}>
        {sentiment.toFixed(0)}%
      </span>
    </div>
  );
}

function SortIcon({ column, sortKey, sortDirection }: { column: SortKey; sortKey: SortKey; sortDirection: SortDirection }) {
  if (sortKey !== column) {
    return <ArrowUpDown className="h-4 w-4 text-muted-foreground" />;
  }
  return sortDirection === 'asc' 
    ? <ArrowUp className="h-4 w-4 text-primary" />
    : <ArrowDown className="h-4 w-4 text-primary" />;
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
    <Badge variant={variant} className={className}>
      #{rank}
    </Badge>
  );
}

export function TokenScreenerTable({ tokens, sortKey, sortDirection, onSort, isLoading }: TokenScreenerTableProps) {
  const navigate = useNavigate();

  const sortableColumns: { key: SortKey; label: string }[] = [
    { key: 'market_cap_rank', label: '#' },
    { key: 'price_usd', label: 'Price' },
    { key: 'change_24h_pct', label: '24h %' },
    { key: 'market_cap', label: 'Market Cap' },
    { key: 'volume_24h_usd', label: 'Volume 24h' },
    { key: 'galaxy_score', label: 'Galaxy Score' },
    { key: 'alt_rank', label: 'AltRank' },
    { key: 'sentiment', label: 'Sentiment' },
    { key: 'social_volume_24h', label: 'Social Vol' },
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
    <ScrollArea className="h-[60vh] min-h-[400px] w-full rounded-md border">
      <div className="overflow-x-auto">
        <Table className="min-w-[1200px]">
          <TableHeader className="sticky top-0 bg-background z-10">
            <TableRow>
              <TableHead className="w-[60px]">
                <button
                  onClick={() => onSort('market_cap_rank')}
                  className="flex items-center gap-1 hover:text-foreground transition-colors"
                >
                  #
                  <SortIcon column="market_cap_rank" sortKey={sortKey} sortDirection={sortDirection} />
                </button>
              </TableHead>
              <TableHead className="min-w-[180px]">Token</TableHead>
              {sortableColumns.slice(1).map(col => (
                <TableHead key={col.key} className="text-right">
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
                className="cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => navigate(`/token/${token.canonical_symbol}`)}
              >
                <TableCell className="font-medium text-muted-foreground">
                  {token.market_cap_rank || '-'}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
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
                      <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs">
                        {token.canonical_symbol?.charAt(0)}
                      </div>
                    )}
                    <div>
                      <span className="font-semibold">{token.canonical_symbol}</span>
                      <span className="text-muted-foreground text-sm ml-2 hidden sm:inline">
                        {token.name?.slice(0, 20)}
                        {(token.name?.length || 0) > 20 ? '...' : ''}
                      </span>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-right font-mono">
                  {formatPrice(token.price_usd)}
                </TableCell>
                <TableCell className={cn(
                  "text-right font-mono",
                  token.change_24h_pct && token.change_24h_pct >= 0 ? "text-green-500" : "text-red-500"
                )}>
                  {formatPercent(token.change_24h_pct)}
                </TableCell>
                <TableCell className="text-right font-mono">
                  {formatLargeNumber(token.market_cap)}
                </TableCell>
                <TableCell className="text-right font-mono">
                  {formatLargeNumber(token.volume_24h_usd)}
                </TableCell>
                <TableCell className="text-right">
                  <GalaxyScoreBar score={token.galaxy_score} />
                </TableCell>
                <TableCell className="text-right">
                  <AltRankBadge rank={token.alt_rank} />
                </TableCell>
                <TableCell className="text-right">
                  <SentimentIndicator sentiment={token.sentiment} />
                </TableCell>
                <TableCell className="text-right font-mono">
                  {formatSocialVolume(token.social_volume_24h)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <ScrollBar orientation="horizontal" />
      <ScrollBar orientation="vertical" />
    </ScrollArea>
  );
}
