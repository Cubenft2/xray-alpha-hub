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
import { Progress } from '@/components/ui/progress';
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
}: CryptoUniverseTableProps) {
  const navigate = useNavigate();

  const formatCurrency = (value: number) => {
    if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
    if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
    if (value >= 1e3) return `$${(value / 1e3).toFixed(2)}K`;
    return `$${value.toFixed(2)}`;
  };

  const formatPercent = (value: number) => {
    const formatted = value.toFixed(2);
    return value > 0 ? `+${formatted}%` : `${formatted}%`;
  };

  const getAltRankBadge = (rank: number) => {
    if (rank <= 10) return <Badge variant="default">Top 10</Badge>;
    if (rank <= 50) return <Badge variant="secondary">Top 50</Badge>;
    if (rank <= 100) return <Badge variant="outline">Top 100</Badge>;
    return <span className="text-muted-foreground text-sm">#{rank}</span>;
  };

  // Dynamic tier badge based on current sort column
  const getTierBadge = (position: number, currentSortKey: keyof CoinData) => {
    const sortEmoji: Record<string, string> = {
      galaxy_score: '🌙',
      market_cap: '💰',
      percent_change_24h: '🔥',
      volume_24h: '📊',
      alt_rank: '⭐',
      price: '💵',
      symbol: '🔤',
    };

    const emoji = sortEmoji[currentSortKey] || '📈';

    if (position <= 10) {
      return <Badge className="text-xs bg-yellow-500 hover:bg-yellow-600 text-yellow-950">{emoji} Top 10</Badge>;
    }
    if (position <= 50) {
      return <Badge variant="default" className="text-xs">{emoji} Top 50</Badge>;
    }
    if (position <= 100) {
      return <Badge variant="secondary" className="text-xs">{emoji} Top 100</Badge>;
    }
    if (position <= 200) {
      return <Badge variant="outline" className="text-xs">{emoji} Top 200</Badge>;
    }
    return null;
  };

  const getSortColumnLabel = () => {
    const labels: Record<string, string> = {
      galaxy_score: '🌙',
      market_cap: '💰',
      percent_change_24h: '🔥',
      volume_24h: '📊',
      alt_rank: '⭐',
      price: '💵',
      symbol: '🔤',
    };
    return labels[sortKey] || '📈';
  };

  const getSentimentEmoji = (sentiment?: number) => {
    if (!sentiment) return '😐';
    if (sentiment >= 60) return '😊';
    if (sentiment >= 40) return '😐';
    return '😞';
  };

  const SortIcon = ({ column }: { column: keyof CoinData }) => {
    if (sortKey !== column) return <ArrowUpDown className="h-4 w-4 ml-1" />;
    return sortDirection === 'asc' ? (
      <ArrowUp className="h-4 w-4 ml-1" />
    ) : (
      <ArrowDown className="h-4 w-4 ml-1" />
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

  return (
    <div className="rounded-lg border bg-card">
      <ScrollArea className="w-full">
        <Table className="min-w-[900px]">
          <TableHeader>
            <TableRow>
              <TableHead className="w-12 sticky left-0 bg-card z-10">#</TableHead>
              <TableHead className="w-24">
                <span className="flex items-center gap-1 text-xs">
                  {getSortColumnLabel()} Tier
                </span>
              </TableHead>
              <TableHead className="sticky left-12 bg-card z-10">
                <button
                  onClick={() => onSort('symbol')}
                  className="flex items-center hover:text-foreground"
                >
                  Symbol
                  <SortIcon column="symbol" />
                </button>
              </TableHead>
              <TableHead>Name</TableHead>
              <TableHead className="text-right">
                <button
                  onClick={() => onSort('price')}
                  className="flex items-center ml-auto hover:text-foreground"
                >
                  Price
                  <SortIcon column="price" />
                </button>
              </TableHead>
              <TableHead className="text-right">
                <button
                  onClick={() => onSort('percent_change_24h')}
                  className="flex items-center ml-auto hover:text-foreground"
                >
                  24h %
                  <SortIcon column="percent_change_24h" />
                </button>
              </TableHead>
              <TableHead className="text-right">
                <button
                  onClick={() => onSort('market_cap')}
                  className="flex items-center ml-auto hover:text-foreground"
                >
                  Market Cap
                  <SortIcon column="market_cap" />
                </button>
              </TableHead>
              <TableHead className="text-right hidden md:table-cell">
                <button
                  onClick={() => onSort('volume_24h')}
                  className="flex items-center ml-auto hover:text-foreground"
                >
                  Volume 24h
                  <SortIcon column="volume_24h" />
                </button>
              </TableHead>
              <TableHead>
                <button
                  onClick={() => onSort('galaxy_score')}
                  className="flex items-center hover:text-foreground"
                >
                  Galaxy Score
                  <SortIcon column="galaxy_score" />
                </button>
              </TableHead>
              <TableHead className="hidden lg:table-cell">
                <button
                  onClick={() => onSort('alt_rank')}
                  className="flex items-center hover:text-foreground"
                >
                  AltRank
                  <SortIcon column="alt_rank" />
                </button>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {coins.map((coin, index) => (
              <TableRow
                key={coin.id}
                className="cursor-pointer"
                onClick={() => navigate(`/crypto-universe/${coin.symbol}`)}
              >
                <TableCell className="py-2 font-medium text-muted-foreground sticky left-0 bg-card">
                  {startIndex + index + 1}
                </TableCell>
                <TableCell className="py-2">
                  {getTierBadge(startIndex + index + 1, sortKey)}
                </TableCell>
                <TableCell className="py-2 font-bold sticky left-12 bg-card">{coin.symbol}</TableCell>
                <TableCell className="py-2">{coin.name}</TableCell>
                <TableCell className="py-2 text-right font-mono">
                  {formatCurrency(coin.price)}
                </TableCell>
                <TableCell className="py-2 text-right">
                  <div
                    className={`flex items-center justify-end gap-1 ${
                      coin.percent_change_24h > 0 ? 'text-green-500' : 'text-red-500'
                    }`}
                  >
                    {coin.percent_change_24h > 0 ? (
                      <TrendingUp className="h-4 w-4" />
                    ) : (
                      <TrendingDown className="h-4 w-4" />
                    )}
                    {formatPercent(coin.percent_change_24h)}
                  </div>
                </TableCell>
                <TableCell className="py-2 text-right font-mono">
                  {formatCurrency(coin.market_cap)}
                </TableCell>
                <TableCell className="py-2 text-right font-mono hidden md:table-cell">
                  {formatCurrency(coin.volume_24h)}
                </TableCell>
                <TableCell className="py-2">
                  <div className="flex items-center gap-2">
                    <Progress value={coin.galaxy_score} className="w-16" />
                    <span className="text-sm font-medium">{coin.galaxy_score}</span>
                  </div>
                </TableCell>
                <TableCell className="py-2 hidden lg:table-cell">{getAltRankBadge(coin.alt_rank)}</TableCell>
              </TableRow>
            ))}
            {coins.length === 0 && (
              <TableRow>
                <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
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
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2 px-4 py-3 border-t">
          <div className="text-sm text-muted-foreground">
            Showing {startIndex + 1}-{endIndex} of {totalItems} assets
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
