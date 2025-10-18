import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface PolygonStockPrice {
  ticker: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  timestamp: string;
}

interface PolygonStockPricesResponse {
  success: boolean;
  data: PolygonStockPrice[];
  timestamp: string;
  source: string;
}

export function usePolygonStockPrices(tickers: string[]) {
  return useQuery({
    queryKey: ['polygon-stock-prices', tickers.join(',')],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('polygon-stocks-expanded', {
        body: { tickers }
      });

      if (error) throw error;
      return data as PolygonStockPricesResponse;
    },
    refetchInterval: 60000, // Stocks update less frequently than crypto
    staleTime: 30000,
    gcTime: 300000,
  });
}

export function usePolygonStockPrice(ticker: string) {
  const { data, isLoading, error } = usePolygonStockPrices([ticker]);
  
  return {
    stock: data?.data?.[0] || null,
    isLoading,
    error
  };
}
