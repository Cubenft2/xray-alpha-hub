import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { Table, TableBody, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { useMemo } from 'react';
import { cn } from '@/lib/utils';

import { TokenCard, SortKey, SortDirection } from '@/hooks/useTokenCards';
import { useLivePrices } from '@/contexts/WebSocketContext';
import { TokenScreenerTableRow } from '@/components/TokenScreenerTableRow';
interface TokenScreenerTableProps {
  tokens: TokenCard[];
  sortKey: SortKey;
  sortDirection: SortDirection;
  onSort: (key: SortKey) => void;
  isLoading: boolean;
}

function SortIcon({ column, sortKey, sortDirection }: { column: SortKey; sortKey: SortKey; sortDirection: SortDirection }) {
  if (sortKey !== column) {
    return <ArrowUpDown className="h-3 w-3 text-muted-foreground" />;
  }
  return sortDirection === 'asc' 
    ? <ArrowUp className="h-3 w-3 text-primary" />
    : <ArrowDown className="h-3 w-3 text-primary" />;
}

export function TokenScreenerTable({ tokens, sortKey, sortDirection, onSort, isLoading }: TokenScreenerTableProps) {
  // Get symbols of visible tokens to subscribe to WebSocket
  const visibleSymbols = useMemo(() => 
    tokens.map(t => t.canonical_symbol).filter(Boolean),
    [tokens]
  );
  
  // Subscribe to live prices for visible tokens
  const livePrices = useLivePrices(visibleSymbols);

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

  const columnWidths: Record<SortKey, string> = {
    market_cap_rank: 'w-[36px]',
    price_usd: 'w-[85px]',
    change_1h_pct: 'w-[58px]',
    change_24h_pct: 'w-[58px]',
    change_7d_pct: 'w-[58px]',
    market_cap: 'w-[90px]',
    volume_24h_usd: 'w-[90px]',
    galaxy_score: 'w-[75px]',
    alt_rank: 'w-[60px]',
    sentiment: 'w-[110px]',
    social_volume_24h: 'w-[70px]',
  };

  return (
    <div className="rounded-md border bg-card w-max">
      <ScrollArea className="w-full">
        <Table>
          <TableHeader className="sticky top-0 bg-card z-10">
            <TableRow>
              <TableHead className="w-[36px] sticky left-0 bg-card z-20">
                <button
                  onClick={() => onSort('market_cap_rank')}
                  className="flex items-center gap-0.5 hover:text-foreground transition-colors text-xs"
                >
                  #
                  <SortIcon column="market_cap_rank" sortKey={sortKey} sortDirection={sortDirection} />
                </button>
              </TableHead>
              <TableHead className="w-[150px] sticky left-[36px] bg-card z-20 text-xs">Token</TableHead>
              {columns.slice(1).map(col => (
                <TableHead key={col.key} className={cn("text-right whitespace-nowrap text-xs", columnWidths[col.key])}>
                  <button
                    onClick={() => onSort(col.key)}
                    className="flex items-center gap-0.5 ml-auto hover:text-foreground transition-colors"
                  >
                    {col.label}
                    <SortIcon column={col.key} sortKey={sortKey} sortDirection={sortDirection} />
                  </button>
                </TableHead>
              ))}
              <TableHead className="text-center w-[40px] text-xs">Flag</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tokens.map((token) => (
              <TokenScreenerTableRow
                key={token.canonical_symbol}
                token={token}
                livePrice={livePrices[token.canonical_symbol] || null}
              />
            ))}
          </TableBody>
        </Table>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </div>
  );
}
