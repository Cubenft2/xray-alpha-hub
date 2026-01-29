import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TrendingUp, TrendingDown, ArrowUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ForexScreenerProps {
  onSelectSymbol?: (symbol: string) => void;
}

type SortField = 'pair' | 'rate' | 'change_24h_pct' | 'rsi_14';
type SortDirection = 'asc' | 'desc';

const MAJOR_PAIRS = ['EURUSD', 'GBPUSD', 'USDJPY', 'USDCHF', 'AUDUSD', 'USDCAD', 'NZDUSD'];

// Pairs that work best on OANDA (majors, minors, USD-denominated metals)
const OANDA_PAIRS = new Set([
  'EURUSD', 'GBPUSD', 'USDJPY', 'USDCHF', 'AUDUSD', 'USDCAD', 'NZDUSD',
  'EURGBP', 'EURJPY', 'GBPJPY', 'AUDNZD', 'AUDCAD', 'AUDCHF', 'AUDJPY',
  'CADCHF', 'CADJPY', 'CHFJPY', 'EURCHF', 'EURAUD', 'EURCAD', 'EURNZD',
  'GBPAUD', 'GBPCAD', 'GBPCHF', 'GBPNZD', 'NZDCAD', 'NZDCHF', 'NZDJPY',
  'XAUUSD', 'XAGUSD'
]);

