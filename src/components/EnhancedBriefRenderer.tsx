import React from 'react';
import { useNavigate } from 'react-router-dom';

interface EnhancedBriefRendererProps {
  content: string;
  enhancedTickers?: {[key: string]: any};
}

export function EnhancedBriefRenderer({ content, enhancedTickers = {} }: EnhancedBriefRendererProps) {
  const navigate = useNavigate();

  const handleTickerClick = (ticker: string) => {
    navigate(`/crypto?symbol=${ticker.toUpperCase()}`);
  };

  const enhanceContent = (text: string) => {
    let enhancedText = text;

    // Enhanced typography and styling
    enhancedText = enhancedText.replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
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
    const tickerRegex = /([A-Za-z0-9\s&.-]+)\s*\(([A-Z0-9]{2,10})\)/g;
    enhancedText = enhancedText.replace(tickerRegex, (match, name, symbol) => {
      const tickerData = enhancedTickers[symbol.toUpperCase()];
      const displayName = name.trim();
      
      if (tickerData && tickerData.price) {
        // Show ticker with live price data
        const price = tickerData.price < 0.01 ? tickerData.price.toFixed(6) : 
                     tickerData.price < 1 ? tickerData.price.toFixed(4) : 
                     tickerData.price.toLocaleString();
        const changeClass = tickerData.change_24h >= 0 ? 'text-green-400 border-green-400/20 bg-green-400/10' : 'text-red-400 border-red-400/20 bg-red-400/10';
        const changeSign = tickerData.change_24h >= 0 ? '+' : '';
        
        return `<button onclick="window.handleTickerClick('${symbol}')" class="ticker-link-enhanced font-bold ${changeClass} hover:opacity-80 px-2 py-1 rounded transition-all duration-200 cursor-pointer border text-sm inline-flex items-center gap-1">
          <span>${displayName}</span>
          <span class="font-mono text-xs">(${symbol})</span>
          <span class="font-mono text-xs">$${price}</span>
          <span class="font-mono text-xs">${changeSign}${tickerData.change_24h.toFixed(2)}%</span>
        </button>`;
      } else {
        // Show basic ticker button for crypto/stocks without price data
        return `<button onclick="window.handleTickerClick('${symbol}')" class="ticker-link font-bold text-primary hover:text-primary/80 hover:bg-primary/10 px-1.5 py-0.5 rounded transition-all duration-200 cursor-pointer border border-primary/20 bg-primary/5 text-sm">
          ${displayName} (${symbol})
        </button>`;
      }
    });

    return enhancedText;
  };

  React.useEffect(() => {
    // Add global click handler for ticker buttons
    (window as any).handleTickerClick = handleTickerClick;
    
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
  }, [handleTickerClick]);

  const processedContent = `<div class="space-y-6"><p class="mb-6 leading-relaxed text-foreground/90">${enhanceContent(content)}</p></div>`;

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