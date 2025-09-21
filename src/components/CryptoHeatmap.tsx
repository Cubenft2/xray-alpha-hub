import React, { useEffect, useRef } from 'react';

export function CryptoHeatmap() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Clear any existing widget
    containerRef.current.innerHTML = '';

    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-crypto-coins-heatmap.js';
    script.async = true;

    const config = {
      dataSource: 'Crypto',
      blockSize: 'market_cap_calc',
      blockColor: 'change',
      locale: 'en',
      symbolUrl: '',
      colorTheme: document.documentElement.classList.contains('dark') ? 'dark' : 'light',
      hasTopBar: false,
      isDataSetEnabled: false,
      isZoomEnabled: true,
      hasSymbolTooltip: true,
      width: '100%',
      height: '400'
    };

    script.innerHTML = JSON.stringify(config);
    containerRef.current.appendChild(script);

    return () => {
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
    };
  }, []);

  return (
    <div className="xr-card p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">
          🔥 Crypto Heatmap
        </h2>
        <span className="text-sm text-muted-foreground">
          Market Cap & 24h Change
        </span>
      </div>
      <div ref={containerRef} className="tradingview-widget-container rounded-lg overflow-hidden">
        <div className="tradingview-widget-container__widget"></div>
      </div>
    </div>
  );
}