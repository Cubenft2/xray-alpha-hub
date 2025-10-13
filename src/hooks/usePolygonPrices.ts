import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface PolygonPrice {
  symbol: string;
  price: number;
  timestamp: number;
  exchange: string;
  size: number;
}

interface PolygonPricesResponse {
  success: boolean;
  prices: PolygonPrice[];
  timestamp: string;
  source: string;
}

export function usePolygonPrices(symbols: string[]) {
  return useQuery({
    queryKey: ['polygon-prices', symbols.join(',')],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('polygon-crypto-prices', {
        body: { symbols }
      });

      if (error) throw error;
      return data as PolygonPricesResponse;
    },
    refetchInterval: 2000,
    staleTime: 5000,
    gcTime: 60000,
  });
}

export function usePolygonPrice(symbol: string) {
  const { data, isLoading, error } = usePolygonPrices([symbol]);
  
  return {
    price: data?.prices?.[0] || null,
    isLoading,
    error
  };
}
