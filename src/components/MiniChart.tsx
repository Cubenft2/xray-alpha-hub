import React, { useEffect, useRef, lazy, Suspense } from 'react';

const FallbackSparkline = lazy(() => import('./FallbackSparkline').then(module => ({ default: module.FallbackSparkline })));

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
  const [widgetLoadFailed, setWidgetLoadFailed] = React.useState(false);

  useEffect(() => {
    if (!containerRef.current || !tvOk) return;

    setWidgetLoadFailed(false);
    
    // Clear previous widget
    containerRef.current.innerHTML = '';

    // Set 8-second timeout for widget load
    const loadTimeout = setTimeout(() => {
      console.warn(`TradingView widget timeout for ${symbol}`);
      setWidgetLoadFailed(true);
    }, 8000);

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

    // Clear timeout if widget loads successfully
    script.onload = () => {
      clearTimeout(loadTimeout);
    };

    return () => {
      clearTimeout(loadTimeout);
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
      if (onClick) {
        widgetContainer.removeEventListener('click', onClick);
      }
    };
  }, [symbol, theme, onClick]);

  // Show fallback if widget failed to load and fallback is available
  if (widgetLoadFailed && showFallback && (coingeckoId || polygonTicker)) {
    return (
      <div style={{ height: '100%', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '8px' }}>
        <Suspense fallback={<div className="text-sm text-muted-foreground">Loading chart...</div>}>
          <FallbackSparkline 
            symbol={symbol}
            coingeckoId={coingeckoId}
            polygonTicker={polygonTicker}
            timespan="7D"
            className="w-full"
          />
        </Suspense>
      </div>
    );
  }

  if (!tvOk) {
    // Show fallback sparkline if data sources are available
    if (showFallback && (coingeckoId || polygonTicker)) {
      return (
        <div style={{ height: '100%', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '8px' }}>
          <Suspense fallback={<div className="text-sm text-muted-foreground">Loading chart...</div>}>
            <FallbackSparkline 
              symbol={symbol}
              coingeckoId={coingeckoId}
              polygonTicker={polygonTicker}
              timespan="7D"
              className="w-full"
            />
          </Suspense>
        </div>
      );
    }
    
    return (
      <div style={{ height: '100%', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.5 }}>
        <p className="text-sm text-muted-foreground">Chart not available</p>
      </div>
    );
  }

  return <div ref={containerRef} style={{ height: '100%', width: '100%' }} />;
}