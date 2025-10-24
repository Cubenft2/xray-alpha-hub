import React from 'react';
import DOMPurify from 'dompurify';
import { useNavigate } from 'react-router-dom';
import { useTickerMappings } from '@/hooks/useTickerMappings';
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
  const { getMapping, isLoading: mappingsLoading } = useTickerMappings();
  
  // Live price state management
  const [livePrices, setLivePrices] = React.useState<Map<string, {
    price: number;
    change24h: number;
    updated_at: string;
  }>>(new Map());
  const [lastPriceUpdate, setLastPriceUpdate] = React.useState<Date | null>(null);
  const [priceLoading, setPriceLoading] = React.useState(false);

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

  // Unified ticker extraction from content
  const extractAllTickers = React.useCallback((text: string): Set<string> => {
    const tickers = new Set<string>();
    
    // Pattern 1: Name (TICKER $PRICE ±X.X%)
    const priceRegex = /\b[A-Z][a-z]+(?:\s[A-Z][a-z]+)?\s+\(([A-Z]{2,10})\s+\$[0-9,]+(?:\.\d{1,6})?\s+[+-][0-9]+\.?[0-9]*%\)/g;
    let match;
    while ((match = priceRegex.exec(text)) !== null) {
      tickers.add(match[1].toUpperCase());
    }
    
    // Pattern 2: Name (TICKER)
    const simpleTickerRegex = /\b[A-Za-z0-9\s&.-]+?\s+\(([A-Z0-9_]{2,12})\)(?=[^\w]|$)/g;
    while ((match = simpleTickerRegex.exec(text)) !== null) {
      tickers.add(match[1].toUpperCase());
    }
    
    return tickers;
  }, []);

  // Ref to track all tickers (content + DOM)
  const allTickersRef = React.useRef<Set<string>>(new Set());
  const tickerMappingRef = React.useRef<Map<string, string>>(new Map()); // displaySymbol -> livePricesKey

  // Format time ago helper
  const formatTimeAgo = (date: Date): string => {
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ago`;
  };

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
    
    // Use database mappings to determine routing
    const NON_ASSET = new Set(['CPI', 'GREED', 'NEUTRAL']);
    
    if (NON_ASSET.has(upperTicker)) {
      // Macro/sentiment keywords: do nothing
      return;
    }
    
    const mapping = getMapping(upperTicker);

    if (mapping) {
      if (mapping.type === 'crypto') {
        // Crypto → CoinGecko search
        window.open(`https://www.coingecko.com/en/search?query=${encodeURIComponent(upperTicker)}`,'_blank');
      } else {
        // Stocks → internal Markets page using TradingView symbol
        navigate(`/markets?symbol=${encodeURIComponent(mapping.tradingview_symbol)}`);
      }
      return;
    }
    
    // If not found in database mappings, default to CoinGecko as fallback
    console.warn(`⚠️ Unknown ticker "${upperTicker}" clicked - defaulting to CoinGecko search`);
    window.open(`https://www.coingecko.com/en/search?query=${encodeURIComponent(upperTicker)}`,'_blank');
  }, [navigate, getMapping]);

  // New handler for full asset mention clicks - opens TradingView charts
  const handleAssetClick = React.useCallback((event: React.MouseEvent, ticker: string) => {
    event.preventDefault();
    const upperTicker = ticker.toUpperCase();
    
    // Use database mappings to determine routing
    const NON_ASSET = new Set(['CPI', 'GREED', 'NEUTRAL']);
    if (NON_ASSET.has(upperTicker)) return;
    
    const mapping = getMapping(upperTicker);
    
    let chartUrl: string;
    
    if (mapping?.tradingview_symbol) {
      // Use the TradingView symbol from database for both crypto and stocks
      chartUrl = `https://www.tradingview.com/chart/?symbol=${mapping.tradingview_symbol}`;
    } else {
      // Fallback → TradingView general search
      chartUrl = `https://www.tradingview.com/symbols/${upperTicker}/`;
    }
    
    window.open(chartUrl, '_blank', 'noopener,noreferrer');
  }, [getMapping]);

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

    // FIRST: Convert pre-formatted price mentions to clickable links with live prices
    // Pattern: Name (TICKER $PRICE ±X.X%)
    // This must happen BEFORE price/percentage styling to avoid breaking the pattern
    const priceRegex = /\b([A-Z][a-z]+(?:\s[A-Z][a-z]+)?)\s+\(([A-Z]{2,10})\s+\$([0-9,]+(?:\.\d{1,6})?)\s+([+-][0-9]+\.?[0-9]*)%\)/g;
    enhancedText = enhancedText.replace(priceRegex, (fullMatch, name, ticker, price, change) => {
      const tickerUpper = ticker.toUpperCase();
      const originalPrice = parseFloat(price.replace(/,/g, ''));
      
      // Get live price data
      const liveData = livePrices.get(tickerUpper);
      
      // Build the base clickable link
      let linkContent = `${name} (<span class="inline-ticker">${ticker}</span> <span class="inline-price">$${price}</span> <span class="inline-change ${change.startsWith('-') ? 'negative' : 'positive'}">${change}%</span>`;
      
      // Add live price badge if available (always show when we have live data)
      if (liveData && liveData.price) {
        const change24h = liveData.change24h ?? 0;
        const isUp = change24h >= 0;
        
        const formatPrice = (p: number) => {
          if (p >= 1000) return p.toLocaleString('en-US', { maximumFractionDigits: 0 });
          if (p >= 1) return p.toLocaleString('en-US', { maximumFractionDigits: 2 });
          return p.toLocaleString('en-US', { maximumFractionDigits: 6 });
        };
        
        linkContent += ` <span class="live-price-separator">→</span> <span class="live-price-badge ${isUp ? 'price-up' : 'price-down'}">📊 <span class="live-price-value">$${formatPrice(liveData.price)}</span> <span class="live-change">${isUp ? '+' : ''}${change24h.toFixed(2)}%</span></span>`;
      }
      
      linkContent += ')';
      
      return `<a href="#" class="inline-crypto-link" data-ticker="${tickerUpper}" onclick="event.preventDefault(); window.handleAssetClick(event, '${tickerUpper}')">${linkContent}</a>`;
    });

    // Style standalone prices (e.g., $50,000, $1.25, $0.00045) - bold white
    enhancedText = enhancedText.replace(/\$([0-9,]+(?:\.[0-9]+)?)/g, 
      '<span class="price-badge">$$$1</span>');

    // Style standalone percentages (e.g., +5.2%, -3.1%) - will be colored by sign
    enhancedText = enhancedText.replace(/([+-]?)([0-9]+\.?[0-9]*)%/g, 
      '<span class="percentage-badge" data-sign="$1" data-value="$2">$1$2%</span>');

    // Sanitize HTML before DOM manipulation to prevent XSS attacks
    const sanitized = DOMPurify.sanitize(enhancedText, {
      ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'span', 'div', 'ul', 'ol', 'li', 'hr', 'a'],
      ALLOWED_ATTR: ['class', 'data-ticker', 'data-type', 'data-sign', 'data-value', 'data-quote-symbol', 'data-sym', 'style', 'href', 'onclick'],
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
            
            // Create clickable link wrapper for entire mention
            const linkWrapper = document.createElement('a');
            linkWrapper.href = '#';
            linkWrapper.className = 'asset-mention-link';
            linkWrapper.setAttribute('data-ticker', symbol);
            linkWrapper.setAttribute('onclick', `event.preventDefault(); window.handleAssetClick(event, '${symbol}')`);
            
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
            
            // Ticker symbol span (no longer needs click handler - parent link handles it)
            const tickerSpan = document.createElement('span');
            tickerSpan.className = 'sym-ticker';
            tickerSpan.textContent = symbol;
            
            // Closing paren (will be populated with price/change later)
            const closeParen = document.createTextNode(')');
            
            parenWrapper.appendChild(openParen);
            parenWrapper.appendChild(tickerSpan);
            parenWrapper.appendChild(closeParen);
            
            // Assemble: linkWrapper contains nameSpan + space + parenWrapper
            linkWrapper.appendChild(nameSpan);
            linkWrapper.appendChild(spaceText);
            linkWrapper.appendChild(parenWrapper);
            
            const parent = node.parentNode;
            if (parent) {
              // Insert in order: beforeText, linkWrapper, afterText
              if (afterText) {
                const afterNode = document.createTextNode(afterText);
                parent.insertBefore(afterNode, node.nextSibling);
              }
              parent.insertBefore(linkWrapper, node.nextSibling);
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

  const { html: enhancedHtml, tickers } = React.useMemo(() => processContent(cleanedContent), [cleanedContent, livePrices]);

  React.useEffect(() => {
    if (onTickersExtracted && tickers.length > 0) {
      const uniqueTickers = [...new Set(tickers)];
      onTickersExtracted(uniqueTickers);
    }
  }, [tickers.length]); // Only depend on length to avoid infinite loops

  // Update DOM prices when livePrices changes - makes prices truly "live"
  React.useEffect(() => {
    if (livePrices.size === 0) return;

    // 1. Update capability quotes (Name (TICKER) pattern)
    const nodes = document.querySelectorAll('.ticker-parentheses[data-quote-symbol]');
    nodes.forEach((el) => {
      const sym = el.getAttribute('data-quote-symbol');
      if (!sym) return;
      
      const data = livePrices.get(sym);
      if (!data) return;

      // Find or create price span
      let priceSpan = el.querySelector('.sym-price') as HTMLElement | null;
      if (!priceSpan) {
        priceSpan = document.createElement('span');
        priceSpan.className = 'sym-price';
        const closeParen = Array.from(el.childNodes).find(
          n => n.nodeType === Node.TEXT_NODE && n.textContent === ')'
        );
        if (closeParen) el.insertBefore(priceSpan, closeParen);
      }

      // Format and update price
      const formatPrice = (p: number) => {
        if (p >= 1000) return p.toLocaleString('en-US', { maximumFractionDigits: 0 });
        if (p >= 1) return p.toLocaleString('en-US', { maximumFractionDigits: 2 });
        return p.toLocaleString('en-US', { maximumFractionDigits: 6 });
      };
      priceSpan.textContent = ` $${formatPrice(data.price)}`;

      // Find or create change span
      let changeSpan = el.querySelector('.sym-change') as HTMLElement | null;
      if (!changeSpan) {
        changeSpan = document.createElement('span');
        const closeParen = Array.from(el.childNodes).find(
          n => n.nodeType === Node.TEXT_NODE && n.textContent === ')'
        );
        if (closeParen) el.insertBefore(changeSpan, closeParen);
      }

      // Update change with correct styling
      const isPositive = (data.change24h ?? 0) >= 0;
      changeSpan.className = `sym-change ${isPositive ? 'positive' : 'negative'}`;
      changeSpan.textContent = ` ${isPositive ? '+' : ''}${(data.change24h ?? 0).toFixed(2)}%`;
    });

    // 2. Update pre-formatted prices (Name (TICKER $PRICE ±X.X%) pattern)
    const inlineLinks = document.querySelectorAll('.inline-crypto-link[data-ticker]');
    inlineLinks.forEach((el) => {
      const ticker = el.getAttribute('data-ticker');
      if (!ticker) return;
      
      const data = livePrices.get(ticker);
      if (!data) return;

      // Update the inline-price span
      const priceSpan = el.querySelector('.inline-price') as HTMLElement | null;
      if (priceSpan) {
        const formatPrice = (p: number) => {
          if (p >= 1000) return p.toLocaleString('en-US', { maximumFractionDigits: 0 });
          if (p >= 1) return p.toLocaleString('en-US', { maximumFractionDigits: 2 });
          return p.toLocaleString('en-US', { maximumFractionDigits: 6 });
        };
        priceSpan.textContent = `$${formatPrice(data.price)}`;
      }

      // Update the inline-change span with 24h change from database
      const changeSpan = el.querySelector('.inline-change') as HTMLElement | null;
      if (changeSpan) {
        const isPositive = (data.change24h ?? 0) >= 0;
        changeSpan.className = `inline-change ${isPositive ? 'positive' : 'negative'}`;
        changeSpan.textContent = `${isPositive ? '+' : ''}${(data.change24h ?? 0).toFixed(2)}%`;
      }

      // Update the live price badge to also show 24h change
      const liveBadge = el.querySelector('.live-price-badge');
      if (liveBadge) {
        // Update the badge price value
        const livePriceValue = liveBadge.querySelector('.live-price-value');
        if (livePriceValue) {
          const formatPrice = (p: number) => {
            if (p >= 1000) return p.toLocaleString('en-US', { maximumFractionDigits: 0 });
            if (p >= 1) return p.toLocaleString('en-US', { maximumFractionDigits: 2 });
            return p.toLocaleString('en-US', { maximumFractionDigits: 6 });
          };
          livePriceValue.textContent = `$${formatPrice(data.price)}`;
          console.log(`✅ Updated ${ticker} badge to $${formatPrice(data.price)}`);
        }
        
        // Update the badge change percentage
        const liveChange = liveBadge.querySelector('.live-change');
        if (liveChange) {
          const isPositive = (data.change24h ?? 0) >= 0;
          liveChange.className = `live-change`;
          liveChange.textContent = `${isPositive ? '+' : ''}${(data.change24h ?? 0).toFixed(2)}%`;
        }
        
        // Update badge price styling
        const isPositive = (data.change24h ?? 0) >= 0;
        liveBadge.className = `live-price-badge ${isPositive ? 'price-up' : 'price-down'}`;
      }
    });
  }, [livePrices]);

  // Extract all tickers and scan DOM for additional ones
  React.useEffect(() => {
    const contentTickers = extractAllTickers(cleanedContent);
    
    // Scan DOM for additional tickers
    const domTickers = new Set<string>();
    document.querySelectorAll('.ticker-parentheses[data-quote-symbol]').forEach(el => {
      const sym = el.getAttribute('data-quote-symbol');
      if (sym) domTickers.add(sym.toUpperCase());
    });
    document.querySelectorAll('.inline-crypto-link[data-ticker]').forEach(el => {
      const sym = el.getAttribute('data-ticker');
      if (sym) domTickers.add(sym.toUpperCase());
    });
    
    // Merge all sources
    const merged = new Set([...contentTickers, ...domTickers]);
    allTickersRef.current = merged;
    
    console.log(`📊 Total tickers to track: ${merged.size}`, [...merged]);
  }, [cleanedContent, extractAllTickers, enhancedHtml]);

  // Resolve symbols to live_prices ticker keys and subscribe to Realtime
  React.useEffect(() => {
    const symbols = Array.from(allTickersRef.current);
    if (symbols.length === 0) return;
    
    let channel: any = null;
    
    const setupRealtimeSubscription = async () => {
      try {
        // Resolve symbols to polygon_ticker keys
        console.log('🔍 Resolving symbol mappings...');
        const { data: intelligenceData } = await supabase.functions.invoke('symbol-intelligence', {
          body: { symbols }
        });
        
        const resolved = intelligenceData?.symbols || [];
        const tickerKeys = new Set<string>();
        const mapping = new Map<string, string>();
        
        resolved.forEach((r: any) => {
          const displaySym = r.normalized.toUpperCase();
          // Use polygon_ticker for crypto, raw symbol for stocks
          const liveKey = r.polygon_ticker || displaySym;
          tickerKeys.add(liveKey);
          mapping.set(displaySym, liveKey);
        });
        
        tickerMappingRef.current = mapping;
        const keys = Array.from(tickerKeys);
        
        console.log(`🔴 LIVE: Subscribing to ${keys.length} tickers:`, keys);
        
        // Load initial snapshot from live_prices
        const { data: snapshot, error: snapError } = await supabase
          .from('live_prices')
          .select('ticker, price, change24h, updated_at')
          .in('ticker', keys);
        
        if (!snapError && snapshot) {
          const priceMap = new Map();
          snapshot.forEach(row => {
            // Map back to display symbols
            for (const [displaySym, liveKey] of mapping.entries()) {
              if (liveKey === row.ticker) {
                priceMap.set(displaySym, {
                  price: Number(row.price),
                  change24h: Number(row.change24h),
                  updated_at: row.updated_at
                });
              }
            }
          });
          setLivePrices(priceMap);
          setLastPriceUpdate(new Date());
          console.log(`📊 Loaded initial prices for ${snapshot.length} tickers`);
        }
        
        // Subscribe to Supabase Realtime
        channel = supabase
          .channel('brief-live-prices')
          .on('postgres_changes', {
            event: 'UPDATE',
            schema: 'public',
            table: 'live_prices',
            filter: `ticker=in.(${keys.join(',')})`
          }, (payload) => {
            const { ticker, price, change24h, updated_at } = payload.new;
            
            console.log(`💹 LIVE UPDATE: ${ticker} = $${price} (${change24h > 0 ? '+' : ''}${change24h}%)`);
            
            // Map back to display symbols
            setLivePrices(prev => {
              const next = new Map(prev);
              for (const [displaySym, liveKey] of mapping.entries()) {
                if (liveKey === ticker) {
                  next.set(displaySym, {
                    price: Number(price),
                    change24h: Number(change24h ?? 0),
                    updated_at: updated_at
                  });
                }
              }
              return next;
            });
            
            setLastPriceUpdate(new Date());
          })
          .subscribe((status) => {
            console.log('🔴 Realtime status:', status);
          });
        
      } catch (error) {
        console.error('❌ Error setting up realtime subscription:', error);
      }
    };
    
    setupRealtimeSubscription();
    
    return () => {
      if (channel) {
        console.log('🛑 Unsubscribing from live prices');
        supabase.removeChannel(channel);
      }
    };
  }, [allTickersRef.current.size]);

  // Watchdog: manual snapshot if no updates for 20s
  React.useEffect(() => {
    const watchdogInterval = setInterval(async () => {
      const now = Date.now();
      const lastUpdate = lastPriceUpdate?.getTime() ?? 0;
      const staleness = now - lastUpdate;
      
      if (staleness > 20000 && allTickersRef.current.size > 0) {
        console.log('⚠️ No realtime updates for 20s, fetching snapshot from live_prices');
        
        const keys = Array.from(tickerMappingRef.current.values());
        const { data: snapshot } = await supabase
          .from('live_prices')
          .select('ticker, price, change24h, updated_at')
          .in('ticker', keys);
        
        if (snapshot) {
          const priceMap = new Map();
          snapshot.forEach(row => {
            for (const [displaySym, liveKey] of tickerMappingRef.current.entries()) {
              if (liveKey === row.ticker) {
                priceMap.set(displaySym, {
                  price: Number(row.price),
                  change24h: Number(row.change24h),
                  updated_at: row.updated_at
                });
              }
            }
          });
          setLivePrices(priceMap);
          setLastPriceUpdate(new Date());
          console.log(`📊 Watchdog: Loaded ${snapshot.length} prices`);
        }
      }
    }, 20000);
    
    return () => clearInterval(watchdogInterval);
  }, [lastPriceUpdate]);

  React.useEffect(() => {
    // Add global click handlers
    (window as any).handleTickerClick = handleTickerClick;
    (window as any).handleAssetClick = handleAssetClick;
    
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
      {lastPriceUpdate && livePrices.size > 0 && (
        <div className="text-xs text-muted-foreground mb-4 pb-3 border-b border-border/30 flex items-center justify-between">
          <span className="flex items-center gap-2">
            💰 Live prices updated {formatTimeAgo(lastPriceUpdate)}
          </span>
          {priceLoading && <span className="animate-pulse">Refreshing...</span>}
        </div>
      )}
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
        
        /* Asset mention link - wraps entire mention */
        .asset-mention-link {
          display: inline;
          text-decoration: none;
          color: inherit;
          transition: all 0.2s ease;
          border-radius: 4px;
          padding: 0 2px;
          position: relative;
        }
        .asset-mention-link:hover {
          background-color: hsl(var(--primary) / 0.1);
          text-decoration: underline;
          text-decoration-color: hsl(var(--primary));
          text-decoration-thickness: 2px;
          text-underline-offset: 2px;
        }
        .asset-mention-link:hover .sym-name {
          color: hsl(var(--primary));
        }
        .asset-mention-link::after {
          content: " ↗";
          font-size: 0.75rem;
          opacity: 0;
          transition: opacity 0.2s;
          color: hsl(var(--primary));
          margin-left: 2px;
        }
        .asset-mention-link:hover::after {
          opacity: 0.7;
        }
        
        /* Inline crypto link - for pre-formatted price mentions */
        .inline-crypto-link {
          display: inline;
          color: inherit;
          text-decoration: none;
          border-bottom: 1px dashed hsl(var(--primary) / 0.4);
          transition: all 0.2s ease;
          cursor: pointer;
          padding: 0 1px;
        }
        .inline-crypto-link:hover {
          color: hsl(var(--primary));
          border-bottom: 2px solid hsl(var(--primary));
          text-decoration: none;
        }
        .inline-crypto-link::after {
          content: " 📊";
          font-size: 0.85rem;
          opacity: 0;
          transition: opacity 0.2s;
          margin-left: 2px;
        }
        .inline-crypto-link:hover::after {
          opacity: 1;
        }
        
        /* Components inside inline links */
        .inline-ticker {
          color: hsl(var(--primary));
          font-weight: 700;
        }
        .inline-price {
          color: hsl(var(--foreground));
          font-weight: 600;
        }
        .inline-change {
          font-weight: 700;
        }
        .inline-change.positive {
          color: #10b981;
        }
        .inline-change.negative {
          color: #ef4444;
        }
        
        /* Live price separator */
        .live-price-separator {
          display: inline;
          color: hsl(var(--muted-foreground) / 0.5);
          font-weight: 400;
          margin: 0 4px;
          font-size: 0.9rem;
        }

        /* Live price badge - shows current real-time price */
        .live-price-badge {
          display: inline-block;
          padding: 2px 8px;
          border-radius: 4px;
          font-weight: 600;
          font-size: 0.9rem;
          margin-left: 2px;
          transition: all 0.3s ease;
          animation: priceUpdate 0.5s ease;
        }

        @keyframes priceUpdate {
          0% { opacity: 0.5; transform: scale(0.95); }
          100% { opacity: 1; transform: scale(1); }
        }

        .live-price-badge.price-up {
          background-color: rgba(34, 197, 94, 0.15);
          color: #10b981;
          border: 1px solid rgba(34, 197, 94, 0.3);
        }

        .live-price-badge.price-down {
          background-color: rgba(239, 68, 68, 0.15);
          color: #ef4444;
          border: 1px solid rgba(239, 68, 68, 0.3);
        }

        .live-change {
          font-weight: 700;
          margin-left: 4px;
        }

        /* Dim original price slightly when live price is shown */
        .inline-crypto-link:has(.live-price-badge) .inline-price,
        .inline-crypto-link:has(.live-price-badge) .inline-change {
          opacity: 0.7;
          font-size: 0.85rem;
        }

        /* Make live badge more prominent on hover */
        .inline-crypto-link:hover .live-price-badge {
          transform: scale(1.05);
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
        }
        
        /* Ticker Symbol - no longer individually clickable, parent link handles it */
        .sym-ticker {
          display: inline;
          color: hsl(var(--primary));
          font-weight: 700;
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