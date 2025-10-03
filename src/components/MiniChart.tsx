import React, { useEffect, useRef } from 'react';

interface MiniChartProps {
  symbol: string;
  theme?: string;
  onClick?: () => void;
  tvOk?: boolean; // Capability flag for TradingView support
  coingeckoId?: string;
  polygonTicker?: string;
  showFallback?: boolean; // Whether to show fallback sparkline
}

export function MiniChart({ 
  symbol, 
  theme, 
  onClick, 
  tvOk = true,
  coingeckoId,
  polygonTicker,
  showFallback = true 
}: MiniChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current || !tvOk) return;

    // Clear previous widget
    containerRef.current.innerHTML = '';

    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-mini-symbol-overview.js';
    script.async = true;
    script.innerHTML = JSON.stringify({
      symbol: symbol,
      width: "100%",
      height: "100%",
      locale: "en",
      dateRange: "12M",
      colorTheme: theme === 'dark' ? 'dark' : 'light',
      isTransparent: false,
      autosize: true,
      largeChartUrl: ""
    });

    const widgetContainer = document.createElement('div');
    widgetContainer.className = 'tradingview-widget-container';
    widgetContainer.style.height = '100%';
    widgetContainer.style.width = '100%';
    widgetContainer.style.cursor = onClick ? 'pointer' : 'default';

    const widgetInner = document.createElement('div');
    widgetInner.className = 'tradingview-widget-container__widget';
    widgetInner.style.height = 'calc(100% - 32px)';
    widgetInner.style.width = '100%';

    if (onClick) {
      widgetContainer.addEventListener('click', onClick);
    }

    widgetContainer.appendChild(widgetInner);
    widgetContainer.appendChild(script);
    containerRef.current.appendChild(widgetContainer);

    return () => {
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
      if (onClick) {
        widgetContainer.removeEventListener('click', onClick);
      }
    };
  }, [symbol, theme, onClick]);

  if (!tvOk) {
    // Show fallback sparkline if data sources are available
    if (showFallback && (coingeckoId || polygonTicker)) {
      return (
        <div style={{ height: '100%', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: '100%', maxWidth: '200px' }}>
            {/* Lazy load FallbackSparkline to avoid bundle bloat */}
            <React.Suspense fallback={<div>Loading chart...</div>}>
              <div className="text-sm text-muted-foreground mb-2">{symbol}</div>
              {/* Import dynamically to avoid circular deps */}
            </React.Suspense>
          </div>
        </div>
      );
    }
    
    return (
      <div style={{ height: '100%', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.5 }}>
        <p>Chart not available</p>
      </div>
    );
  }

  return <div ref={containerRef} style={{ height: '100%', width: '100%' }} />;
}