export function ForexScreener({ onSelectSymbol }: ForexScreenerProps) {
  const [activeTab, setActiveTab] = useState('metals');
  const [sortField, setSortField] = useState<SortField>('pair');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  // Direct query for metals - bypasses client-side filtering entirely
  const { data: metalsPairs, isLoading: metalsLoading } = useQuery({
    queryKey: ['forex-screener-metals'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('forex_cards')
        .select('*')
        .eq('is_active', true)
        .in('pair', ['XAUUSD', 'XAGUSD']);
      
      if (error) throw error;
      console.log('[ForexScreener] Metals query returned:', data?.length, 'pairs', data?.map(p => p.pair));
      return data || [];
    },
    refetchInterval: 30000,
  });

  // Query for all pairs (used by Major and All tabs) - uses pagination to bypass 1000 row limit
  const { data: allPairs, isLoading: allLoading } = useQuery({
    queryKey: ['forex-screener-all'],
    queryFn: async () => {
      const PAGE_SIZE = 1000;
      let allData: any[] = [];
      let offset = 0;
      let hasMore = true;
      
      while (hasMore) {
        const { data, error } = await supabase
          .from('forex_cards')
          .select('*')
          .eq('is_active', true)
          .order('pair', { ascending: true })
          .range(offset, offset + PAGE_SIZE - 1);
        
        if (error) throw error;
        
        if (data && data.length > 0) {
          allData = [...allData, ...data];
          offset += PAGE_SIZE;
          hasMore = data.length === PAGE_SIZE;
        } else {
          hasMore = false;
        }
      }
      
      console.log('[ForexScreener] Paginated fetch returned:', allData.length, 'total pairs');
      return allData;
    },
    refetchInterval: 30000,
  });

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const sortPairs = (pairs: typeof allPairs) => {
    if (!pairs) return [];
    
    return [...pairs].sort((a, b) => {
      let aVal = a[sortField];
      let bVal = b[sortField];
      
      if (aVal === null) aVal = 0;
      if (bVal === null) bVal = 0;
      
      if (typeof aVal === 'string') {
        return sortDirection === 'asc' 
          ? aVal.localeCompare(bVal as string)
          : (bVal as string).localeCompare(aVal);
      }
      
      return sortDirection === 'asc' 
        ? (aVal as number) - (bVal as number)
        : (bVal as number) - (aVal as number);
    });
  };

  const getMajorPairs = () => {
    if (!allPairs) return [];
    return allPairs.filter(p => MAJOR_PAIRS.includes(p.pair) || p.is_major === true);
  };

  const getTradingViewSymbol = (pair: string): string => {
    // Major/minor pairs and USD-denominated metals work best on OANDA
    if (OANDA_PAIRS.has(pair)) {
      return `OANDA:${pair}`;
    }
    // All other pairs (exotic, cross-currency metals) use FX_IDC
    return `FX_IDC:${pair}`;
  };

  const SortButton = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <Button 
      variant="ghost" 
      size="sm" 
      onClick={() => handleSort(field)}
      className="h-auto p-0 font-medium hover:bg-transparent"
    >
      {children}
      <ArrowUpDown className="ml-1 h-3 w-3" />
    </Button>
  );

  const ForexTable = ({ filter }: { filter: 'metals' | 'major' | 'all' }) => {
    // Get the right data source based on filter
    let rawPairs: typeof allPairs = [];
    let loading = false;
    
    if (filter === 'metals') {
      rawPairs = metalsPairs || [];
      loading = metalsLoading;
    } else if (filter === 'major') {
      rawPairs = getMajorPairs();
      loading = allLoading;
    } else {
      rawPairs = allPairs || [];
      loading = allLoading;
    }
    
    const pairs = sortPairs(rawPairs);

    if (loading) {
      return (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      );
    }

    if (pairs.length === 0) {
      return (
        <div className="text-center py-8 text-muted-foreground">
          No forex pairs found
        </div>
      );
    }

    return (
      <div className="max-h-[400px] overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead><SortButton field="pair">Pair</SortButton></TableHead>
              <TableHead className="text-right"><SortButton field="rate">Rate</SortButton></TableHead>
              <TableHead className="text-right"><SortButton field="change_24h_pct">24h</SortButton></TableHead>
              <TableHead className="text-right hidden sm:table-cell">High/Low</TableHead>
              <TableHead className="text-right hidden md:table-cell"><SortButton field="rsi_14">RSI</SortButton></TableHead>
              <TableHead className="text-right hidden lg:table-cell">Signal</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pairs.map((pair) => {
              const change = pair.change_24h_pct || 0;
              const isPositive = change >= 0;

              return (
                <TableRow 
                  key={pair.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => onSelectSymbol?.(getTradingViewSymbol(pair.pair))}
                >
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{pair.pair}</span>
                      {pair.is_major && (
                        <Badge variant="outline" className="text-[10px] px-1">Major</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {pair.rate?.toFixed(pair.pair.includes('JPY') ? 2 : 4)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className={`flex items-center justify-end gap-1 ${isPositive ? 'text-green-500' : 'text-red-500'}`}>
                      {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                      <span className="font-mono text-sm">
                        {isPositive ? '+' : ''}{change.toFixed(2)}%
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right hidden sm:table-cell text-xs text-muted-foreground font-mono">
                    {pair.high_24h?.toFixed(2)} / {pair.low_24h?.toFixed(2)}
                  </TableCell>
                  <TableCell className="text-right hidden md:table-cell">
                    <span className={`font-mono text-sm ${
                      (pair.rsi_14 || 0) > 70 ? 'text-red-500' : 
                      (pair.rsi_14 || 0) < 30 ? 'text-green-500' : 
                      'text-muted-foreground'
                    }`}>
                      {pair.rsi_14?.toFixed(0) || '-'}
                    </span>
                  </TableCell>
                  <TableCell className="text-right hidden lg:table-cell">
                    {pair.technical_signal && (
                      <Badge 
                        variant={pair.technical_signal.toLowerCase().includes('buy') ? 'default' : 'secondary'}
                        className="text-[10px]"
                      >
                        {pair.technical_signal}
                      </Badge>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    );
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          💱 Forex Pairs
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3 mb-4">
            <TabsTrigger value="metals" className="hover-glow-tab">🥇 Metals</TabsTrigger>
            <TabsTrigger value="major" className="hover-glow-tab">💵 Major</TabsTrigger>
            <TabsTrigger value="all" className="hover-glow-tab">📊 All</TabsTrigger>
          </TabsList>
          <TabsContent value="metals">
            <ForexTable filter="metals" />
          </TabsContent>
          <TabsContent value="major">
            <ForexTable filter="major" />
          </TabsContent>
          <TabsContent value="all">
            <ForexTable filter="all" />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
