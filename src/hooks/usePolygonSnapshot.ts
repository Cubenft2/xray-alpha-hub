import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface CryptoSnapshot {
  ticker: string;
  symbol: string;
  name: string;
  logo_url: string | null;
  coingecko_id: string | null;
  price: number;
  change24h: number;
  changePercent: number;
  volume24h: number;
  vwap: number;
  high24h: number;
  low24h: number;
  open24h: number;
  updated: number;
  market_cap: number | null;
  market_cap_rank: number | null;
}

async function fetchSnapshot(): Promise<CryptoSnapshot[]> {
  const { data, error } = await supabase.functions.invoke('polygon-crypto-snapshot');
  
  if (error) {
    console.error('Snapshot fetch error:', error);
    throw new Error(error.message || 'Failed to fetch snapshot');
  }
  
  return data || [];
}

export function usePolygonSnapshot() {
  return useQuery({
    queryKey: ['polygon-crypto-snapshot'],
    queryFn: fetchSnapshot,
    refetchInterval: 30000, // Auto-refresh every 30 seconds
    staleTime: 25000, // Consider data stale after 25 seconds
    retry: 2,
  });
}
