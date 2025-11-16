import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';

interface TickerMapping {
  symbol: string;
  display_name: string;
  tradingview_symbol: string;
  type: string;
  aliases?: string[];
  tradingview_supported?: boolean;
  coingecko_id?: string | null;
  polygon_ticker?: string | null;
  dex_address?: string | null;
  dex_chain?: string | null;
  dex_platforms?: Json | null;
}

async function fetchTickerMappings(): Promise<Map<string, TickerMapping>> {
  const { data, error } = await supabase
    .from('ticker_mappings')
    .select('symbol, display_name, tradingview_symbol, type, aliases, tradingview_supported, coingecko_id, polygon_ticker, dex_address, dex_chain, dex_platforms')
    .eq('is_active', true);

  if (error) throw error;

  const mappingMap = new Map<string, TickerMapping>();
  data?.forEach((mapping) => {
    // Add primary symbol
    mappingMap.set(mapping.symbol.toUpperCase(), mapping);
    
    // Add aliases
    mapping.aliases?.forEach((alias: string) => {
      mappingMap.set(alias.toUpperCase(), mapping);
    });
  });

  return mappingMap;
}

export function useTickerMappings() {
  const { data: mappings = new Map(), isLoading, refetch } = useQuery({
    queryKey: ['ticker-mappings'],
    queryFn: fetchTickerMappings,
    staleTime: 5 * 60 * 1000, // 5 minutes - data is considered fresh
    gcTime: 30 * 60 * 1000, // 30 minutes - keep in cache
    refetchOnWindowFocus: true, // Refetch when user returns to tab
    refetchOnMount: true, // Refetch on component mount
  });

  const getMapping = (ticker: string): TickerMapping | undefined => {
    return mappings.get(ticker.toUpperCase().trim());
  };

  return { mappings, getMapping, isLoading, refetch };
}
