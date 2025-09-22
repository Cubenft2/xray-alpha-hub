import React, { useEffect, useRef, useState } from 'react';
import { useTheme } from 'next-themes';
import { Skeleton } from '@/components/ui/skeleton';

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
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!containerRef.current) return;

    setIsLoading(true);
    
    // Clear previous widget
    containerRef.current.innerHTML = '';

    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
    script.async = true;
    
    // Simplified, valid configuration
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
      watchlist: [],
      withdateranges: true,
      studies: studies,
      autosize: true,
      enable_publishing: true,
      show_popup_button: true,
      popup_height: "650",
      popup_width: "1000"
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

    // Add load event listener to hide loading
    script.onload = () => {
      setTimeout(() => setIsLoading(false), 1000); // Give widget time to render
    };
    
    script.onerror = () => {
      setIsLoading(false);
      console.error('TradingView widget failed to load');
    };

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
    <div className={`relative ${className}`} style={{ height, width: '100%' }}>
      {isLoading && (
        <div className="absolute inset-0 z-10 bg-background/50 backdrop-blur-sm flex items-center justify-center">
          <div className="space-y-4 w-full max-w-md px-4">
            <Skeleton className="h-8 w-3/4 mx-auto" />
            <Skeleton className="h-64 w-full" />
            <div className="flex space-x-2">
              <Skeleton className="h-10 w-20" />
              <Skeleton className="h-10 w-20" />
              <Skeleton className="h-10 w-20" />
            </div>
          </div>
        </div>
      )}
      <div 
        ref={containerRef} 
        className="tradingview-chart-container"
        style={{ height, width: '100%' }}
      />
    </div>
  );
}