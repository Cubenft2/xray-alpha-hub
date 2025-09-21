import React, { useEffect, useRef } from 'react';

export function CryptoScreener() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Clear any existing widget
    containerRef.current.innerHTML = '';

    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-screener.js';
    script.async = true;

    const config = {
      width: '100%',
      height: '500',
      defaultColumn: 'overview',
      defaultScreen: 'crypto_mkt_cap_large',
      market: 'crypto',
      showToolbar: true,
      colorTheme: document.documentElement.classList.contains('dark') ? 'dark' : 'light',
      locale: 'en',
      isTransparent: false
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
          🚀 Crypto Screener
        </h2>
        <span className="text-sm text-muted-foreground">
          Live Market Data
        </span>
      </div>
      <div ref={containerRef} className="tradingview-widget-container rounded-lg overflow-hidden">
        <div className="tradingview-widget-container__widget"></div>
      </div>
    </div>
  );
}