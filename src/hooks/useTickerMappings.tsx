import { useState, useEffect } from 'react';
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
  // New fields from token_cards
  exchanges?: string[];
  best_exchange?: string | null;
}

export function useTickerMappings() {
  const [mappings, setMappings] = useState<Map<string, TickerMapping>>(new Map());
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchMappings = async () => {
      try {
        // Fetch from ticker_mappings as base
        const { data: tmData, error: tmError } = await supabase
          .from('ticker_mappings')
          .select('symbol, display_name, tradingview_symbol, type, aliases, tradingview_supported, coingecko_id, polygon_ticker, dex_address, dex_chain, dex_platforms')
          .eq('is_active', true);

        if (tmError) throw tmError;

        // Also fetch token_cards for exchange-based TradingView symbols
        const { data: tcData, error: tcError } = await supabase
          .from('token_cards')
          .select('canonical_symbol, name, tradingview_symbol, exchanges, best_exchange, coingecko_id, polygon_ticker')
          .not('tradingview_symbol', 'is', null);

        if (tcError) console.error('Error fetching token_cards:', tcError);

        // Build token_cards lookup map
        const tokenCardMap = new Map<string, typeof tcData[0]>();
        tcData?.forEach((tc) => {
          tokenCardMap.set(tc.canonical_symbol.toUpperCase(), tc);
        });

        const mappingMap = new Map<string, TickerMapping>();
        
        // Process ticker_mappings, enriching with token_cards data
        tmData?.forEach((mapping) => {
          const symbol = mapping.symbol.toUpperCase();
          const tokenCard = tokenCardMap.get(symbol);
          
          // Prefer token_cards tradingview_symbol if available (exchange-based)
          const enrichedMapping: TickerMapping = {
            ...mapping,
            tradingview_symbol: tokenCard?.tradingview_symbol || mapping.tradingview_symbol,
            exchanges: Array.isArray(tokenCard?.exchanges) ? tokenCard.exchanges as string[] : [],
            best_exchange: tokenCard?.best_exchange || null,
            coingecko_id: tokenCard?.coingecko_id || mapping.coingecko_id,
            polygon_ticker: tokenCard?.polygon_ticker || mapping.polygon_ticker,
          };
          
          // Add primary symbol
          mappingMap.set(symbol, enrichedMapping);
          
          // Add aliases
          mapping.aliases?.forEach((alias: string) => {
            mappingMap.set(alias.toUpperCase(), enrichedMapping);
          });
        });

        // Add any token_cards entries not in ticker_mappings
        tcData?.forEach((tc) => {
          const symbol = tc.canonical_symbol.toUpperCase();
          if (!mappingMap.has(symbol)) {
            mappingMap.set(symbol, {
              symbol: tc.canonical_symbol,
              display_name: tc.name || tc.canonical_symbol,
              tradingview_symbol: tc.tradingview_symbol || `CRYPTO:${symbol}USD`,
              type: 'crypto',
              exchanges: Array.isArray(tc.exchanges) ? tc.exchanges as string[] : [],
              best_exchange: tc.best_exchange || null,
              coingecko_id: tc.coingecko_id,
              polygon_ticker: tc.polygon_ticker,
            });
          }
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
