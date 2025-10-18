import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface UnifiedPrice {
  symbol: string;
  name?: string;
  price: number;
  change24h: number;
  timestamp: string;
  type: 'crypto' | 'stock';
  source: string;
}

interface UnifiedPricesResponse {
  success: boolean;
  prices: UnifiedPrice[];
  timestamp: string;
}

/**
 * Unified hook for fetching both crypto and stock prices
 * Automatically determines type based on symbol format
 */
export function useUnifiedPrices(symbols: string[]) {
  return useQuery({
    queryKey: ['unified-prices', symbols.join(',')],
    queryFn: async () => {
      // Separate crypto and stock symbols
      const cryptoSymbols: string[] = [];
      const stockSymbols: string[] = [];
      
      symbols.forEach(symbol => {
        // Common stock tickers are 1-5 uppercase letters
        // Crypto tickers are usually 2-10 letters/numbers
        const upperSymbol = symbol.toUpperCase();
        
        // Known stock tickers
        const knownStocks = ['SPY', 'QQQ', 'DIA', 'IWM', 'COIN', 'MSTR', 'RIOT', 'MARA', 
                             'CLSK', 'HUT', 'NVDA', 'AMD', 'MSFT', 'GOOGL', 'META', 
                             'AMZN', 'AAPL', 'TSLA', 'BITO', 'GBTC', 'HOOD', 'SQ', 'PYPL'];
        
        if (knownStocks.includes(upperSymbol)) {
          stockSymbols.push(upperSymbol);
        } else {
          cryptoSymbols.push(upperSymbol);
        }
      });
      
      const results: UnifiedPrice[] = [];
      
      // Fetch crypto prices
      if (cryptoSymbols.length > 0) {
        try {
          const { data: cryptoData, error: cryptoError } = await supabase.functions.invoke('quotes', {
            body: { symbols: cryptoSymbols }
          });
          
          if (!cryptoError && cryptoData?.quotes) {
            cryptoData.quotes.forEach((quote: any) => {
              if (quote.price) {
                results.push({
                  symbol: quote.symbol,
                  price: quote.price,
                  change24h: quote.change24h || 0,
                  timestamp: quote.timestamp || new Date().toISOString(),
                  type: 'crypto',
                  source: quote.source || 'unknown'
                });
              }
            });
          }
        } catch (error) {
          console.error('Failed to fetch crypto prices:', error);
        }
      }
      
      // Fetch stock prices
      if (stockSymbols.length > 0) {
        try {
          const { data: stockData, error: stockError } = await supabase.functions.invoke('polygon-stocks-expanded', {
            body: { tickers: stockSymbols }
          });
          
          if (!stockError && stockData?.data) {
            stockData.data.forEach((stock: any) => {
              // Safely handle timestamp - use current time if invalid
              let timestampStr = new Date().toISOString();
              if (stock.timestamp) {
                const parsedDate = new Date(stock.timestamp);
                if (!isNaN(parsedDate.getTime())) {
                  timestampStr = parsedDate.toISOString();
                }
              }
              
              results.push({
                symbol: stock.ticker,
                name: stock.name,
                price: stock.price,
                change24h: stock.changePercent,
                timestamp: timestampStr,
                type: 'stock',
                source: 'polygon'
              });
            });
          }
        } catch (error) {
          console.error('Failed to fetch stock prices:', error);
        }
      }
      
      return {
        success: true,
        prices: results,
        timestamp: new Date().toISOString()
      } as UnifiedPricesResponse;
    },
    refetchInterval: 5000, // Refresh every 5 seconds
    staleTime: 3000,
    gcTime: 60000,
  });
}

/**
 * Hook for fetching a single asset price (crypto or stock)
 */
export function useUnifiedPrice(symbol: string) {
  const { data, isLoading, error } = useUnifiedPrices([symbol]);
  
  return {
    price: data?.prices?.[0] || null,
    isLoading,
    error
  };
}
