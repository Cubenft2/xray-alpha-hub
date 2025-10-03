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

    // Style signed dollar deltas (e.g., +$120, -$45.50) - color coded
    enhancedText = enhancedText.replace(/([+-])\$([0-9,]+(?:\.[0-9]+)?)/g, (match, sign, amt) => {
      const cls = sign === '-' ? 'negative' : 'positive';
      return `<span class="delta ${cls}">${sign}$$${amt}</span>`;
    });

    // Style percentages (e.g., +5.2%, -3.1%) - will be colored by sign
    enhancedText = enhancedText.replace(/([+-]?)([0-9]+\.?[0-9]*)%/g, 
      '<span class="percentage-badge" data-sign="$1" data-value="$2">$1$2%</span>');

    // DOM-based ticker wrapping - link only ticker symbol inside parentheses
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
            
            // Create structure: "Name (SYMBOL)" where only SYMBOL is clickable
            // Name stays as plain text
            const nameText = document.createTextNode(name + ' ');
            
            // Parentheses wrapper
            const parenWrapper = document.createElement('span');
            parenWrapper.className = 'ticker-parentheses';
            parenWrapper.setAttribute('data-quote-symbol', symbol);
            parenWrapper.setAttribute('data-sym', symbol);
            
            // Opening paren
            const openParen = document.createTextNode('(');
            
            // Clickable ticker symbol
            const tickerLink = document.createElement('a');
            tickerLink.className = 'ticker-link';
            tickerLink.setAttribute('href', 'javascript:void(0)');
            tickerLink.setAttribute('data-ticker', symbol);
            tickerLink.setAttribute('onclick', `window.handleTickerClick('${symbol}')`);
            tickerLink.textContent = symbol;
            
            // Closing paren (will be populated with price/change later)
            const closeParen = document.createTextNode(')');
            
            parenWrapper.appendChild(openParen);
            parenWrapper.appendChild(tickerLink);
            parenWrapper.appendChild(closeParen);
            
            const parent = node.parentNode;
            if (parent) {
              // Insert in order: beforeText, name, parenWrapper, afterText
              if (afterText) {
                const afterNode = document.createTextNode(afterText);
                parent.insertBefore(afterNode, node.nextSibling);
              }
              parent.insertBefore(parenWrapper, node.nextSibling);
              parent.insertBefore(nameText, node.nextSibling);
              node.textContent = beforeText;
            }
          });
        }
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const element = node as HTMLElement;
        
        // Skip if it's a blacklisted tag or already processed
        if (skipTags.has(element.tagName) || element.classList.contains('ticker-parentheses')) {
          return;
        }
        
        // Process children
        const children = Array.from(node.childNodes);
        children.forEach(child => walkTextNodes(child));
      }
    };
    
    walkTextNodes(container);

    // Transform anchors that wrap "Name (SYMBOL)" into plain name + linked ticker only
    const anchorTokenRegex = /^\s*([A-Za-z0-9\s&.-]+?)\s+\(([A-Z0-9_]{2,12})\)\s*$/i;
    const anchorParenRegex = /^\s*\(([A-Z0-9_]{2,12})\)\s*$/i;
    const anchors = Array.from(container.querySelectorAll('a')) as HTMLAnchorElement[];
    anchors.forEach((a) => {
      const txt = (a.textContent || '').trim();

      // Case: full "Name (SYMBOL)"
      const m = txt.match(anchorTokenRegex);
      if (m) {
        const name = m[1].trim();
        const symbol = m[2].toUpperCase();
        extractedTickers.push(symbol);

        const frag = tempDoc.createDocumentFragment();
        frag.append(tempDoc.createTextNode(name + ' '));

        const parenWrapper = tempDoc.createElement('span');
        parenWrapper.className = 'ticker-parentheses';
        parenWrapper.setAttribute('data-quote-symbol', symbol);
        parenWrapper.setAttribute('data-sym', symbol);
        parenWrapper.append('(');

        const link = tempDoc.createElement('a');
        link.className = 'ticker-link';
        link.setAttribute('href', 'javascript:void(0)');
        link.setAttribute('data-ticker', symbol);
        link.setAttribute('onclick', `window.handleTickerClick('${symbol}')`);
        link.textContent = symbol;
        parenWrapper.appendChild(link);
        parenWrapper.append(')');

        frag.appendChild(parenWrapper);
        a.replaceWith(frag);
        return;
      }

      // Case: anchor is exactly "(SYMBOL)"
      const m2 = txt.match(anchorParenRegex);
      if (m2) {
        const symbol = m2[1].toUpperCase();
        extractedTickers.push(symbol);
        const parenWrapper = tempDoc.createElement('span');
        parenWrapper.className = 'ticker-parentheses';
        parenWrapper.setAttribute('data-quote-symbol', symbol);
        parenWrapper.setAttribute('data-sym', symbol);
        parenWrapper.append('(');
        const link = tempDoc.createElement('a');
        link.className = 'ticker-link';
        link.setAttribute('href', 'javascript:void(0)');
        link.setAttribute('data-ticker', symbol);
        link.setAttribute('onclick', `window.handleTickerClick('${symbol}')`);
        link.textContent = symbol;
        parenWrapper.appendChild(link);
        parenWrapper.append(')');
        a.replaceWith(parenWrapper);
      }
    });

    // Wrap bare parenthetical tickers in plain text nodes: "(SYMBOL)"
    const wrapBareParenTickers = () => {
      const parenRegex = /\(([A-Z0-9_]{2,12})\)/g;
      const nodes: Text[] = [];

      const collect = (node: Node) => {
        if (node.nodeType === Node.TEXT_NODE) {
          const parent = (node.parentElement as HTMLElement) || null;
          if (!parent) return;
          if (skipTags.has(parent.tagName) || parent.closest('.ticker-parentheses')) return;
          if (parenRegex.test(node.textContent || '')) {
            parenRegex.lastIndex = 0;
            nodes.push(node as Text);
          }
        } else if (node.nodeType === Node.ELEMENT_NODE) {
          const el = node as HTMLElement;
          if (skipTags.has(el.tagName) || el.classList.contains('ticker-parentheses')) return;
          Array.from(el.childNodes).forEach(collect);
        }
      };

      collect(container);

      nodes.forEach((node) => {
        const text = node.textContent || '';
        let lastIndex = 0;
        let m;
        let changed = false;
        const frag = tempDoc.createDocumentFragment();
        parenRegex.lastIndex = 0;
        while ((m = parenRegex.exec(text)) !== null) {
          changed = true;
          const before = text.slice(lastIndex, m.index);
          if (before) frag.append(tempDoc.createTextNode(before));
          const symbol = m[1].toUpperCase();
          extractedTickers.push(symbol);

          const parenWrapper = tempDoc.createElement('span');
          parenWrapper.className = 'ticker-parentheses';
          parenWrapper.setAttribute('data-quote-symbol', symbol);
          parenWrapper.setAttribute('data-sym', symbol);
          parenWrapper.append('(');
          const link = tempDoc.createElement('a');
          link.className = 'ticker-link';
          link.setAttribute('href', 'javascript:void(0)');
          link.setAttribute('data-ticker', symbol);
          link.setAttribute('onclick', `window.handleTickerClick('${symbol}')`);
          link.textContent = symbol;
          parenWrapper.appendChild(link);
          parenWrapper.append(')');

          frag.appendChild(parenWrapper);
          lastIndex = m.index + m[0].length;
        }
        if (changed) {
          const after = text.slice(lastIndex);
          if (after) frag.append(tempDoc.createTextNode(after));
          node.replaceWith(frag);
        }
      });
    };

    wrapBareParenTickers();
    
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
      const quoteElements = document.querySelectorAll('.ticker-parentheses[data-quote-symbol]');
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

        // Step 3: Update each parentheses wrapper with price data
        quoteElements.forEach(el => {
          const sym = el.getAttribute('data-quote-symbol');
          const capability = resolved.find((r: any) => r.normalized === sym);
          const quote = quotesData.quotes?.find((q: any) => q.symbol === sym);

          if (!capability) return;

          // Set capability flags
          el.setAttribute('data-price-ok', String(capability.price_ok));
          el.setAttribute('data-tv-ok', String(capability.tv_ok));

          const tickerLink = el.querySelector('.ticker-link');
          const closeParen = Array.from(el.childNodes).find(
            node => node.nodeType === Node.TEXT_NODE && node.textContent === ')'
          );
          
          if (!tickerLink || !closeParen) return;

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

          // Only show price if price_ok AND we have price data
          if (capability.price_ok && priceData && priceData.price !== null) {
            const formatPrice = (price: number) => {
              if (price >= 1000) return price.toLocaleString('en-US', { maximumFractionDigits: 0 });
              if (price >= 1) return price.toLocaleString('en-US', { maximumFractionDigits: 2 });
              return price.toLocaleString('en-US', { maximumFractionDigits: 6 });
            };

            const formatChange = (change: number) => {
              const sign = change >= 0 ? '+' : '';
              return `${sign}${change.toFixed(2)}%`;
            };

            // Build price display: " $price +change%"
            let priceHTML = ` <span class="price">$${formatPrice(priceData.price)}</span>`;
            
            if (priceData.change !== null && priceData.change !== undefined) {
              const isPositive = priceData.change >= 0;
              const changeClass = isPositive ? 'percent positive' : 'percent negative';
              priceHTML += ` <span class="${changeClass}">${formatChange(priceData.change)}</span>`;
            }

            // Insert price data before closing paren
            const priceSpan = document.createElement('span');
            priceSpan.innerHTML = priceHTML;
            el.insertBefore(priceSpan, closeParen);
            
            console.log(`✅ Updated ${sym} with price $${priceData.price}`);
          } else if (capability.price_ok) {
            // price_ok but no price data - show loading
            const loadingSpan = document.createElement('span');
            loadingSpan.className = 'text-muted-foreground';
            loadingSpan.textContent = ' ...';
            el.insertBefore(loadingSpan, closeParen);
          }
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
        
        /* Ticker parentheses wrapper */
        .ticker-parentheses {
          display: inline;
          white-space: nowrap;
          color: inherit;
        }
        
        /* Ticker link - only the symbol inside parentheses is clickable */
        .ticker-link {
          display: inline;
          color: #00e5ff;
          font-weight: 700;
          text-decoration: none;
          cursor: pointer;
          transition: all 0.2s ease;
          border-bottom: 1px solid transparent;
        }
        
        .ticker-link:hover {
          opacity: 0.8;
          border-bottom-color: #00e5ff;
        }
        
        /* Prevent color bleed to regular links */
        .enhanced-brief a {
          color: hsl(var(--foreground));
          text-decoration: underline;
        }
        
        .enhanced-brief a:hover {
          opacity: 0.8;
        }
        
        /* Price display - bold white */
        .price-badge,
        .price {
          color: #f8fafc;
          font-weight: 700;
          font-size: 0.95rem;
        }
        
        /* Percentage display - color coded by positive/negative */
        .percent {
          font-weight: 700;
          font-size: 0.95rem;
        }
        .percent.positive {
          color: #22c55e !important;
        }
        .percent.negative {
          color: #ef4444 !important;
        }
        .percent.neutral {
          color: #94a3b8;
        }
        
        /* Dollar delta display - color coded by positive/negative */
        .delta {
          font-weight: 700;
          font-size: 0.95rem;
        }
        .delta.positive { color: #22c55e !important; }
        .delta.negative { color: #ef4444 !important; }
        
        /* Mobile responsive adjustments */
        @media (max-width: 640px) {
          .ticker-link,
          .price,
          .percent {
            font-size: 0.9rem;
          }
        }
      `}</style>
      <div dangerouslySetInnerHTML={{ __html: processedContent }} />
    </div>
  );
}