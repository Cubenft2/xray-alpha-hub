import { useState, useEffect, useMemo } from 'react';
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
  const [coins, setCoins] = useState<CoinData[]>([]);
  const [metadata, setMetadata] = useState<UniverseMetadata | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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
    try {
      setLoading(true);
      setError(null);

      const { data, error: funcError } = await supabase.functions.invoke('lunarcrush-universe');

      if (funcError) throw funcError;
      if (!data?.success) throw new Error(data?.error || 'Failed to fetch data');

      setCoins(data.data || []);
      setMetadata(data.metadata || null);
    } catch (err: any) {
      console.error('Error fetching LunarCrush universe:', err);
      setError(err.message);
      toast({
        title: 'Error Loading Data',
        description: 'Failed to fetch crypto universe data. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCoins();
    // Auto-refresh every hour
    const interval = setInterval(fetchCoins, 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

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
    loading,
    error,
    filters,
    setFilters,
    sortKey,
    sortDirection,
    handleSort,
    refetch: fetchCoins,
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
