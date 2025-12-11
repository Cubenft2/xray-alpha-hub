import { useNavigate } from 'react-router-dom';
import { ArrowUpDown, ArrowUp, ArrowDown, TrendingUp, TrendingDown } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import { CoinData } from '@/hooks/useLunarCrushUniverse';
import { Skeleton } from '@/components/ui/skeleton';

interface CryptoUniverseTableProps {
  coins: CoinData[];
  sortKey: keyof CoinData;
  sortDirection: 'asc' | 'desc';
  onSort: (key: keyof CoinData) => void;
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  startIndex: number;
  endIndex: number;
  totalItems: number;
  isLoading?: boolean;
}

export function CryptoUniverseTable({
  coins,
  sortKey,
  sortDirection,
  onSort,
  currentPage,
  totalPages,
  onPageChange,
  startIndex,
  endIndex,
  totalItems,
  isLoading,
}: CryptoUniverseTableProps) {
  const navigate = useNavigate();

  const formatPrice = (value: number) => {
    if (value >= 1000) return `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    if (value >= 1) return `$${value.toFixed(2)}`;
    if (value >= 0.01) return `$${value.toFixed(4)}`;
    if (value >= 0.0001) return `$${value.toFixed(6)}`;
    return `$${value.toFixed(8)}`;
  };

  const formatCurrency = (value: number) => {
    if (value >= 1e12) return `$${(value / 1e12).toFixed(2)}T`;
    if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
    if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
    if (value >= 1e3) return `$${(value / 1e3).toFixed(2)}K`;
    return `$${value.toFixed(2)}`;
  };

  const formatPercent = (value: number | undefined) => {
    if (value === undefined || value === null) return '—';
    const formatted = value.toFixed(2);
    return value > 0 ? `+${formatted}%` : `${formatted}%`;
  };

  const formatSocialVolume = (value: number | undefined) => {
    if (!value) return '—';
    if (value >= 1e6) return `${(value / 1e6).toFixed(1)}M`;
    if (value >= 1e3) return `${(value / 1e3).toFixed(1)}K`;
    return value.toString();
  };

  const getAltRankBadge = (rank: number | undefined) => {
    if (!rank) return <span className="text-muted-foreground text-sm">—</span>;
    if (rank <= 10) return <Badge className="bg-yellow-500/20 text-yellow-500 border-yellow-500/50">#{rank}</Badge>;
    if (rank <= 50) return <Badge className="bg-slate-400/20 text-slate-300 border-slate-400/50">#{rank}</Badge>;
    if (rank <= 100) return <Badge variant="outline">#{rank}</Badge>;
    return <span className="text-muted-foreground text-sm">#{rank}</span>;
  };

  // Galaxy Score visualization - 5 segment bar (LunarCrush style)
  const GalaxyScoreBar = ({ score }: { score: number | undefined }) => {
    if (!score) return <span className="text-muted-foreground">—</span>;
    const segments = Math.ceil((score / 100) * 5);
    return (
      <div className="flex items-center gap-1.5">
        <div className="flex gap-0.5">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className={`w-2 h-4 rounded-sm ${
                i <= segments ? 'bg-yellow-500' : 'bg-muted'
              }`}
            />
          ))}
        </div>
        <span className="text-xs font-medium ml-1">{score}</span>
      </div>
    );
  };

  // Sentiment bar with color gradient
  const SentimentBar = ({ sentiment }: { sentiment: number | undefined }) => {
    if (!sentiment) return <span className="text-muted-foreground">—</span>;
    const getColor = () => {
      if (sentiment >= 60) return 'bg-green-500';
      if (sentiment >= 40) return 'bg-yellow-500';
      return 'bg-red-500';
    };
    const getEmoji = () => {
      if (sentiment >= 60) return '😊';
      if (sentiment >= 40) return '😐';
      return '😞';
    };
    return (
      <div className="flex items-center gap-2">
        <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
          <div className={`h-full ${getColor()} rounded-full`} style={{ width: `${sentiment}%` }} />
        </div>
        <span className="text-xs">{getEmoji()}</span>
      </div>
    );
  };

  const SortIcon = ({ column }: { column: keyof CoinData }) => {
    if (sortKey !== column) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-50" />;
    return sortDirection === 'asc' ? (
      <ArrowUp className="h-3 w-3 ml-1 text-primary" />
    ) : (
      <ArrowDown className="h-3 w-3 ml-1 text-primary" />
    );
  };

  const getPageNumbers = () => {
    const pages: (number | 'ellipsis')[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      if (currentPage <= 4) {
        for (let i = 1; i <= 5; i++) pages.push(i);
        pages.push('ellipsis', totalPages);
      } else if (currentPage >= totalPages - 3) {
        pages.push(1, 'ellipsis');
        for (let i = totalPages - 4; i <= totalPages; i++) pages.push(i);
      } else {
        pages.push(1, 'ellipsis');
        for (let i = currentPage - 1; i <= currentPage + 1; i++) pages.push(i);
        pages.push('ellipsis', totalPages);
      }
    }
    return pages;
  };

  if (isLoading) {
    return (
      <div className="rounded-lg border bg-card">
        <div className="p-4 space-y-3">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4">
              <Skeleton className="h-8 w-8 rounded-full" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-16 ml-auto" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-20" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <ScrollArea className="w-full">
        <Table className="min-w-[1200px]">
          <TableHeader className="bg-muted/50 sticky top-0 z-10">
            <TableRow>
              <TableHead className="w-12 text-center">#</TableHead>
              <TableHead className="min-w-[180px]">
                <button onClick={() => onSort('symbol')} className="flex items-center hover:text-foreground">
                  Token <SortIcon column="symbol" />
                </button>
              </TableHead>
              <TableHead className="text-right">
                <button onClick={() => onSort('price')} className="flex items-center ml-auto hover:text-foreground">
                  Price <SortIcon column="price" />
                </button>
              </TableHead>
              <TableHead className="text-right w-20">
                <button onClick={() => onSort('percent_change_1h')} className="flex items-center ml-auto hover:text-foreground">
                  1h <SortIcon column="percent_change_1h" />
                </button>
              </TableHead>
              <TableHead className="text-right w-20">
                <button onClick={() => onSort('percent_change_24h')} className="flex items-center ml-auto hover:text-foreground">
                  24h <SortIcon column="percent_change_24h" />
                </button>
              </TableHead>
              <TableHead className="text-right w-20">
                <button onClick={() => onSort('percent_change_7d')} className="flex items-center ml-auto hover:text-foreground">
                  7d <SortIcon column="percent_change_7d" />
                </button>
              </TableHead>
              <TableHead className="text-right">
                <button onClick={() => onSort('market_cap')} className="flex items-center ml-auto hover:text-foreground">
                  Market Cap <SortIcon column="market_cap" />
                </button>
              </TableHead>
              <TableHead className="text-right">
                <button onClick={() => onSort('volume_24h')} className="flex items-center ml-auto hover:text-foreground">
                  Volume 24h <SortIcon column="volume_24h" />
                </button>
              </TableHead>
              <TableHead>
                <button onClick={() => onSort('galaxy_score')} className="flex items-center hover:text-foreground">
                  Galaxy <SortIcon column="galaxy_score" />
                </button>
              </TableHead>
              <TableHead>
                <button onClick={() => onSort('alt_rank')} className="flex items-center hover:text-foreground">
                  AltRank <SortIcon column="alt_rank" />
                </button>
              </TableHead>
              <TableHead>Sentiment</TableHead>
              <TableHead className="text-right">
                <button onClick={() => onSort('social_volume')} className="flex items-center ml-auto hover:text-foreground">
                  Social <SortIcon column="social_volume" />
                </button>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {coins.map((coin, index) => (
              <TableRow
                key={coin.id || `${coin.symbol}-${index}`}
                className="cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => navigate(`/crypto-universe/${coin.symbol}`)}
              >
                <TableCell className="py-3 text-center text-muted-foreground font-mono text-sm">
                  {coin.market_cap_rank || startIndex + index + 1}
                </TableCell>
                <TableCell className="py-3">
                  <div className="flex items-center gap-3">
                    {coin.logo_url ? (
                      <img
                        src={coin.logo_url}
                        alt={coin.name}
                        className="w-8 h-8 rounded-full"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">
                        {coin.symbol.slice(0, 2)}
                      </div>
                    )}
                    <div>
                      <div className="font-semibold text-sm">{coin.symbol}</div>
                      <div className="text-xs text-muted-foreground truncate max-w-[120px]">{coin.name}</div>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="py-3 text-right font-mono text-sm">
                  {formatPrice(coin.price)}
                </TableCell>
                <TableCell className={`py-3 text-right text-sm ${
                  (coin.percent_change_1h || 0) >= 0 ? 'text-green-500' : 'text-red-500'
                }`}>
                  {formatPercent(coin.percent_change_1h)}
                </TableCell>
                <TableCell className="py-3 text-right">
                  <div className={`flex items-center justify-end gap-1 text-sm ${
                    coin.percent_change_24h >= 0 ? 'text-green-500' : 'text-red-500'
                  }`}>
                    {coin.percent_change_24h >= 0 ? (
                      <TrendingUp className="h-3 w-3" />
                    ) : (
                      <TrendingDown className="h-3 w-3" />
                    )}
                    {formatPercent(coin.percent_change_24h)}
                  </div>
                </TableCell>
                <TableCell className={`py-3 text-right text-sm ${
                  (coin.percent_change_7d || 0) >= 0 ? 'text-green-500' : 'text-red-500'
                }`}>
                  {formatPercent(coin.percent_change_7d)}
                </TableCell>
                <TableCell className="py-3 text-right font-mono text-sm">
                  {formatCurrency(coin.market_cap)}
                </TableCell>
                <TableCell className="py-3 text-right font-mono text-sm text-muted-foreground">
                  {formatCurrency(coin.volume_24h)}
                </TableCell>
                <TableCell className="py-3">
                  <GalaxyScoreBar score={coin.galaxy_score} />
                </TableCell>
                <TableCell className="py-3">
                  {getAltRankBadge(coin.alt_rank)}
                </TableCell>
                <TableCell className="py-3">
                  <SentimentBar sentiment={coin.sentiment} />
                </TableCell>
                <TableCell className="py-3 text-right text-sm text-muted-foreground">
                  💬 {formatSocialVolume(coin.social_volume)}
                </TableCell>
              </TableRow>
            ))}
            {coins.length === 0 && !isLoading && (
              <TableRow>
                <TableCell colSpan={12} className="text-center py-12 text-muted-foreground">
                  No coins found matching your filters
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2 px-4 py-3 border-t bg-muted/30">
          <div className="text-sm text-muted-foreground">
            Showing {startIndex + 1}-{endIndex} of {totalItems.toLocaleString()} tokens
          </div>
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  onClick={() => currentPage > 1 && onPageChange(currentPage - 1)}
                  className={currentPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                />
              </PaginationItem>

              {getPageNumbers().map((page, idx) =>
                page === 'ellipsis' ? (
                  <PaginationItem key={`ellipsis-${idx}`}>
                    <PaginationEllipsis />
                  </PaginationItem>
                ) : (
                  <PaginationItem key={page}>
                    <PaginationLink
                      onClick={() => onPageChange(page as number)}
                      isActive={currentPage === page}
                      className="cursor-pointer"
                    >
                      {page}
                    </PaginationLink>
                  </PaginationItem>
                )
              )}

              <PaginationItem>
                <PaginationNext
                  onClick={() => currentPage < totalPages && onPageChange(currentPage + 1)}
                  className={currentPage === totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}
    </div>
  );
}
