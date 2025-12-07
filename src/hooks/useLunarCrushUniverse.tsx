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
  total_all_coins: number;
  total_market_cap: number;
  total_volume_24h: number;
  average_galaxy_score: number;
  last_updated: string;
  page_size: number;
  offset: number;
  has_more: boolean;
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
  const [pageSize] = useState(50);
  const { toast } = useToast();

  const [filters, setFilters] = useState<Filters>({
    search: '',
    category: 'all',
    marketCapRange: [0, 1000000000000],
    changeFilter: 'all',
    galaxyScoreRange: [0, 100],
    sentimentFilter: 'all',
  });

  // Debounced search for server requests
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(filters.search);
      setCurrentPage(1); // Reset to first page on search change
    }, 300);
    return () => clearTimeout(timer);
  }, [filters.search]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [filters.changeFilter]);

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
      },
    });

    if (funcError) throw funcError;
    if (!data?.success) throw new Error(data?.error || 'Failed to fetch data');

    return {
      coins: data.data || [],
      metadata: data.metadata as UniverseMetadata || null,
    };
  }, [currentPage, pageSize, sortKey, sortDirection, debouncedSearch, filters.changeFilter]);

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['lunarcrush-universe', currentPage, pageSize, sortKey, sortDirection, debouncedSearch, filters.changeFilter],
    queryFn: fetchCoins,
    staleTime: 3 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
    placeholderData: (previousData) => previousData, // Keep previous data while fetching
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
    allCoins: coins, // For compatibility - now just returns current page
    filteredCoins: coins, // For compatibility
    metadata,
    loading: isLoading,
    isFetching, // For showing loading indicator during pagination
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
