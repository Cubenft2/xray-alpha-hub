import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface QuoteData {
  symbol: string;
  price: number;
  change24h: number;
  timestamp: string;
  source: string;
}

interface DerivData {
  symbol: string;
  fundingRate: number;
  liquidations24h: {
    long: number;
    short: number;
    total: number;
  };
  timestamp: string;
  source: string;
}

interface InlineQuoteProps {
  symbol: string;
  showDerivs?: boolean;
  className?: string;
}

interface QuotesResponse {
  quotes: QuoteData[];
  timestamp: string;
  cached: boolean;
}

interface DerivsResponse {
  derivatives: DerivData[];
  timestamp: string;
  cached: boolean;
}

export function InlineQuote({ symbol, showDerivs = false, className = "" }: InlineQuoteProps) {
  const [quoteData, setQuoteData] = useState<QuoteData | null>(null);
  const [derivData, setDerivData] = useState<DerivData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fetchedRef = useRef(false);

  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;
    
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch quotes data
        const { data: quotesResponse, error: quotesError } = await supabase.functions.invoke('quotes', {
          body: { symbols: [symbol] }
        });

        if (quotesError) {
          console.error('Error fetching quotes:', quotesError);
          setError('Failed to fetch price data');
          return;
        }

        const quotesData = quotesResponse as QuotesResponse;
        const quote = quotesData.quotes.find(q => q.symbol === symbol);
        if (quote) {
          setQuoteData(quote);
        }

        // Fetch derivatives data if requested
        if (showDerivs) {
          const { data: derivsResponse, error: derivsError } = await supabase.functions.invoke('derivs', {
            body: { symbols: [symbol] }
          });

          if (!derivsError) {
            const derivsData = derivsResponse as DerivsResponse;
            const deriv = derivsData.derivatives.find(d => d.symbol === symbol);
            if (deriv) {
              setDerivData(deriv);
            }
          }
        }
      } catch (err) {
        console.error('Error in InlineQuote:', err);
        setError('Failed to load data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [symbol, showDerivs]);

  const formatPrice = (price: number): string => {
    if (price >= 1000) {
      return price.toLocaleString('en-US', { 
        minimumFractionDigits: 0, 
        maximumFractionDigits: 0 
      });
    } else if (price >= 1) {
      return price.toLocaleString('en-US', { 
        minimumFractionDigits: 2, 
        maximumFractionDigits: 2 
      });
    } else {
      return price.toLocaleString('en-US', { 
        minimumFractionDigits: 4, 
        maximumFractionDigits: 6 
      });
    }
  };

  const formatChange = (change: number): string => {
    const sign = change >= 0 ? '+' : '';
    return `${sign}${change.toFixed(2)}%`;
  };

  const formatTimestamp = (timestamp: string): string => {
    const date = new Date(timestamp);
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `as of ${hours}:${minutes} MT`;
  };

  const formatLiquidations = (amount: number): string => {
    if (amount >= 1e9) return `$${(amount / 1e9).toFixed(1)}B`;
    if (amount >= 1e6) return `$${(amount / 1e6).toFixed(0)}M`;
    if (amount >= 1e3) return `$${(amount / 1e3).toFixed(0)}K`;
    return `$${amount.toFixed(0)}`;
  };

  if (loading) {
    return (
      <span className={`inline-quote loading ${className}`}>
        ({symbol} loading...)
      </span>
    );
  }

  if (error || !quoteData) {
    return (
      <span className={`inline-quote error ${className}`}>
        ({symbol} n/a)
      </span>
    );
  }

  const isPositive = quoteData.change24h >= 0;
  const changeColorClass = isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400';

  return (
    <span 
      className={`inline-quote ${className}`}
      title={`${formatTimestamp(quoteData.timestamp)} • source: ${quoteData.source}`}
    >
      ({symbol} ${formatPrice(quoteData.price)} <span className={changeColorClass}>{formatChange(quoteData.change24h)}</span>
      {showDerivs && derivData && (
        <>
          {derivData.fundingRate !== 0 && (
            <span className="text-xs ml-1 text-muted-foreground">
              • Funding: {(derivData.fundingRate * 100).toFixed(3)}%
            </span>
          )}
          {derivData.liquidations24h.total > 0 && (
            <span className="text-xs ml-1 text-muted-foreground">
              • Liqs: {formatLiquidations(derivData.liquidations24h.total)}
            </span>
          )}
        </>
      )}
      )
    </span>
  );
}

// Global inline quote system for use with EnhancedBriefRenderer
export function initializeInlineQuotes() {
  const quotesCache = new Map<string, QuoteData>();
  const derivsCache = new Map<string, DerivData>();
  
  // Fetch all symbols at once
  const fetchAllQuotes = async (symbols: string[]) => {
    if (symbols.length === 0) return;
    
    try {
      const { data: quotesResponse } = await supabase.functions.invoke('quotes', {
        body: { symbols }
      });

      if (quotesResponse?.quotes) {
        quotesResponse.quotes.forEach((quote: QuoteData) => {
          quotesCache.set(quote.symbol, quote);
        });
      }

      // Update all quote spans on the page
      updateQuoteSpans();
    } catch (error) {
      console.error('Error fetching bulk quotes:', error);
    }
  };

  const updateQuoteSpans = () => {
    const quoteSpans = document.querySelectorAll('[data-quote-symbol]');
    
    quoteSpans.forEach((span) => {
      const symbol = span.getAttribute('data-quote-symbol');
      if (!symbol) return;
      
      const quoteData = quotesCache.get(symbol);
      if (!quoteData) {
        span.textContent = `(${symbol} loading...)`;
        return;
      }
      
      const isPositive = quoteData.change24h >= 0;
      const changeColor = isPositive ? '#26a269' : '#c01c28';
      const formatPrice = (price: number): string => {
        if (price >= 1000) return price.toLocaleString('en-US', { maximumFractionDigits: 0 });
        if (price >= 1) return price.toLocaleString('en-US', { maximumFractionDigits: 2 });
        return price.toLocaleString('en-US', { maximumFractionDigits: 6 });
      };
      
      const formatChange = (change: number): string => {
        const sign = change >= 0 ? '+' : '';
        return `${sign}${change.toFixed(2)}%`;
      };
      
      const formatTimestamp = (timestamp: string): string => {
        const date = new Date(timestamp);
        const hours = date.getHours().toString().padStart(2, '0');
        const minutes = date.getMinutes().toString().padStart(2, '0');
        return `as of ${hours}:${minutes} MT`;
      };
      
      span.innerHTML = `(${symbol} $${formatPrice(quoteData.price)} <span style="color: ${changeColor}">${formatChange(quoteData.change24h)}</span>)`;
      span.setAttribute('title', `${formatTimestamp(quoteData.timestamp)} • source: ${quoteData.source}`);
    });
  };

  // Extract symbols from the page and fetch quotes
  const symbols = Array.from(document.querySelectorAll('[data-quote-symbol]'))
    .map(span => span.getAttribute('data-quote-symbol'))
    .filter((symbol): symbol is string => symbol !== null);
  
  const uniqueSymbols = [...new Set(symbols)];
  
  if (uniqueSymbols.length > 0) {
    fetchAllQuotes(uniqueSymbols);
  }
}

// CSS styles for inline quotes
export const inlineQuoteStyles = `
  .inline-quote {
    display: inline;
    font-weight: 500;
    white-space: nowrap;
  }
  
  .inline-quote.loading {
    color: #6b7280;
    font-style: italic;
  }
  
  .inline-quote.error {
    color: #ef4444;
  }
  
  [data-quote-symbol] {
    display: inline;
    font-weight: 500;
    white-space: nowrap;
    cursor: help;
  }
`;