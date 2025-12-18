import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface StockCard {
  symbol: string;
  name: string | null;
  logo_url: string | null;
  icon_url: string | null;
  price_usd: number | null;
  change_pct: number | null;
  market_cap: number | null;
  volume: number | null;
  sector: string | null;
  industry: string | null;
  pe_ratio: number | null;
  dividend_yield: number | null;
  eps: number | null;
  rsi_14: number | null;
  macd_line: number | null;
  macd_signal: number | null;
  sma_20: number | null;
  sma_50: number | null;
  sma_200: number | null;
  technical_signal: string | null;
  high_52w: number | null;
  low_52w: number | null;
  high_52w_date: string | null;
  low_52w_date: string | null;
  employees: number | null;
  website: string | null;
  description: string | null;
  exchange: string | null;
  top_news: any[] | null;
}

export type SortKey = 'price_usd' | 'change_pct' | 'market_cap' | 'volume' | 'pe_ratio' | 'dividend_yield' | 'rsi_14';
export type SortDirection = 'asc' | 'desc';

export interface StockFilters {
  search: string;
  sector: string;
  minMarketCap: string;
  minVolume: string;
  changeFilter: 'all' | 'gainers' | 'losers';
  technicalSignal: string;
  near52WeekHigh: boolean;
  near52WeekLow: boolean;
}

const SIMPLIFIED_SECTORS: Record<string, string[]> = {
  'Technology': ['SOFTWARE', 'COMPUTER', 'ELECTRONIC', 'SEMICONDUCTOR', 'PROGRAMMING', 'DATA PROCESSING'],
  'Healthcare': ['PHARMACEUTICAL', 'BIOLOGICAL', 'MEDICAL', 'HEALTH', 'DRUG', 'HOSPITAL', 'SURGICAL'],
  'Finance': ['BANK', 'INSURANCE', 'FINANCE', 'INVESTMENT', 'SECURITY', 'LOAN', 'CREDIT'],
  'Energy': ['OIL', 'GAS', 'PETROLEUM', 'MINING', 'COAL', 'CRUDE'],
  'Retail': ['RETAIL', 'STORE', 'CATALOG', 'DEPARTMENT', 'VARIETY'],
  'Auto': ['MOTOR', 'AUTO', 'VEHICLE', 'CAR'],
  'Aerospace': ['AEROSPACE', 'AIRCRAFT', 'MISSILE', 'GUIDED'],
  'Utilities': ['ELECTRIC', 'UTILITY', 'WATER', 'SANITARY'],
  'Communications': ['TELEPHONE', 'COMMUNICATION', 'RADIO', 'TELEVISION', 'BROADCASTING'],
};

export function getSimplifiedSector(rawSector: string | null): string {
  if (!rawSector) return 'Other';
  const upper = rawSector.toUpperCase();
  for (const [simplified, keywords] of Object.entries(SIMPLIFIED_SECTORS)) {
    if (keywords.some(keyword => upper.includes(keyword))) {
      return simplified;
    }
  }
  return 'Other';
}

const PAGE_SIZE = 100;

export function useStockCards() {
  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState<SortKey>('market_cap');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [filters, setFilters] = useState<StockFilters>({
    search: '',
    sector: 'all',
    minMarketCap: 'all',
    minVolume: 'all',
    changeFilter: 'all',
    technicalSignal: 'all',
    near52WeekHigh: false,
    near52WeekLow: false,
  });

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [filters, sortKey, sortDirection]);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['stock-cards', page, sortKey, sortDirection, filters],
    queryFn: async () => {
      let query = supabase
        .from('stock_cards')
        .select('*', { count: 'exact' })
        .eq('is_active', true)
        .not('price_usd', 'is', null)
        .gt('price_usd', 0);

      // Search filter
      if (filters.search) {
        query = query.or(`symbol.ilike.%${filters.search}%,name.ilike.%${filters.search}%`);
      }

      // Market cap filter
      if (filters.minMarketCap !== 'all') {
        const threshold = parseFloat(filters.minMarketCap);
        query = query.gte('market_cap', threshold);
      }

      // Volume filter
      if (filters.minVolume !== 'all') {
        const threshold = parseFloat(filters.minVolume);
        query = query.gte('volume', threshold);
      }

      // Change filter (gainers/losers)
      if (filters.changeFilter === 'gainers') {
        query = query.gt('change_pct', 0);
      } else if (filters.changeFilter === 'losers') {
        query = query.lt('change_pct', 0);
      }

      // Technical signal filter
      if (filters.technicalSignal !== 'all') {
        query = query.eq('technical_signal', filters.technicalSignal);
      }

      // Sorting
      query = query.order(sortKey, { ascending: sortDirection === 'asc', nullsFirst: false });

      // Pagination
      const from = (page - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      query = query.range(from, to);

      const { data: stocks, error, count } = await query;

      if (error) throw error;

      // Post-process filters that can't be done in Supabase
      let filteredStocks = stocks as StockCard[];

      // Sector filter (post-process due to keyword matching)
      if (filters.sector !== 'all') {
        filteredStocks = filteredStocks.filter(stock => 
          getSimplifiedSector(stock.sector) === filters.sector
        );
      }

      // Near 52-week high filter
      if (filters.near52WeekHigh) {
        filteredStocks = filteredStocks.filter(stock => {
          if (!stock.price_usd || !stock.high_52w) return false;
          return stock.price_usd >= stock.high_52w * 0.95;
        });
      }

      // Near 52-week low filter
      if (filters.near52WeekLow) {
        filteredStocks = filteredStocks.filter(stock => {
          if (!stock.price_usd || !stock.low_52w) return false;
          return stock.price_usd <= stock.low_52w * 1.05;
        });
      }

      return {
        stocks: filteredStocks,
        totalCount: count ?? 0,
        pageCount: Math.ceil((count ?? 0) / PAGE_SIZE),
      };
    },
    staleTime: 30000, // 30 seconds
  });

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDirection('desc');
    }
  };

  const updateFilters = (newFilters: Partial<StockFilters>) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
  };

  return {
    stocks: data?.stocks ?? [],
    totalCount: data?.totalCount ?? 0,
    pageCount: data?.pageCount ?? 1,
    page,
    setPage,
    sortKey,
    sortDirection,
    handleSort,
    filters,
    updateFilters,
    isLoading,
    error,
    refetch,
  };
}

export function useStockFilters() {
  const { data } = useQuery({
    queryKey: ['stock-filter-options'],
    queryFn: async () => {
      // Get unique sectors
      const { data: stocks } = await supabase
        .from('stock_cards')
        .select('sector')
        .eq('is_active', true)
        .not('sector', 'is', null);

      const sectorSet = new Set<string>();
      stocks?.forEach(stock => {
        const simplified = getSimplifiedSector(stock.sector);
        if (simplified !== 'Other') sectorSet.add(simplified);
      });

      return {
        sectors: ['all', ...Array.from(sectorSet).sort()],
      };
    },
    staleTime: 300000, // 5 minutes
  });

  return {
    sectors: data?.sectors ?? ['all'],
  };
}
