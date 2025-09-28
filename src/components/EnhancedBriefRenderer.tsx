import React from 'react';
import { useNavigate } from 'react-router-dom';

interface EnhancedBriefRendererProps {
  content: string;
}

export function EnhancedBriefRenderer({ content }: EnhancedBriefRendererProps) {
  const navigate = useNavigate();

  const handleTickerClick = (ticker: string) => {
    navigate(`/crypto?symbol=${ticker.toUpperCase()}`);
  };

  const enhanceContent = (text: string) => {
    // Common crypto symbols and their full names
    const cryptoPatterns = [
      { symbol: 'BTC', name: 'Bitcoin' },
      { symbol: 'ETH', name: 'Ethereum' },
      { symbol: 'SOL', name: 'Solana' },
      { symbol: 'ADA', name: 'Cardano' },
      { symbol: 'DOT', name: 'Polkadot' },
      { symbol: 'MATIC', name: 'Polygon' },
      { symbol: 'AVAX', name: 'Avalanche' },
      { symbol: 'LINK', name: 'Chainlink' },
      { symbol: 'UNI', name: 'Uniswap' },
      { symbol: 'LTC', name: 'Litecoin' },
      { symbol: 'XRP', name: 'Ripple' },
      { symbol: 'DOGE', name: 'Dogecoin' },
    ];

    let enhancedText = text;

    // Enhanced typography and styling
    enhancedText = enhancedText.replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold text-foreground">$1</strong>')
      .replace(/\n\n+/g, '</p><p class="mb-4 leading-relaxed text-foreground/90">')
      .replace(/\n/g, '<br/>');

    // Style prices (e.g., $50,000, $1.25, $0.00045)
    enhancedText = enhancedText.replace(/\$([0-9,]+(?:\.[0-9]+)?)/g, 
      '<span class="font-semibold text-green-400 bg-green-400/10 px-1.5 py-0.5 rounded text-sm">$$$1</span>');

    // Style percentages (e.g., +5.2%, -3.1%)
    enhancedText = enhancedText.replace(/([+-]?)([0-9]+\.?[0-9]*)%/g, 
      '<span class="font-semibold px-1.5 py-0.5 rounded text-sm $1" data-change="$1">$1$2%</span>');

    // Replace crypto symbols and names with clickable links
    cryptoPatterns.forEach(({ symbol, name}) => {
      // Match symbol patterns (BTC, Bitcoin, etc.)
      const symbolRegex = new RegExp(`\\b(${symbol})\\b`, 'gi');
      const nameRegex = new RegExp(`\\b(${name})\\b`, 'gi');
      
      enhancedText = enhancedText.replace(symbolRegex, 
        `<button onclick="window.handleTickerClick('${symbol}')" class="ticker-link font-bold text-primary hover:text-primary/80 hover:bg-primary/10 px-1.5 py-0.5 rounded transition-all duration-200 cursor-pointer border border-primary/20 bg-primary/5 text-sm">$1</button>`);
      
      enhancedText = enhancedText.replace(nameRegex, 
        `<button onclick="window.handleTickerClick('${symbol}')" class="ticker-link font-semibold text-primary hover:text-primary/80 hover:bg-primary/10 px-1 py-0.5 rounded transition-all duration-200 cursor-pointer underline underline-offset-2 decoration-primary/50">$1</button>`);
    });

    return enhancedText;
  };

  React.useEffect(() => {
    // Add global click handler for ticker buttons
    (window as any).handleTickerClick = handleTickerClick;
    
    // Style percentage elements based on positive/negative values
    const percentageElements = document.querySelectorAll('[data-change]');
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

  const processedContent = `<p class="mb-4 leading-relaxed text-foreground/90">${enhanceContent(content)}</p>`;

  return (
    <div className="enhanced-brief font-medium text-base leading-7 space-y-4">
      <style>{`
        .enhanced-brief {
          font-family: system-ui, -apple-system, 'Segoe UI', 'Roboto', sans-serif;
          line-height: 1.7;
        }
        .enhanced-brief p {
          margin-bottom: 1rem;
        }
        .enhanced-brief strong {
          font-weight: 600;
        }
        .ticker-link:hover {
          transform: translateY(-1px);
          box-shadow: 0 2px 8px rgba(139, 92, 246, 0.2);
        }
      `}</style>
      <div dangerouslySetInnerHTML={{ __html: processedContent }} />
    </div>
  );
}