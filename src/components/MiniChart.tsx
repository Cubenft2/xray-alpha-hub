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
  assetType?: 'crypto' | 'stock' | 'index' | 'forex'; // Asset type for smart defaults
  assetClassification?: { // Most authoritative classification from brief data
    type: string;
    tradingview_symbol?: string;
    is_crypto?: boolean;
  };
}

export function MiniChart({ 
  symbol, 
  theme, 
  onClick, 
  tvOk = true,
  coingeckoId,
  polygonTicker,
  showFallback = true,
  assetType,
  assetClassification
}: MiniChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [widgetLoadFailed, setWidgetLoadFailed] = React.useState(false);

  // Smart symbol formatting: add exchange prefix if missing
  const formatTradingViewSymbol = (rawSymbol: string): string => {
    // If symbol already has an exchange prefix (contains ":"), use as-is
    if (rawSymbol.includes(':')) {
      return rawSymbol;
    }

    // PRIORITY 1: Use classification from brief data (most authoritative)
    if (assetClassification?.tradingview_symbol) {
      console.log(`🏷️ Using brief classification for ${rawSymbol}: ${assetClassification.tradingview_symbol}`);
      return assetClassification.tradingview_symbol;
    }

    // PRIORITY 2: Detect crypto by coingecko_id, X: prefix, or is_crypto flag
    if (assetClassification?.is_crypto || coingeckoId || polygonTicker?.startsWith('X:') || assetType === 'crypto') {
      const cryptoSymbol = rawSymbol.endsWith('USD') ? rawSymbol : `${rawSymbol}USD`;
      console.log(`💎 Crypto detected for ${rawSymbol}: ${cryptoSymbol}`);
      return cryptoSymbol;
    }

    // PRIORITY 3: Stock - add NASDAQ prefix
    if (assetType === 'stock' || assetClassification?.type === 'stock') {
      console.log(`📊 Stock detected for ${rawSymbol}: NASDAQ:${rawSymbol}`);
      return `NASDAQ:${rawSymbol}`;
    }

    // PRIORITY 4: Default to crypto if no clear classification
    const defaultSymbol = rawSymbol.endsWith('USD') ? rawSymbol : `${rawSymbol}USD`;
    console.log(`❓ No classification for ${rawSymbol}, defaulting to crypto: ${defaultSymbol}`);
    return defaultSymbol;
  };

  const formattedSymbol = formatTradingViewSymbol(symbol);

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

    console.log(`📈 Loading TradingView chart for ${formattedSymbol} (original: ${symbol})`);

    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-mini-symbol-overview.js';
    script.async = true;
    script.innerHTML = JSON.stringify({
      symbol: formattedSymbol,
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
      console.log(`✅ TradingView widget loaded for ${formattedSymbol}`);
    };

    script.onerror = () => {
      clearTimeout(loadTimeout);
      console.error(`❌ TradingView widget failed to load for ${formattedSymbol}`);
      setWidgetLoadFailed(true);
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
  }, [formattedSymbol, theme, onClick]);

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