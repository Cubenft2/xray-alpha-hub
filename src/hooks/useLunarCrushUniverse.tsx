import { useState, useEffect, useCallback } from 'react';
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
  percent_change_1h: number;
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
  logo_url?: string;
  categories?: string[];
  social_volume?: number;
  social_dominance?: number;
  interactions_24h?: number;
  sentiment?: number;
  blockchains?: string[];
}

export interface UniverseMetadata {
  total_coins: number;
  total_all_coins: number;
  total_market_cap: number;
  total_volume_24h: number;
  average_galaxy_score: number;
  average_sentiment: number;
  last_updated: string;
  page_size: number;
  offset: number;
  has_more: boolean;
}

export interface FilterState {
  search: string;
  category: string;
  minVolume: number;
  minGalaxyScore: number;
  minMarketCap: number;
  changeFilter: 'all' | 'gainers' | 'losers';
}

export const DEFAULT_FILTERS: FilterState = {
  search: '',
  category: 'all',
  minVolume: 0,
  minGalaxyScore: 0,
  minMarketCap: 0,
  changeFilter: 'all',
};

export function useLunarCrushUniverse() {
  const [sortKey, setSortKey] = useState<keyof CoinData>('market_cap_rank');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(100);
  const { toast } = useToast();

  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);

  // Debounced search for server requests
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(filters.search);
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [filters.search]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [filters.changeFilter, filters.category, filters.minVolume, filters.minGalaxyScore, filters.minMarketCap]);

  const fetchCoins = useCallback(async () => {
    const offset = (currentPage - 1) * pageSize;

    const { data, error: funcError } = await supabase.functions.invoke('lunarcrush-universe', {
      body: {
        limit: pageSize,
        offset,
        sortBy: sortKey,
        sortDir: sortDirection,
        search: debouncedSearch,
        changeFilter: filters.changeFilter,
        category: filters.category,
        minVolume: filters.minVolume,
        minGalaxyScore: filters.minGalaxyScore,
        minMarketCap: filters.minMarketCap,
      },
    });

    if (funcError) throw funcError;
    if (!data?.success) throw new Error(data?.error || 'Failed to fetch data');

    return {
      coins: data.data || [],
      metadata: data.metadata as UniverseMetadata || null,
    };
  }, [currentPage, pageSize, sortKey, sortDirection, debouncedSearch, filters]);

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['lunarcrush-universe', currentPage, pageSize, sortKey, sortDirection, debouncedSearch, filters],
    queryFn: fetchCoins,
    staleTime: 3 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
    placeholderData: (previousData) => previousData,
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
  });

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
  const totalItems = metadata?.total_coins || 0;
  const totalPages = Math.ceil(totalItems / pageSize);

  const handleSort = (key: keyof CoinData) => {
    if (sortKey === key) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDirection('asc');
    }
    setCurrentPage(1);
  };

  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + coins.length, totalItems);

  const handlePageChange = (page: number) => {
    const newPage = Math.max(1, Math.min(page, totalPages));
    if (newPage !== currentPage) {
      setCurrentPage(newPage);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return {
    coins,
    allCoins: coins,
    filteredCoins: coins,
    metadata,
    loading: isLoading,
    isFetching,
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
    handlePageChange,
    startIndex,
    endIndex,
    totalFilteredItems: totalItems,
  };
}

// Hook for top gainers
export function useTopGainers(limit = 5) {
  return useQuery({
    queryKey: ['lunarcrush-top-gainers', limit],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('lunarcrush-universe', {
        body: {
          limit,
          offset: 0,
          sortBy: 'percent_change_24h',
          sortDir: 'desc',
          changeFilter: 'gainers',
        },
      });
      if (error) throw error;
      return (data?.data || []) as CoinData[];
    },
    staleTime: 60 * 1000,
  });
}

// Hook for top losers
export function useTopLosers(limit = 5) {
  return useQuery({
    queryKey: ['lunarcrush-top-losers', limit],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('lunarcrush-universe', {
        body: {
          limit,
          offset: 0,
          sortBy: 'percent_change_24h',
          sortDir: 'asc',
          changeFilter: 'losers',
        },
      });
      if (error) throw error;
      return (data?.data || []) as CoinData[];
    },
    staleTime: 60 * 1000,
  });
}
