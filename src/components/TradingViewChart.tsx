import React, { useEffect, useRef } from 'react';
import { useTheme } from 'next-themes';

interface TradingViewChartProps {
  symbol?: string;
  height?: string;
  interval?: string;
  style?: string;
  hideTopToolbar?: boolean;
  hideSideToolbar?: boolean;
  allowSymbolChange?: boolean;
  studies?: string[];
  className?: string;
}

export function TradingViewChart({
  symbol = "NASDAQ:AAPL",
  height = "400px",
  interval = "D",
  style = "1",
  hideTopToolbar = false,
  hideSideToolbar = false,
  allowSymbolChange = true,
  studies = [],
  className = ""
}: TradingViewChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { theme } = useTheme();

  useEffect(() => {
    if (!containerRef.current) return;

    // Clear previous widget
    containerRef.current.innerHTML = '';

    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
    script.async = true;
    
    const config = {
      allow_symbol_change: allowSymbolChange,
      calendar: false,
      details: true,
      hide_side_toolbar: hideSideToolbar,
      hide_top_toolbar: hideTopToolbar,
      hide_legend: false,
      hide_volume: false,
      hotlist: true,
      interval: interval,
      locale: "en",
      save_image: true,
      style: style,
      symbol: symbol,
      theme: theme === 'dark' ? 'dark' : 'light',
      timezone: "Etc/UTC",
      backgroundColor: theme === 'dark' ? 'hsl(var(--background))' : '#ffffff',
      gridColor: theme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(46, 46, 46, 0.06)',
      watchlist: [],
      withdateranges: true,
      compareSymbols: [],
      show_popup_button: true,
      popup_height: "650",
      popup_width: "1000",
      studies: studies,
      autosize: true
    };

    script.innerHTML = JSON.stringify(config);

    // Create widget container structure
    const widgetContainer = document.createElement('div');
    widgetContainer.className = 'tradingview-widget-container';
    widgetContainer.style.height = '100%';
    widgetContainer.style.width = '100%';

    const widgetDiv = document.createElement('div');
    widgetDiv.className = 'tradingview-widget-container__widget';
    widgetDiv.style.height = 'calc(100% - 32px)';
    widgetDiv.style.width = '100%';

    const copyrightDiv = document.createElement('div');
    copyrightDiv.className = 'tradingview-widget-copyright';
    copyrightDiv.innerHTML = `<a href="https://www.tradingview.com/" rel="noopener nofollow" target="_blank"><span class="blue-text">Track all markets</span></a><span class="trademark"> on TradingView</span>`;

    widgetContainer.appendChild(widgetDiv);
    widgetContainer.appendChild(copyrightDiv);
    widgetContainer.appendChild(script);

    containerRef.current.appendChild(widgetContainer);

    return () => {
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
    };
  }, [symbol, theme, interval, style, hideTopToolbar, hideSideToolbar, allowSymbolChange, studies]);

  return (
    <div 
      ref={containerRef} 
      className={`tradingview-chart-container ${className}`}
      style={{ height, width: '100%' }}
    />
  );
}