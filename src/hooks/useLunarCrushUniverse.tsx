import { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface CoinData {
  id: number;
  name: string;
  symbol: string;
  price: number;
  price_btc: number;
  market_cap: number;
  percent_change_24h: number;
  percent_change_7d: number;
  percent_change_30d: number;
  volume_24h: number;
  max_supply: number | null;
  circulating_supply: number;
  close: number;
  galaxy_score: number;
  alt_rank: number;
  volatility: number;
  market_cap_rank: number;
  categories?: string[];
  social_volume?: number;
  sentiment?: number;
}

export interface UniverseMetadata {
  total_coins: number;
  total_market_cap: number;
  total_volume_24h: number;
  average_galaxy_score: number;
  last_updated: string;
}

export interface Filters {
  search: string;
  category: string;
  marketCapRange: [number, number];
  changeFilter: 'all' | 'gainers' | 'losers';
  galaxyScoreRange: [number, number];
  sentimentFilter: 'all' | 'positive' | 'neutral' | 'negative';
}

export function useLunarCrushUniverse() {
  const [sortKey, setSortKey] = useState<keyof CoinData>('market_cap_rank');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const { toast } = useToast();

  const [filters, setFilters] = useState<Filters>({
    search: '',
    category: 'all',
    marketCapRange: [0, 1000000000000],
    changeFilter: 'all',
    galaxyScoreRange: [0, 100],
    sentimentFilter: 'all',
  });

  const fetchCoins = async () => {
    const { data, error: funcError } = await supabase.functions.invoke('lunarcrush-universe');

    if (funcError) throw funcError;
    if (!data?.success) throw new Error(data?.error || 'Failed to fetch data');

    return {
      coins: data.data || [],
      metadata: data.metadata || null,
    };
  };

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['lunarcrush-universe'],
    queryFn: fetchCoins,
    staleTime: 3 * 60 * 1000, // 3 minutes - data is fresh
    gcTime: 30 * 60 * 1000, // 30 minutes - keep in cache
    refetchOnWindowFocus: false, // Don't refetch on tab switch
    refetchOnMount: false, // Don't refetch when component remounts
    refetchOnReconnect: false, // Don't refetch on internet reconnect
    refetchInterval: 3 * 60 * 1000, // Auto-refresh every 3 minutes if page is open
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000), // Exponential backoff
  });

  // Show toast on error (moved to useEffect to prevent infinite re-renders)
  useEffect(() => {
    if (error) {
      toast({
        title: 'Error Loading Data',
        description: 'Failed to fetch crypto universe data. Please try again.',
        variant: 'destructive',
      });
    }
  }, [error, toast]);

  const coins = data?.coins || [];
  const metadata = data?.metadata || null;

  const filteredAndSortedCoins = useMemo(() => {
    let result = [...coins];

    // Apply filters
    if (filters.search) {
      const search = filters.search.toLowerCase();
      result = result.filter(
        (coin) =>
          coin.symbol.toLowerCase().includes(search) ||
          coin.name.toLowerCase().includes(search)
      );
    }

    if (filters.changeFilter === 'gainers') {
      result = result.filter((coin) => coin.percent_change_24h > 0);
    } else if (filters.changeFilter === 'losers') {
      result = result.filter((coin) => coin.percent_change_24h < 0);
    }

    result = result.filter(
      (coin) =>
        coin.market_cap >= filters.marketCapRange[0] &&
        coin.market_cap <= filters.marketCapRange[1] &&
        coin.galaxy_score >= filters.galaxyScoreRange[0] &&
        coin.galaxy_score <= filters.galaxyScoreRange[1]
    );

    // Sort
    result.sort((a, b) => {
      const aVal = a[sortKey] ?? 0;
      const bVal = b[sortKey] ?? 0;
      const comparison = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [coins, filters, sortKey, sortDirection]);

  const handleSort = (key: keyof CoinData) => {
    if (sortKey === key) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDirection('asc');
    }
    setCurrentPage(1); // Reset to first page on sort
  };

  const totalPages = Math.ceil(filteredAndSortedCoins.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, filteredAndSortedCoins.length);
  const paginatedCoins = filteredAndSortedCoins.slice(startIndex, endIndex);

  const handlePageChange = (page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return {
    coins: paginatedCoins,
    allCoins: coins,
    filteredCoins: filteredAndSortedCoins,
    metadata,
    loading: isLoading,
    error: error?.message || null,
    filters,
    setFilters,
    sortKey,
    sortDirection,
    handleSort,
    refetch,
    currentPage,
    totalPages,
    pageSize,
    setPageSize,
    handlePageChange,
    startIndex,
    endIndex,
    totalFilteredItems: filteredAndSortedCoins.length,
  };
}
