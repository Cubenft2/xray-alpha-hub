import React, { useEffect, useRef } from 'react';

interface CryptoChartProps {
  symbol?: string;
  height?: number;
}

export function CryptoChart({ symbol = 'BITSTAMP:BTCUSD', height = 400 }: CryptoChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Clear any existing widget
    containerRef.current.innerHTML = '';

    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
    script.async = true;

    const config = {
      autosize: true,
      symbol: symbol,
      interval: 'D',
      timezone: 'Etc/UTC',
      theme: document.documentElement.classList.contains('dark') ? 'dark' : 'light',
      style: '1',
      locale: 'en',
      toolbar_bg: '#f1f3f6',
      enable_publishing: false,
      allow_symbol_change: true,
      container_id: 'tradingview_chart',
      height: height,
      studies: ['STD;SMA']
    };

    script.innerHTML = JSON.stringify(config);
    containerRef.current.appendChild(script);

    return () => {
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
    };
  }, [symbol, height]);

  return (
    <div className="xr-card p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">
          {symbol.includes('BTC') ? '📊 Bitcoin Chart' : '📈 Advanced Chart'}
        </h2>
        <span className="text-sm text-muted-foreground">
          TradingView
        </span>
      </div>
      <div 
        ref={containerRef} 
        className="tradingview-widget-container rounded-lg overflow-hidden"
        style={{ height: `${height}px` }}
      >
        <div className="tradingview-widget-container__widget"></div>
      </div>
    </div>
  );
}