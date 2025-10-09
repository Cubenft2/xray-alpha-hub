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
import { CoinData } from '@/hooks/useLunarCrushUniverse';

interface CryptoUniverseTableProps {
  coins: CoinData[];
  sortKey: keyof CoinData;
  sortDirection: 'asc' | 'desc';
  onSort: (key: keyof CoinData) => void;
}

export function CryptoUniverseTable({
  coins,
  sortKey,
  sortDirection,
  onSort,
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

  return (
    <div className="rounded-lg border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12">#</TableHead>
            <TableHead>
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
            <TableHead className="text-right">
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
            <TableHead>
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
              <TableCell className="font-medium text-muted-foreground">
                {index + 1}
              </TableCell>
              <TableCell className="font-bold">{coin.symbol}</TableCell>
              <TableCell>{coin.name}</TableCell>
              <TableCell className="text-right font-mono">
                {formatCurrency(coin.price)}
              </TableCell>
              <TableCell className="text-right">
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
              <TableCell className="text-right font-mono">
                {formatCurrency(coin.market_cap)}
              </TableCell>
              <TableCell className="text-right font-mono">
                {formatCurrency(coin.volume_24h)}
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <Progress value={coin.galaxy_score} className="w-16" />
                  <span className="text-sm font-medium">{coin.galaxy_score}</span>
                </div>
              </TableCell>
              <TableCell>{getAltRankBadge(coin.alt_rank)}</TableCell>
            </TableRow>
          ))}
          {coins.length === 0 && (
            <TableRow>
              <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                No coins found matching your filters
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
