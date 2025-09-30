import React from 'react';
import { useNavigate } from 'react-router-dom';
import { isKnownStock, isKnownCrypto } from '@/config/tickerMappings';

interface EnhancedBriefRendererProps {
  content: string;
  enhancedTickers?: {[key: string]: any};
  onTickersExtracted?: (tickers: string[]) => void;
}

export function EnhancedBriefRenderer({ content, enhancedTickers = {}, onTickersExtracted }: EnhancedBriefRendererProps) {
  const navigate = useNavigate();

  const handleTickerClick = React.useCallback((ticker: string) => {
    const upperTicker = ticker.toUpperCase();
    
    // Special cases that should redirect to CoinGecko search
    const coingeckoRedirect = new Set([
      'FIGR_HELOC',
      'FIGR',
    ]);
    
    if (coingeckoRedirect.has(upperTicker)) {
      window.open(`https://www.coingecko.com/en/search?query=${encodeURIComponent(upperTicker)}`,'_blank');
      return;
    }
    
    // Use centralized configuration to determine routing
    if (isKnownStock(upperTicker)) {
      // Route to Markets page for stocks
      navigate(`/markets?symbol=NASDAQ:${upperTicker}`);
      return;
    }
    
    if (isKnownCrypto(upperTicker)) {
      // Route to CoinGecko for crypto
      window.open(`https://www.coingecko.com/en/search?query=${encodeURIComponent(upperTicker)}`,'_blank');
      return;
    }
    
    // If not found in our mappings, log warning and default to CoinGecko
    console.warn(`⚠️ Unknown ticker "${upperTicker}" clicked - add to src/config/tickerMappings.ts for proper routing`);
    window.open(`https://www.coingecko.com/en/search?query=${encodeURIComponent(upperTicker)}`,'_blank');
  }, [navigate]);

  const processContent = (text: string) => {
    // Normalize any pre-existing HTML tags in the source to plain newlines first
    const normalized = text
      .replace(/<\/p>\s*<p>/gi, '\n\n')
      .replace(/<\/?p>/gi, '')
      .replace(/<br\s*\/?>(\n)?/gi, '\n')
      .replace(/&lt;<\/p>&gt;\s*&lt;<p>&gt;/gi, '\n\n')
      .replace(/&lt;br\s*\/?&gt;/gi, '\n')
      // Clean up any existing <strong> tags that might be in the content
      .replace(/<\/?strong>/gi, '**');

    let enhancedText = normalized;

    // Enhanced typography and styling - handle entities first, then convert markdown
    enhancedText = enhancedText.replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      // Convert markdown-style bold to HTML
      .replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold text-foreground">$1</strong>')
      .replace(/\n\n\n+/g, '</p></div><div class="section-break my-8"><hr class="border-border/30" /></div><div class="space-y-6"><p class="mb-6 leading-relaxed text-foreground/90">')
      .replace(/\n\n+/g, '</p><p class="mb-6 leading-relaxed text-foreground/90">')
      .replace(/\n/g, '<br/>');

    // Style prices (e.g., $50,000, $1.25, $0.00045)
    enhancedText = enhancedText.replace(/\$([0-9,]+(?:\.[0-9]+)?)/g, 
      '<span class="font-semibold text-green-400 bg-green-400/10 px-1.5 py-0.5 rounded text-sm">$$$1</span>');

    // Style percentages (e.g., +5.2%, -3.1%)
    enhancedText = enhancedText.replace(/([+-]?)([0-9]+\.?[0-9]*)%/g, 
      '<span class="font-semibold px-1.5 py-0.5 rounded text-sm percentage-badge" data-change="$1">$1$2%</span>');

    // Enhanced ticker detection - looks for "Name (SYMBOL)" patterns
    // Parentheses will only be shown if price_ok via capability check
    const tickerRegex = /([A-Za-z0-9\s&.-]+)\s*\(([A-Z0-9_]{2,12})\)/g;
    const extractedTickers: string[] = [];
    
    enhancedText = enhancedText.replace(tickerRegex, (match, name, symbol) => {
      extractedTickers.push(symbol.toUpperCase());
      const displayName = name.trim();
      const upperSymbol = symbol.toUpperCase();
      
      // Create ticker span - parentheses added conditionally by capability check
      return `<span 
        class="ticker-mention"
        data-quote-symbol="${upperSymbol}"
        data-sym="${upperSymbol}"
        data-display-name="${displayName}"
        onclick="window.handleTickerClick('${symbol}')">
        <span class="ticker-name font-semibold cursor-pointer hover:opacity-80 transition-opacity" style="color: inherit;">${displayName}</span>
      </span>`;
    });

    return { html: enhancedText, tickers: extractedTickers };
  };

  const { html: enhancedHtml, tickers } = React.useMemo(() => processContent(content), [content, enhancedTickers]);

  React.useEffect(() => {
    if (onTickersExtracted && tickers.length > 0) {
      const uniqueTickers = [...new Set(tickers)];
      onTickersExtracted(uniqueTickers);
    }
  }, [tickers.length]); // Only depend on length to avoid infinite loops

  React.useEffect(() => {
    // Add global click handler for ticker buttons
    (window as any).handleTickerClick = handleTickerClick;
    
    // Initialize capability-aware inline quotes
    const initCapabilityQuotes = async () => {
      const quoteElements = document.querySelectorAll('[data-quote-symbol]');
      if (quoteElements.length === 0) return;

      const symbols = Array.from(quoteElements).map(
        el => el.getAttribute('data-quote-symbol')
      ).filter(Boolean) as string[];

      if (symbols.length === 0) return;

      try {
        // Step 1: Get capabilities from symbol-intelligence
        const intelligenceResponse = await fetch(
          'https://odncvfiuzliyohxrsigc.supabase.co/functions/v1/symbol-intelligence',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ symbols }),
          }
        );

        const { symbols: resolved } = await intelligenceResponse.json();
        console.log('✅ Symbol intelligence resolved:', resolved);

        // Step 2: Get live quotes
        const quotesResponse = await fetch(
          'https://odncvfiuzliyohxrsigc.supabase.co/functions/v1/quotes',
          {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`
            },
            body: JSON.stringify({ symbols }),
          }
        );

        const quotesData = await quotesResponse.json();
        console.log('✅ Quotes fetched:', quotesData);

        // Step 3: Update each element with capability-aware rendering
        quoteElements.forEach(el => {
          const sym = el.getAttribute('data-quote-symbol');
          const capability = resolved.find((r: any) => r.normalized === sym);
          const quote = quotesData.quotes?.find((q: any) => q.symbol === sym);

          if (!capability) return;

          // Set capability flags
          el.setAttribute('data-price-ok', String(capability.price_ok));
          el.setAttribute('data-tv-ok', String(capability.tv_ok));

          const nameSpan = el.querySelector('.ticker-name');
          if (!nameSpan) return;

          // Remove any existing ticker-symbol span
          const existingSymbol = el.querySelector('.ticker-symbol');
          if (existingSymbol) existingSymbol.remove();

          // Only show parentheses with price if price_ok AND we have a quote
          if (capability.price_ok && quote && quote.price !== null) {
            const symbolSpan = document.createElement('span');
            symbolSpan.className = 'ticker-symbol font-semibold';
            
            const formatPrice = (price: number) => {
              if (price >= 1000) return price.toLocaleString('en-US', { maximumFractionDigits: 0 });
              if (price >= 1) return price.toLocaleString('en-US', { maximumFractionDigits: 2 });
              return price.toLocaleString('en-US', { maximumFractionDigits: 6 });
            };

            const formatChange = (change: number) => {
              const sign = change >= 0 ? '+' : '';
              return `${sign}${change.toFixed(2)}%`;
            };

            const isPositive = quote.change24h >= 0;
            const changeColor = isPositive ? '#26a269' : '#c01c28';

            symbolSpan.innerHTML = ` (${capability.displaySymbol || sym} $${formatPrice(quote.price)} <span style="color: ${changeColor}">${formatChange(quote.change24h)}</span>)`;
            nameSpan.after(symbolSpan);
            
            console.log(`✅ Updated ${sym} with price $${quote.price}`);
          } else if (capability.price_ok) {
            // price_ok but no quote data - show loading
            const symbolSpan = document.createElement('span');
            symbolSpan.className = 'ticker-symbol text-muted-foreground';
            symbolSpan.textContent = ` (${capability.displaySymbol || sym} ...)`;
            nameSpan.after(symbolSpan);
          }
          // If !price_ok, don't show parentheses at all
        });
      } catch (error) {
        console.error('Error initializing capability quotes:', error);
      }
    };
    
    if (tickers.length > 0) {
      initCapabilityQuotes();
    }
    
    // Style percentage elements based on positive/negative values
    const percentageElements = document.querySelectorAll('.percentage-badge[data-change]');
    percentageElements.forEach(el => {
      const change = el.getAttribute('data-change');
      if (change === '+' || (change !== '-' && !change?.startsWith('-'))) {
        el.classList.add('text-green-400', 'bg-green-400/10');
      } else {
        el.classList.add('text-red-400', 'bg-red-400/10');
      }
    });

    return () => {
      delete (window as any).handleTickerClick;
    };
  }, [handleTickerClick, tickers.length]);

  const processedContent = `<div class="space-y-6"><p class="mb-6 leading-relaxed text-foreground/90">${enhancedHtml}</p></div>`;

  return (
    <div className="enhanced-brief font-medium text-base leading-7 space-y-4 font-pixel">
      <style>{`
        .enhanced-brief {
          font-family: var(--font-pixel);
          line-height: 1.7;
          letter-spacing: 0.02em;
        }
        .enhanced-brief p {
          margin-bottom: 1rem;
        }
        .enhanced-brief strong {
          font-weight: 700;
          font-family: var(--font-pixel);
        }
        .ticker-link:hover, .ticker-link-enhanced:hover {
          transform: translateY(-1px);
          box-shadow: var(--glow-primary);
        }
        .ticker-link-enhanced {
          font-family: var(--font-mono);
          font-weight: 600;
        }
        .ticker-link {
          font-family: var(--font-pixel);
          font-weight: 700;
        }
      `}</style>
      <div dangerouslySetInnerHTML={{ __html: processedContent }} />
    </div>
  );
}