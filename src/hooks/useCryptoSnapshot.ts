import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface CryptoSnapshot {
  symbol: string;
  ticker: string;
  name: string;
  logo_url: string | null;
  coingecko_id: string | null;
  price: number;
  change_24h: number;
  change_percent: number;
  volume_24h: number;
  vwap: number;
  high_24h: number;
  low_24h: number;
  open_24h: number;
  market_cap: number | null;
  market_cap_rank: number | null;
  updated_at: string;
}

export function useCryptoSnapshot() {
  const [data, setData] = useState<CryptoSnapshot[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Initial fetch
  useEffect(() => {
    async function fetchSnapshot() {
      try {
        setIsLoading(true);
        const { data: snapshot, error: fetchError } = await supabase
          .from('crypto_snapshot')
          .select('*')
          .order('market_cap_rank', { ascending: true, nullsFirst: false });

        if (fetchError) throw fetchError;

        // Cast to our interface (database uses snake_case)
        const formattedData = (snapshot || []).map(row => ({
          symbol: row.symbol,
          ticker: row.ticker,
          name: row.name,
          logo_url: row.logo_url,
          coingecko_id: row.coingecko_id,
          price: Number(row.price) || 0,
          change_24h: Number(row.change_24h) || 0,
          change_percent: Number(row.change_percent) || 0,
          volume_24h: Number(row.volume_24h) || 0,
          vwap: Number(row.vwap) || 0,
          high_24h: Number(row.high_24h) || 0,
          low_24h: Number(row.low_24h) || 0,
          open_24h: Number(row.open_24h) || 0,
          market_cap: row.market_cap ? Number(row.market_cap) : null,
          market_cap_rank: row.market_cap_rank,
          updated_at: row.updated_at,
        }));

        setData(formattedData);
        if (formattedData.length > 0) {
          setLastUpdated(new Date(formattedData[0].updated_at));
        }
        setError(null);
      } catch (err) {
        console.error('Crypto snapshot fetch error:', err);
        setError(err instanceof Error ? err : new Error('Failed to fetch snapshot'));
      } finally {
        setIsLoading(false);
      }
    }

    fetchSnapshot();
  }, []);

  // Subscribe to realtime updates
  useEffect(() => {
    const channel = supabase
      .channel('crypto-snapshot-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'crypto_snapshot',
        },
        (payload) => {
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const newRow = payload.new as any;
            const formattedRow: CryptoSnapshot = {
              symbol: newRow.symbol,
              ticker: newRow.ticker,
              name: newRow.name,
              logo_url: newRow.logo_url,
              coingecko_id: newRow.coingecko_id,
              price: Number(newRow.price) || 0,
              change_24h: Number(newRow.change_24h) || 0,
              change_percent: Number(newRow.change_percent) || 0,
              volume_24h: Number(newRow.volume_24h) || 0,
              vwap: Number(newRow.vwap) || 0,
              high_24h: Number(newRow.high_24h) || 0,
              low_24h: Number(newRow.low_24h) || 0,
              open_24h: Number(newRow.open_24h) || 0,
              market_cap: newRow.market_cap ? Number(newRow.market_cap) : null,
              market_cap_rank: newRow.market_cap_rank,
              updated_at: newRow.updated_at,
            };

            setData((prev) => {
              const index = prev.findIndex((item) => item.symbol === formattedRow.symbol);
              if (index >= 0) {
                const updated = [...prev];
                updated[index] = formattedRow;
                return updated;
              }
              return [...prev, formattedRow].sort((a, b) => {
                if (a.market_cap_rank && b.market_cap_rank) {
                  return a.market_cap_rank - b.market_cap_rank;
                }
                if (a.market_cap_rank) return -1;
                if (b.market_cap_rank) return 1;
                return b.volume_24h - a.volume_24h;
              });
            });
            setLastUpdated(new Date(formattedRow.updated_at));
          } else if (payload.eventType === 'DELETE') {
            const oldRow = payload.old as any;
            setData((prev) => prev.filter((item) => item.symbol !== oldRow.symbol));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return { data, isLoading, error, lastUpdated };
}
