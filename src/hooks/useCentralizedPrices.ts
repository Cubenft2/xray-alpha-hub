import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface PriceData {
  symbol: string;
  price: number;
  change24h: number;
  displayName: string;
  updatedAt: Date;
}

interface PricesState {
  [symbol: string]: PriceData;
}

type ConnectionStatus = 'connecting' | 'live' | 'stale';

/**
 * Hook to read prices from the centralized live_prices table.
 * Uses Supabase Realtime for live updates - NO per-user WebSocket connections.
 * This allows unlimited users without hitting Polygon.io socket limits.
 */
export function useCentralizedPrices(symbols: string[] = []) {
  const [prices, setPrices] = useState<PricesState>({});
  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const [lastUpdate, setLastUpdate] = useState<number | null>(null);

  // Fetch initial prices from live_prices table
  const fetchPrices = useCallback(async () => {
    if (symbols.length === 0) return;

    try {
      const upperSymbols = symbols.map(s => s.toUpperCase());
      
      const { data, error } = await supabase
        .from('live_prices')
        .select('ticker, price, change24h, display, updated_at')
        .in('ticker', upperSymbols);

      if (error) {
        console.error('Error fetching live prices:', error);
        return;
      }

      if (data && data.length > 0) {
        const priceMap: PricesState = {};
        for (const row of data) {
          priceMap[row.ticker] = {
            symbol: row.ticker,
            price: row.price,
            change24h: row.change24h,
            displayName: row.display,
            updatedAt: new Date(row.updated_at)
          };
        }
        setPrices(prev => ({ ...prev, ...priceMap }));
        setLastUpdate(Date.now());
        
        // Check if data is fresh (updated within last 5 minutes)
        const mostRecentUpdate = Math.max(...data.map(r => new Date(r.updated_at).getTime()));
        const ageMs = Date.now() - mostRecentUpdate;
        setStatus(ageMs < 300000 ? 'live' : 'stale');
      }
    } catch (err) {
      console.error('Failed to fetch prices:', err);
    }
  }, [symbols]);

  // Subscribe to Realtime updates
  useEffect(() => {
    if (symbols.length === 0) return;

    // Initial fetch
    fetchPrices();

    // Set up Realtime subscription for price updates
    const channel = supabase
      .channel('live-prices-updates')
      .on(
        'postgres_changes',
        {
          event: '*', // INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'live_prices'
        },
        (payload) => {
          const newData = payload.new as {
            ticker: string;
            price: number;
            change24h: number;
            display: string;
            updated_at: string;
          };

          if (newData && symbols.map(s => s.toUpperCase()).includes(newData.ticker)) {
            setPrices(prev => ({
              ...prev,
              [newData.ticker]: {
                symbol: newData.ticker,
                price: newData.price,
                change24h: newData.change24h,
                displayName: newData.display,
                updatedAt: new Date(newData.updated_at)
              }
            }));
            setLastUpdate(Date.now());
            setStatus('live');
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('📊 Subscribed to live_prices Realtime updates');
        }
      });

    // Fallback: poll every 10 seconds for faster updates
    const pollInterval = setInterval(() => {
      fetchPrices();
    }, 10000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(pollInterval);
    };
  }, [symbols.join(','), fetchPrices]);

  return { prices, status, lastUpdate };
}
