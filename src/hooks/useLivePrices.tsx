import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface PriceData {
  price: number;
  change_24h: number;
}

interface LivePricesData {
  [symbol: string]: PriceData;
}

export function useLivePrices(tickers: string[] = []) {
  const [prices, setPrices] = useState<LivePricesData>({});
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchPrices = async () => {
    if (tickers.length === 0) {
      setLoading(false);
      return;
    }

    try {
      setIsRefreshing(true);
      
      // Deduplicate tickers
      const uniqueTickers = [...new Set(tickers.map(t => t.toUpperCase().trim()))];
      
      console.log('Fetching prices for:', uniqueTickers);
      
      // Fetch via the Supabase edge function (which handles batching and CoinGecko internally)
      const { data: quotesData, error: quotesError } = await supabase.functions.invoke('quotes', {
        body: { symbols: uniqueTickers }
      });

      if (quotesError) {
        console.error('Error fetching quotes:', quotesError);
        throw quotesError;
      }

      console.log('Quotes response:', quotesData);

      const newPrices: LivePricesData = {};

      // Process quotes response
      if (quotesData?.quotes) {
        quotesData.quotes.forEach((quote: any) => {
          if (quote.price !== null && quote.price !== undefined && quote.price > 0) {
            newPrices[quote.symbol] = {
              price: quote.price,
              change_24h: quote.change24h || 0
            };
          }
        });
      }

      console.log(`Fetched ${Object.keys(newPrices).length}/${uniqueTickers.length} prices successfully`);

      setPrices(newPrices);
      setLastUpdated(new Date());
    } catch (error) {
      console.error('Error in fetchPrices:', error);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchPrices();
    
    // Poll every 60 seconds (matches server cache TTL)
    const interval = setInterval(fetchPrices, 60 * 1000);
    
    return () => clearInterval(interval);
  }, [tickers.join(',')]);

  return {
    prices,
    loading,
    lastUpdated,
    isRefreshing,
    refetch: fetchPrices
  };
}