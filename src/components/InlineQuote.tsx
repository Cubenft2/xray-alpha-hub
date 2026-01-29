import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface QuoteData {
  symbol: string;
  price: number | null;
  change24h: number | null;
  timestamp: string;
  source: string;
  // SIL capability flags
  price_ok?: boolean;
  tv_ok?: boolean;
  derivs_ok?: boolean;
  social_ok?: boolean;
  displayName?: string;
  displaySymbol?: string;
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
  missing: string[];
  ts: string;
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

          if (derivsError) {
            // Handle rate limiting gracefully
            if (derivsError.message?.includes('Rate limit') || derivsError.message?.includes('429')) {
              console.warn(`Rate limited for ${symbol}, skipping derivatives data`);
              // Don't set error - just skip derivs display
            } else {
              console.error('Error fetching derivatives:', derivsError);
            }
          } else {
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

  const formatPrice = (price: number | null, priceOk?: boolean): string => {
    if (!priceOk || price === null) return 'n/a';
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

  // Check SIL capability flags
  const priceOk = quoteData?.price_ok !== false;
  const derivsOk = quoteData?.derivs_ok === true;

  if (error || !quoteData || quoteData.price === null || !priceOk) {
    return (
      <span 
        className={`inline-quote error ${className}`}
        title="Data not mapped yet - please contact admin to add this symbol"
      >
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
      data-sym={quoteData.displaySymbol || symbol}
    >
      ({symbol} ${formatPrice(quoteData.price, priceOk)} <span className={changeColorClass}>{formatChange(quoteData.change24h || 0)}</span>
      {showDerivs && derivsOk && derivData && (
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
  console.log('🔄 Initializing inline quotes system...');
  const quotesCache = new Map<string, QuoteData>();
  const derivsCache = new Map<string, DerivData>();
  
  // Fetch all symbols at once
  const fetchAllQuotes = async (symbols: string[]) => {
    if (symbols.length === 0) return;
    
    console.log('📡 Fetching quotes for symbols:', symbols);
    
    try {
      const { data: quotesResponse, error } = await supabase.functions.invoke('quotes', {
        body: { symbols }
      });

      if (error) {
        console.error('❌ Error from quotes function:', error);
        return;
      }

      console.log('✅ Received quotes response:', quotesResponse);

      if (quotesResponse?.quotes) {
        quotesResponse.quotes.forEach((quote: QuoteData) => {
          quotesCache.set(quote.symbol, quote);
          if (quote.price !== null) {
            console.log(`💰 Cached quote for ${quote.symbol}: $${quote.price}`);
          } else {
            console.warn(`⚠️ Missing data for ${quote.symbol}`);
          }
        });
      }
      
      // Log missing symbols
      if (quotesResponse?.missing && quotesResponse.missing.length > 0) {
        console.warn('⚠️ Missing ticker mappings for:', quotesResponse.missing);
      }

      // Update all quote spans on the page
      updateQuoteSpans();
    } catch (error) {
      console.error('❌ Error fetching bulk quotes:', error);
    }
  };

  const updateQuoteSpans = () => {
    const quoteSpans = document.querySelectorAll('[data-quote-symbol]');
    console.log(`🔍 Found ${quoteSpans.length} quote spans to update`);
    
    quoteSpans.forEach((span) => {
      const symbol = span.getAttribute('data-quote-symbol');
      if (!symbol) return;
      
      const quoteData = quotesCache.get(symbol);
      if (!quoteData) {
        console.log(`⏳ No data yet for ${symbol}, showing loading...`);
        span.textContent = `(${symbol} ...)`;
        return;
      }
      
      // Check SIL capability flags
      const priceOk = quoteData.price_ok !== false;
      
      if (quoteData.price === null || !priceOk) {
        span.textContent = `(${symbol} n/a)`;
        span.setAttribute('title', 'Data not mapped yet - please contact admin to add this symbol');
        if (span instanceof HTMLElement) {
          span.style.color = '#999';
        }
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
      
      // Safe DOM manipulation - avoid innerHTML for XSS prevention
      span.textContent = '';
      span.appendChild(document.createTextNode(`(${symbol} $${formatPrice(quoteData.price)} `));
      const changeSpan = document.createElement('span');
      changeSpan.style.color = changeColor;
      changeSpan.textContent = formatChange(quoteData.change24h);
      span.appendChild(changeSpan);
      span.appendChild(document.createTextNode(')'));
      span.setAttribute('title', `${formatTimestamp(quoteData.timestamp)} • source: ${quoteData.source}`);
      console.log(`✨ Updated ${symbol} with price $${quoteData.price}`);
    });
  };

  // Extract symbols from the page and fetch quotes
  const symbols = Array.from(document.querySelectorAll('[data-quote-symbol]'))
    .map(span => span.getAttribute('data-quote-symbol'))
    .filter((symbol): symbol is string => symbol !== null);
  
  const uniqueSymbols = [...new Set(symbols)];
  
  console.log('📋 Extracted symbols from page:', uniqueSymbols);
  
  if (uniqueSymbols.length > 0) {
    fetchAllQuotes(uniqueSymbols);
  } else {
    console.log('⚠️ No symbols found on page to fetch');
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