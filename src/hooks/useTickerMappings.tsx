import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface TickerMapping {
  symbol: string;
  display_name: string;
  tradingview_symbol: string;
  type: string;
  aliases?: string[];
  tradingview_supported?: boolean;
}

export function useTickerMappings() {
  const [mappings, setMappings] = useState<Map<string, TickerMapping>>(new Map());
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchMappings = async () => {
      try {
        const { data, error } = await supabase
          .from('ticker_mappings')
          .select('symbol, display_name, tradingview_symbol, type, aliases, tradingview_supported')
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

        setMappings(mappingMap);
      } catch (error) {
        console.error('Error fetching ticker mappings:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchMappings();
  }, []);

  const getMapping = (ticker: string): TickerMapping | undefined => {
    return mappings.get(ticker.toUpperCase().trim());
  };

  return { mappings, getMapping, isLoading };
}
