import { useState, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface TokenCard {
  canonical_symbol: string;
  name: string | null;
  logo_url: string | null;
  price_usd: number | null;
  change_1h_pct: number | null;
  change_24h_pct: number | null;
  change_7d_pct: number | null;
  market_cap: number | null;
  volume_24h_usd: number | null;
  galaxy_score: number | null;
  alt_rank: number | null;
  sentiment: number | null;
  social_volume_24h: number | null;
  tier: number | null;
  categories: string[] | null;
  primary_chain: string | null;
  market_cap_rank: number | null;
  polygon_supported: boolean | null;
}

export type SortKey = 'market_cap_rank' | 'price_usd' | 'change_1h_pct' | 'change_24h_pct' | 'change_7d_pct' | 'market_cap' | 'volume_24h_usd' | 'galaxy_score' | 'alt_rank' | 'sentiment' | 'social_volume_24h';
export type SortDirection = 'asc' | 'desc';

export interface Filters {
  search: string;
  category: string;
  chain: string;
  tier: string;
  minVolume: string;
  minGalaxyScore: string;
  minMarketCap: string;
  changeFilter: 'all' | 'gainers' | 'losers';
  dataSource: 'all' | 'polygon' | 'lunarcrush';
  hideSuspicious: boolean;
}

// Data quality check - returns true if token appears suspicious
// Polygon-supported tokens are verified and never flagged as suspicious
export function isSuspiciousToken(
  marketCap: number | null, 
  volume: number | null,
  polygonSupported: boolean | null = false
): boolean {
  // Polygon-supported tokens are verified - never flag as suspicious
  if (polygonSupported) return false;
  
  if (marketCap === null || volume === null) return false;
  // Suspicious if market cap > $1B but volume < $100K (0.01% ratio)
  if (marketCap > 1_000_000_000 && volume < 100_000) return true;
  // Suspicious if market cap > $100M but volume < $1K
  if (marketCap > 100_000_000 && volume < 1_000) return true;
  return false;
}

export function isLowLiquidity(volume: number | null): boolean {
  return volume !== null && volume < 10_000;
}

const PAGE_SIZE = 100;

export function useTokenCards() {
  const [sortKey, setSortKey] = useState<SortKey>('market_cap_rank');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [filters, setFilters] = useState<Filters>({
    search: '',
    category: '',
    chain: '',
    tier: '',
    minVolume: '',
    minGalaxyScore: '',
    minMarketCap: '',
    changeFilter: 'all',
    dataSource: 'all',
    hideSuspicious: true, // ON by default
  });
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(filters.search);
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [filters.search]);

  // Reset page on filter change
  useEffect(() => {
    setCurrentPage(1);
  }, [filters.category, filters.chain, filters.tier, filters.minVolume, filters.minGalaxyScore, filters.minMarketCap, filters.changeFilter, filters.dataSource, filters.hideSuspicious, sortKey, sortDirection]);

  const fetchTokens = useCallback(async () => {
    let query = supabase
      .from('token_cards')
      .select('canonical_symbol, name, logo_url, price_usd, change_1h_pct, change_24h_pct, change_7d_pct, market_cap, volume_24h_usd, galaxy_score, alt_rank, sentiment, social_volume_24h, tier, categories, primary_chain, market_cap_rank, polygon_supported', { count: 'exact' });

    // Apply filters
    if (debouncedSearch) {
      query = query.or(`canonical_symbol.ilike.%${debouncedSearch}%,name.ilike.%${debouncedSearch}%`);
    }

    if (filters.category) {
      query = query.contains('categories', [filters.category]);
    }

    if (filters.chain) {
      query = query.eq('primary_chain', filters.chain);
    }

    if (filters.tier) {
      query = query.eq('tier', parseInt(filters.tier));
    }

    if (filters.minVolume) {
      query = query.gte('volume_24h_usd', parseFloat(filters.minVolume));
    }

    if (filters.minGalaxyScore) {
      query = query.gte('galaxy_score', parseFloat(filters.minGalaxyScore));
    }

    if (filters.minMarketCap) {
      query = query.gte('market_cap', parseFloat(filters.minMarketCap));
    }

    if (filters.changeFilter === 'gainers') {
      query = query.gt('change_24h_pct', 0);
    } else if (filters.changeFilter === 'losers') {
      query = query.lt('change_24h_pct', 0);
    }

    if (filters.dataSource === 'polygon') {
      query = query.eq('polygon_supported', true);
    } else if (filters.dataSource === 'lunarcrush') {
      query = query.or('polygon_supported.is.null,polygon_supported.eq.false');
    }

    // ALWAYS exclude scam tokens (cannot be bypassed by any filter)
    query = query.or('is_scam.is.null,is_scam.eq.false');

    // Hide suspicious tokens (market cap > $1B with volume < $100K)
    if (filters.hideSuspicious) {
      // Filter: volume > $1000 OR market_cap < $100M (allow small caps with low volume)
      query = query.or('volume_24h_usd.gt.1000,market_cap.lt.100000000,volume_24h_usd.is.null');
    }

    // Apply sorting
    const ascending = sortDirection === 'asc';
    query = query.order(sortKey, { ascending, nullsFirst: false });

    // Apply pagination
    const from = (currentPage - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    query = query.range(from, to);

    const { data, error, count } = await query;

    if (error) throw error;

    return {
      tokens: data as TokenCard[],
      totalCount: count || 0,
      totalPages: Math.ceil((count || 0) / PAGE_SIZE),
    };
  }, [debouncedSearch, filters.category, filters.chain, filters.tier, filters.minVolume, filters.minGalaxyScore, filters.minMarketCap, filters.changeFilter, filters.dataSource, filters.hideSuspicious, sortKey, sortDirection, currentPage]);

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['token-cards', debouncedSearch, filters.category, filters.chain, filters.tier, filters.minVolume, filters.minGalaxyScore, filters.minMarketCap, filters.changeFilter, filters.dataSource, filters.hideSuspicious, sortKey, sortDirection, currentPage],
    queryFn: fetchTokens,
    refetchInterval: 30000,
    staleTime: 15000,
  });

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDirection(key === 'market_cap_rank' || key === 'alt_rank' ? 'asc' : 'desc');
    }
  };

  const updateFilter = <K extends keyof Filters>(key: K, value: Filters[K]) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  return {
    tokens: data?.tokens || [],
    totalCount: data?.totalCount || 0,
    totalPages: data?.totalPages || 0,
    currentPage,
    setCurrentPage,
    sortKey,
    sortDirection,
    handleSort,
    filters,
    updateFilter,
    isLoading,
    isFetching,
    error,
    refetch,
  };
}

// Fetch unique categories and chains for filters
export function useTokenFilters() {
  const { data: categories } = useQuery({
    queryKey: ['token-categories'],
    queryFn: async () => {
      const { data } = await supabase
        .from('token_cards')
        .select('categories')
        .not('categories', 'is', null)
        .limit(1000);
      
      const allCategories = new Set<string>();
      data?.forEach(row => {
        (row.categories as string[])?.forEach(cat => allCategories.add(cat));
      });
      return Array.from(allCategories).sort();
    },
    staleTime: 300000, // Cache for 5 minutes
  });

  const { data: chains } = useQuery({
    queryKey: ['token-chains'],
    queryFn: async () => {
      const { data } = await supabase
        .from('token_cards')
        .select('primary_chain')
        .not('primary_chain', 'is', null)
        .limit(5000);
      
      const allChains = new Set<string>();
      data?.forEach(row => {
        if (row.primary_chain) allChains.add(row.primary_chain);
      });
      return Array.from(allChains).sort();
    },
    staleTime: 300000,
  });

  return { categories: categories || [], chains: chains || [] };
}
