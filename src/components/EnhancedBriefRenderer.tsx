import React from 'react';
import { useNavigate } from 'react-router-dom';

interface EnhancedBriefRendererProps {
  content: string;
  enhancedTickers?: {[key: string]: any};
  onTickersExtracted?: (tickers: string[]) => void;
}

export function EnhancedBriefRenderer({ content, enhancedTickers = {}, onTickersExtracted }: EnhancedBriefRendererProps) {
  const navigate = useNavigate();

  const handleTickerClick = React.useCallback((ticker: string) => {
    const upperTicker = ticker.toUpperCase();
    
    // Tickers that should redirect to CoinGecko search
    const coingeckoRedirect = new Set([
      'FIGR_HELOC',
      'FIGR',
    ]);
    
    if (coingeckoRedirect.has(upperTicker)) {
      window.open(`https://www.coingecko.com/en/search?query=${encodeURIComponent(upperTicker)}`,'_blank');
      return;
    }
    
    // Known stock tickers - route to Markets page
    const stockTickers = new Set([
      'MNPR', 'AAPL', 'GOOGL', 'MSFT', 'AMZN', 'TSLA', 'NVDA', 'META',
      'NFLX', 'AMD', 'INTC', 'COIN', 'MSTR', 'HOOD', 'SQ', 'PYPL'
    ]);
    
    if (stockTickers.has(upperTicker)) {
      // Route to Markets page with NASDAQ prefix for stocks
      navigate(`/markets?symbol=NASDAQ:${upperTicker}`);
      return;
    }
    
    // Crypto mappings
    const cryptoMappings: { [key: string]: string } = {
      'BTC': 'BINANCE:BTCUSDT',
      'BITCOIN': 'BINANCE:BTCUSDT',
      'ETH': 'BINANCE:ETHUSDT', 
      'ETHEREUM': 'BINANCE:ETHUSDT',
      'SOL': 'BINANCE:SOLUSDT',
      'SOLANA': 'BINANCE:SOLUSDT',
      'ADA': 'BINANCE:ADAUSDT',
      'CARDANO': 'BINANCE:ADAUSDT',
      'AVAX': 'BINANCE:AVAXUSDT',
      'AVALANCHE': 'BINANCE:AVAXUSDT',
      'DOT': 'BINANCE:DOTUSDT',
      'POLKADOT': 'BINANCE:DOTUSDT',
      'MATIC': 'BINANCE:MATICUSDT',
      'POLYGON': 'BINANCE:MATICUSDT',
      'LINK': 'BINANCE:LINKUSDT',
      'CHAINLINK': 'BINANCE:LINKUSDT',
      'UNI': 'BINANCE:UNIUSDT',
      'UNISWAP': 'BINANCE:UNIUSDT',
      'XRP': 'BINANCE:XRPUSDT',
      'RIPPLE': 'BINANCE:XRPUSDT',
      'DOGE': 'BINANCE:DOGEUSDT',
      'DOGECOIN': 'BINANCE:DOGEUSDT',
      'ASTER': 'BINANCE:ASTERUSDT',
      'HYPE': 'BINANCE:HYPEUSDT',
      'HYPERLIQUID': 'BINANCE:HYPEUSDT',
      'SUI': 'BINANCE:SUIUSDT',
      'BNB': 'BINANCE:BNBUSDT',
      'WBTC': 'BINANCE:WBTCUSDT',
      'USDE': 'BINANCE:USDEUSDT',
      'TRX': 'BINANCE:TRXUSDT',
      'TRON': 'BINANCE:TRXUSDT',
      // Index mappings
      'SPX': 'SP:SPX',
      'DXY': 'TVC:DXY',
      'XAUUSD': 'OANDA:XAUUSD',
      'GOLD': 'OANDA:XAUUSD'
    };
    
    const tradingViewSymbol = cryptoMappings[upperTicker] || `BINANCE:${upperTicker}USDT`;
    navigate(`/crypto?symbol=${tradingViewSymbol}`);
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
    const tickerRegex = /([A-Za-z0-9\s&.-]+)\s*\(([A-Z0-9_]{2,12})\)/g;
    const extractedTickers: string[] = [];
    
    enhancedText = enhancedText.replace(tickerRegex, (match, name, symbol) => {
      extractedTickers.push(symbol.toUpperCase());
      const displayName = name.trim();
      const upperSymbol = symbol.toUpperCase();
      
      // Create ticker span that will be updated by InlineQuote system
      return `${displayName} <span 
        class="ticker-quote-inline font-semibold cursor-pointer hover:opacity-80 transition-opacity" 
        data-quote-symbol="${upperSymbol}" 
        onclick="window.handleTickerClick('${symbol}')"
        style="color: inherit;">
        (${upperSymbol} ...)
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
    
    // Initialize inline quotes after DOM is ready
    const initQuotes = async () => {
      // Import and initialize quotes system
      const { initializeInlineQuotes } = await import('./InlineQuote');
      setTimeout(() => initializeInlineQuotes(), 100); // Small delay to ensure DOM is ready
    };
    
    if (tickers.length > 0) {
      initQuotes();
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