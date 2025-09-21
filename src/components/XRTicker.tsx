import React, { useEffect, useRef } from 'react';
import { useTheme } from 'next-themes';

interface XRTickerProps {
  type: 'crypto' | 'stocks';
  symbols?: string;
}

export function XRTicker({ type, symbols }: XRTickerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { theme } = useTheme();

  const defaultSymbols = {
    crypto: 'BITSTAMP:BTCUSD,BINANCE:ETHUSD,BINANCE:SOLUSD,BINANCE:DOGEUSDT,BITSTAMP:XRPUSD,BINANCE:ADAUSDT,BINANCE:AVAXUSDT,BINANCE:SHIBUSDT,BINANCE:BONKUSDT',
    stocks: 'AMEX:SPY,NASDAQ:QQQ,NASDAQ:NVDA,NASDAQ:TSLA,NASDAQ:COIN,NASDAQ:MSTR,NASDAQ:AAPL,NASDAQ:MSFT'
  };

  useEffect(() => {
    if (!containerRef.current) return;

    // Clear any existing widget
    containerRef.current.innerHTML = '';

    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-ticker-tape.js';
    script.async = true;

    const config = {
      symbols: [
        ...(symbols || defaultSymbols[type]).split(',').map(symbol => ({
          proName: symbol.trim(),
          title: symbol.trim().split(':')[1] || symbol.trim()
        }))
      ],
      showSymbolLogo: true,
      colorTheme: theme === 'dark' ? 'dark' : 'light',
      isTransparent: false,
      displayMode: 'adaptive',
      locale: 'en'
    };

    script.innerHTML = JSON.stringify(config);
    containerRef.current.appendChild(script);

    return () => {
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
    };
  }, [type, symbols, theme]);

  return (
    <div className="xr-ticker">
      <div ref={containerRef} className="tradingview-widget-container">
        <div className="tradingview-widget-container__widget"></div>
      </div>
    </div>
  );
}