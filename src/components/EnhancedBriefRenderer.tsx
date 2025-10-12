import React from 'react';
import DOMPurify from 'dompurify';
import { useNavigate } from 'react-router-dom';
import { getTickerMapping, isKnownCrypto } from '@/config/tickerMappings';
import { supabase } from '@/integrations/supabase/client';

interface EnhancedBriefRendererProps {
  content: string;
  enhancedTickers?: {[key: string]: any};
  onTickersExtracted?: (tickers: string[]) => void;
  stoicQuote?: string;
  stoicQuoteAuthor?: string;
}

export function EnhancedBriefRenderer({ content, enhancedTickers = {}, onTickersExtracted, stoicQuote, stoicQuoteAuthor }: EnhancedBriefRendererProps) {
  const navigate = useNavigate();

  // Remove any inlined Stoic quote from the beginning or end of the article content
  const cleanedContent = React.useMemo(() => {
    if (!stoicQuote || !content) return content;

    const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const q = esc(stoicQuote.trim());
    const a = stoicQuoteAuthor ? esc(stoicQuoteAuthor.trim()) : '';

    // Allow curly/straight quotes around the text
    const qText = `(?:[“\"']\\s*)?${q}(?:\\s*[”\"'])?`;
    const author = a ? `(?:<cite>\\s*)?${a}(?:\\s*</cite>)?` : '';
    const br = '(?:<br\\s*/?>\\s*)?';
    const dash = '(?:[-–—]|&mdash;|&ndash;)?\\s*';
    const pOpen = '(?:<p[^>]*>\\s*)?';
    const pClose = '(?:\\s*</p>)?';
    const emOpen = '(?:<em[^>]*>\\s*)?';
    const emClose = '(?:\\s*</em>)?';
    const bqOpen = '(?:<blockquote[^>]*>\\s*)?';
    const bqClose = '(?:\\s*</blockquote>)?';

    const patterns: RegExp[] = [
      // END-anchored single-paragraph variants
      new RegExp(`${pOpen}${bqOpen}${emOpen}${qText}${emClose}${bqClose}${br}${dash}${author}${pClose}\\s*$`, 'i'),
      // END-anchored two-paragraph (quote then author)
      new RegExp(`${pOpen}${emOpen}${qText}${emClose}${pClose}\\s*${pOpen}${dash}${author}${pClose}\\s*$`, 'i'),
      // END-anchored quote only
      new RegExp(`${pOpen}${emOpen}${qText}${emClose}${pClose}\\s*$`, 'i'),

      // START-anchored single-paragraph variants
      new RegExp(`^\\s*${pOpen}${bqOpen}${emOpen}${qText}${emClose}${bqClose}${br}${dash}${author}${pClose}`, 'i'),
      // START-anchored two-paragraph (quote then author)
      new RegExp(`^\\s*${pOpen}${emOpen}${qText}${emClose}${pClose}\\s*${pOpen}${dash}${author}${pClose}`, 'i'),
      // START-anchored quote only
      new RegExp(`^\\s*${pOpen}${emOpen}${qText}${emClose}${pClose}`, 'i'),
    ];

    let result = content.trim();
    patterns.forEach((rx) => {
      result = result.replace(rx, '').trim();
    });

    return result;
  }, [content, stoicQuote, stoicQuoteAuthor]);

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
    const NON_ASSET = new Set(['CPI', 'GREED', 'NEUTRAL']);
    const mapping = getTickerMapping(upperTicker);

    if (mapping) {
      if (mapping.type === 'crypto') {
        // Crypto → external detail on CoinGecko (no internal chart yet)
        window.open(`https://www.coingecko.com/en/search?query=${encodeURIComponent(upperTicker)}`,'_blank');
      } else {
        // Stocks, indices, forex → internal Markets page using mapped symbol (EXCHANGE:SYMBOL)
        navigate(`/markets?symbol=${encodeURIComponent(mapping.symbol)}`);
      }
      return;
    }

    if (NON_ASSET.has(upperTicker)) {
      // Macro/sentiment keywords: do nothing
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
    // Normalize any pre-existing HTML tags in the source to plain newlines/markdown first
    const normalized = text
      .replace(/<\/p>\s*<p>/gi, '\n\n')
      .replace(/<\/?p>/gi, '')
      .replace(/<br\s*\/?>(\n)?/gi, '\n')
      .replace(/&lt;<\/p>&gt;\s*&lt;<p>&gt;/gi, '\n\n')
      .replace(/&lt;br\s*\/?&gt;/gi, '\n')
      // Convert heading tags to markdown BEFORE HTML escaping
      .replace(/<\/?h1[^>]*>/gi, '###H1###')
      .replace(/<\/?h2[^>]*>/gi, '###H2###')
      .replace(/<\/?h3[^>]*>/gi, '###H3###')
      .replace(/<\/?h4[^>]*>/gi, '###H4###')
      .replace(/<\/?h5[^>]*>/gi, '###H5###')
      .replace(/<\/?h6[^>]*>/gi, '###H6###')
      // Convert list tags to markdown
      .replace(/<\/?ul[^>]*>/gi, '\n')
      .replace(/<\/?ol[^>]*>/gi, '\n')
      .replace(/<li[^>]*>/gi, '• ')
      .replace(/<\/li>/gi, '\n')
      // Clean up any existing <strong> tags that might be in the content
      .replace(/<\/?strong>/gi, '**');

    let enhancedText = normalized;

    // Enhanced typography and styling - handle entities first, then convert markdown
    enhancedText = enhancedText.replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      // Convert markdown-style bold to HTML
      .replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold text-foreground">$1</strong>')
      // Convert markdown headings to styled spans
      .replace(/###H1###(.*?)###H1###/g, '<span class="heading-1">$1</span>')
      .replace(/###H2###(.*?)###H2###/g, '<span class="heading-2">$1</span>')
      .replace(/###H3###(.*?)###H3###/g, '<span class="heading-3">$1</span>')
      .replace(/###H4###(.*?)###H4###/g, '<span class="heading-4">$1</span>')
      .replace(/###H5###(.*?)###H5###/g, '<span class="heading-5">$1</span>')
      .replace(/###H6###(.*?)###H6###/g, '<span class="heading-6">$1</span>')
      .replace(/\n\n\n+/g, '</p></div><div class="section-break my-8"><hr class="border-border/30" /></div><div class="space-y-6"><p class="mb-6 leading-relaxed text-foreground/90">')
      .replace(/\n\n+/g, '</p><p class="mb-6 leading-relaxed text-foreground/90">')
      .replace(/\n/g, '<br/>');

    // Style prices (e.g., $50,000, $1.25, $0.00045) - bold white
    enhancedText = enhancedText.replace(/\$([0-9,]+(?:\.[0-9]+)?)/g, 
      '<span class="price-badge">$$$1</span>');

    // Style percentages (e.g., +5.2%, -3.1%) - will be colored by sign
    enhancedText = enhancedText.replace(/([+-]?)([0-9]+\.?[0-9]*)%/g, 
      '<span class="percentage-badge" data-sign="$1" data-value="$2">$1$2%</span>');

    // Sanitize HTML before DOM manipulation to prevent XSS attacks
    const sanitized = DOMPurify.sanitize(enhancedText, {
      ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'span', 'div', 'ul', 'ol', 'li', 'hr'],
      ALLOWED_ATTR: ['class', 'data-ticker', 'data-type', 'data-sign', 'data-value', 'data-quote-symbol', 'data-sym', 'style'],
      KEEP_CONTENT: true,
      RETURN_DOM: false,
      RETURN_DOM_FRAGMENT: false
    });

    // DOM-based ticker wrapping - link only ticker symbol inside parentheses
    const extractedTickers: string[] = [];
    const parser = new DOMParser();
    const tempDoc = parser.parseFromString(`<div>${sanitized}</div>`, 'text/html');
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
            
            // Create structure: Name (SYMBOL) $price (+change%)
            // Each component gets its own span with specific class
            
            // Name span
            const nameSpan = document.createElement('span');
            nameSpan.className = 'sym-name';
            nameSpan.textContent = name;
            
            // Space between name and ticker
            const spaceText = document.createTextNode(' ');
            
            // Parentheses wrapper for ticker and price data
            const parenWrapper = document.createElement('span');
            parenWrapper.className = 'ticker-parentheses';
            parenWrapper.setAttribute('data-quote-symbol', symbol);
            parenWrapper.setAttribute('data-sym', symbol);
            
            // Opening paren
            const openParen = document.createTextNode('(');
            
            // Clickable ticker symbol with its own span
            const tickerLink = document.createElement('span');
            tickerLink.className = 'sym-ticker';
            tickerLink.setAttribute('data-ticker', symbol);
            tickerLink.setAttribute('onclick', `window.handleTickerClick('${symbol}')`);
            tickerLink.style.cursor = 'pointer';
            tickerLink.textContent = symbol;
            
            // Closing paren (will be populated with price/change later)
            const closeParen = document.createTextNode(')');
            
            parenWrapper.appendChild(openParen);
            parenWrapper.appendChild(tickerLink);
            parenWrapper.appendChild(closeParen);
            
            const parent = node.parentNode;
            if (parent) {
              // Insert in order: beforeText, nameSpan, space, parenWrapper, afterText
              if (afterText) {
                const afterNode = document.createTextNode(afterText);
                parent.insertBefore(afterNode, node.nextSibling);
              }
              parent.insertBefore(parenWrapper, node.nextSibling);
              parent.insertBefore(spaceText, node.nextSibling);
              parent.insertBefore(nameSpan, node.nextSibling);
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
    
    enhancedText = container.innerHTML;

    return { html: enhancedText, tickers: extractedTickers };
  };

  const { html: enhancedHtml, tickers } = React.useMemo(() => processContent(cleanedContent), [cleanedContent, enhancedTickers]);

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

      console.log('📊 Initializing inline quotes for:', symbols);

      try {
        // Step 1: Get capabilities from symbol-intelligence using Supabase invoke
        console.log('🔍 Fetching symbol intelligence...');
        const { data: intelligenceData, error: intelligenceError } = await supabase.functions.invoke('symbol-intelligence', {
          body: { symbols }
        });

        if (intelligenceError) {
          console.error('❌ Symbol intelligence error:', intelligenceError);
          return;
        }

        const resolved = intelligenceData?.symbols || [];
        console.log('✅ Symbol intelligence resolved:', resolved);

        // Step 2: Get live quotes using Supabase invoke
        console.log('💰 Fetching live quotes...');
        const { data: quotesData, error: quotesError } = await supabase.functions.invoke('quotes', {
          body: { symbols }
        });

        if (quotesError) {
          console.error('❌ Quotes fetch error:', quotesError);
          // Continue anyway - we can still show tickers without prices
        }

        console.log('✅ Quotes fetched:', quotesData?.quotes?.length || 0, 'quotes');

        // Step 3: Update each parentheses wrapper with price data
        quoteElements.forEach(el => {
          const sym = el.getAttribute('data-quote-symbol');
          const capability = resolved.find((r: any) => r.normalized === sym);
          const quote = quotesData.quotes?.find((q: any) => q.symbol === sym);

          if (!capability) return;

          // Set capability flags
          el.setAttribute('data-price-ok', String(capability.price_ok));
          el.setAttribute('data-tv-ok', String(capability.tv_ok));

          const tickerLink = el.querySelector('.sym-ticker');
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

            // Create separate spans for price and change
            const priceSpan = document.createElement('span');
            priceSpan.className = 'sym-price';
            priceSpan.textContent = ` $${formatPrice(priceData.price)}`;
            
            // Insert price before closing paren
            el.insertBefore(priceSpan, closeParen);
            
            if (priceData.change !== null && priceData.change !== undefined) {
              const isPositive = priceData.change >= 0;
              const changeSpan = document.createElement('span');
              changeSpan.className = isPositive ? 'sym-change positive' : 'sym-change negative';
              changeSpan.textContent = ` ${formatChange(priceData.change)}`;
              
              // Insert change before closing paren
              el.insertBefore(changeSpan, closeParen);
            }
            
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
        
        /* Asset mention components - each with its own styling */
        
        /* Token/Asset Name - plain text, inherits color */
        .sym-name {
          display: inline;
          color: hsl(var(--foreground));
          font-weight: 500;
        }
        
        /* Ticker parentheses wrapper */
        .ticker-parentheses {
          display: inline;
          white-space: nowrap;
        }
        
        /* Ticker Symbol - clickable, accent color */
        .sym-ticker {
          display: inline;
          color: hsl(var(--primary));
          font-weight: 700;
          text-decoration: none;
          cursor: pointer;
          transition: all 0.2s ease;
          border-bottom: 1px solid transparent;
        }
        
        .sym-ticker:hover {
          opacity: 0.8;
          border-bottom-color: hsl(var(--primary));
        }
        
        /* Price - neutral accent color */
        .sym-price {
          display: inline;
          color: hsl(var(--muted-foreground));
          font-weight: 600;
          font-size: 0.95rem;
        }
        
        /* Percentage Change - color coded by sign */
        .sym-change {
          display: inline;
          font-weight: 700;
          font-size: 0.95rem;
        }
        
        .sym-change.positive {
          color: hsl(var(--success));
        }
        
        .sym-change.negative {
          color: hsl(var(--destructive));
        }
        
        /* Standalone price badges (not in ticker context) */
        .price-badge {
          color: hsl(var(--muted-foreground));
          font-weight: 600;
          font-size: 0.95rem;
        }
        
        /* Standalone percentage badges */
        .percent {
          font-weight: 700;
          font-size: 0.95rem;
        }
        .percent.positive {
          color: hsl(var(--success));
        }
        .percent.negative {
          color: hsl(var(--destructive));
        }
        .percent.neutral {
          color: hsl(var(--muted-foreground));
        }
        
        /* Section breaks */
        .section-break {
          border-color: hsl(var(--border) / 0.3);
        }
        
        /* Headings */
        .heading-1, .heading-2, .heading-3 {
          display: block;
          font-weight: 700;
          color: hsl(var(--foreground));
          margin-top: 2rem;
          margin-bottom: 1rem;
          line-height: 1.3;
        }
        
        .heading-1 {
          font-size: 2rem;
          border-bottom: 2px solid hsl(var(--primary));
          padding-bottom: 0.5rem;
        }
        
        .heading-2 {
          font-size: 1.5rem;
        }
        
        .heading-3 {
          font-size: 1.25rem;
        }
        
        .heading-4, .heading-5, .heading-6 {
          display: block;
          font-weight: 600;
          color: hsl(var(--foreground) / 0.9);
          margin-top: 1.5rem;
          margin-bottom: 0.75rem;
        }
        
        /* Responsive adjustments */
        @media (max-width: 640px) {
          .enhanced-brief {
            font-size: 0.95rem;
            line-height: 1.6;
          }
          
          .heading-1 {
            font-size: 1.5rem;
          }
          
          .heading-2 {
            font-size: 1.25rem;
          }
          
          .heading-3 {
            font-size: 1.1rem;
          }
          
          .sym-price,
          .sym-change,
          .price-badge,
          .percent {
            font-size: 0.9rem;
          }
        }
      `}</style>
      <div dangerouslySetInnerHTML={{ __html: processedContent }} />
    </div>
  );
}