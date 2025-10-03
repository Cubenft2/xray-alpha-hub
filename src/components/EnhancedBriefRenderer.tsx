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

    // Style prices (e.g., $50,000, $1.25, $0.00045) - bold white
    enhancedText = enhancedText.replace(/\$([0-9,]+(?:\.[0-9]+)?)/g, 
      '<span class="price-badge">$$$1</span>');

    // Style percentages (e.g., +5.2%, -3.1%) - will be colored by sign
    enhancedText = enhancedText.replace(/([+-]?)([0-9]+\.?[0-9]*)%/g, 
      '<span class="percentage-badge" data-sign="$1" data-value="$2">$1$2%</span>');

    // DOM-based ticker wrapping to prevent color bleed
    const extractedTickers: string[] = [];
    const parser = new DOMParser();
    const tempDoc = parser.parseFromString(`<div>${enhancedText}</div>`, 'text/html');
    const container = tempDoc.body.firstChild as HTMLElement;
    
    // Skip these elements and their descendants
    const skipTags = new Set(['A', 'CODE', 'PRE', 'SCRIPT', 'STYLE', 'BUTTON', 'INPUT']);
    
    // Pattern: Name (SYMBOL) with word boundaries
    const tickerRegex = /\b([A-Za-z0-9\s&.-]+?)\s+\(([A-Z0-9_]{2,12})\)(?=[^\w]|$)/gi;
    
    const walkTextNodes = (node: Node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent || '';
        const matches: Array<{ match: string; name: string; symbol: string; index: number }> = [];
        
        let match;
        tickerRegex.lastIndex = 0;
        while ((match = tickerRegex.exec(text)) !== null) {
          matches.push({
            match: match[0],
            name: match[1].trim(),
            symbol: match[2].toUpperCase(),
            index: match.index
          });
        }
        
        if (matches.length > 0) {
          // Process matches in reverse order to maintain indices
          matches.reverse().forEach(({ match, name, symbol, index }) => {
            extractedTickers.push(symbol);
            
            const beforeText = text.substring(0, index);
            const afterText = text.substring(index + match.length);
            
            // Create asset wrapper
            const assetSpan = document.createElement('span');
            assetSpan.className = 'asset';
            assetSpan.setAttribute('data-quote-symbol', symbol);
            assetSpan.setAttribute('data-sym', symbol);
            assetSpan.setAttribute('data-display-name', name);
            assetSpan.setAttribute('onclick', `window.handleTickerClick('${symbol}')`);
            
            const nameSpan = document.createElement('span');
            nameSpan.className = 'asset-name';
            nameSpan.textContent = name;
            assetSpan.appendChild(nameSpan);
            
            const parent = node.parentNode;
            if (parent) {
              // Split and replace
              if (afterText) {
                const afterNode = document.createTextNode(afterText);
                parent.insertBefore(afterNode, node.nextSibling);
              }
              parent.insertBefore(assetSpan, node.nextSibling);
              node.textContent = beforeText;
            }
          });
        }
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const element = node as HTMLElement;
        
        // Skip if it's a blacklisted tag or already an asset
        if (skipTags.has(element.tagName) || element.classList.contains('asset')) {
          return;
        }
        
        // Process children
        const children = Array.from(node.childNodes);
        children.forEach(child => walkTextNodes(child));
      }
    };
    
    walkTextNodes(container);
    
    enhancedText = container.innerHTML;

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

          // Try live quote first, then fallback to enhancedTickers prop
          let priceData = null;
          if (quote && quote.price !== null) {
            priceData = { price: quote.price, change: quote.change24h };
          } else if (enhancedTickers[sym]) {
            priceData = { 
              price: enhancedTickers[sym].price, 
              change: enhancedTickers[sym].change_24h 
            };
          }

          // Only show parentheses with price if price_ok AND we have price data
          if (capability.price_ok && priceData && priceData.price !== null) {
            const symbolSpan = document.createElement('span');
            symbolSpan.className = 'ticker-symbol';
            
            const formatPrice = (price: number) => {
              if (price >= 1000) return price.toLocaleString('en-US', { maximumFractionDigits: 0 });
              if (price >= 1) return price.toLocaleString('en-US', { maximumFractionDigits: 2 });
              return price.toLocaleString('en-US', { maximumFractionDigits: 6 });
            };

            const formatChange = (change: number) => {
              const sign = change >= 0 ? '+' : '';
              return `${sign}${change.toFixed(2)}%`;
            };

            if (priceData.change !== null && priceData.change !== undefined) {
              const isPositive = priceData.change >= 0;
              const changeClass = isPositive ? 'percent positive' : 'percent negative';
              symbolSpan.innerHTML = ` (<span class="ticker-badge">${capability.displaySymbol || sym}</span> <span class="price">$${formatPrice(priceData.price)}</span> <span class="${changeClass}">${formatChange(priceData.change)}</span>)`;
            } else {
              symbolSpan.innerHTML = ` (<span class="ticker-badge">${capability.displaySymbol || sym}</span> <span class="price">$${formatPrice(priceData.price)}</span>)`;
            }
            nameSpan.after(symbolSpan);
            
            console.log(`✅ Updated ${sym} with price $${priceData.price}`);
          } else if (capability.price_ok) {
            // price_ok but no price data - show loading
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
    const percentageElements = document.querySelectorAll('.percentage-badge[data-sign]');
    percentageElements.forEach(el => {
      const sign = el.getAttribute('data-sign');
      const value = parseFloat(el.getAttribute('data-value') || '0');
      
      if (value === 0) {
        el.classList.add('percent', 'neutral');
      } else if (sign === '-') {
        el.classList.add('percent', 'negative');
      } else {
        el.classList.add('percent', 'positive');
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
        
        /* Asset container - no color, display inline */
        .asset {
          display: inline;
          cursor: pointer;
          color: inherit;
        }
        
        /* Asset names - bright cyan/teal (ONLY this span gets colored) */
        .asset-name {
          color: #00e5ff !important;
          font-weight: 600;
          transition: opacity 0.2s;
        }
        .asset:hover .asset-name {
          opacity: 0.8;
        }
        
        /* Critical: Prevent color bleed to links and parent text */
        a .asset,
        a .asset-name {
          color: inherit !important;
          text-decoration: none;
        }
        .enhanced-brief a {
          color: var(--foreground);
          text-decoration: underline;
        }
        .enhanced-brief a:hover {
          opacity: 0.8;
        }
        
        /* Ticker badges - pill style */
        .ticker-badge {
          display: inline-block;
          padding: 2px 8px;
          border-radius: 6px;
          background: #1e293b;
          border: 1px solid #334155;
          color: #f8fafc;
          font-weight: 600;
          font-size: 0.875rem;
          margin: 0 2px;
        }
        
        /* Ticker symbol wrapper (parentheses content) */
        .ticker-symbol {
          display: inline;
          white-space: nowrap;
        }
        
        /* Price badges - bold white */
        .price-badge,
        .price {
          color: #f8fafc;
          font-weight: 700;
          font-size: 0.95rem;
        }
        
        /* Percentage badges - auto-colored by sign */
        .percent {
          font-weight: 700;
          font-size: 0.95rem;
        }
        .percent.positive {
          color: #22c55e;
        }
        .percent.negative {
          color: #ef4444;
        }
        .percent.neutral {
          color: #94a3b8;
        }
        
        /* Legacy ticker styles */
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
        
        /* Mobile enhancements */
        @media (max-width: 640px) {
          .ticker-badge,
          .price-badge,
          .price,
          .percent {
            font-size: 0.9375rem;
          }
        }
      `}</style>
      <div dangerouslySetInnerHTML={{ __html: processedContent }} />
    </div>
  );
}