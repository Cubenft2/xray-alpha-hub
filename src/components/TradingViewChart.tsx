import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useTheme } from 'next-themes';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { createPortal } from 'react-dom';
import { X, RotateCcw, Maximize } from 'lucide-react';

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
  const isMountedRef = useRef(true);
  const { theme } = useTheme();
  const [isLoading, setIsLoading] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    isMountedRef.current = true;
    
    if (!containerRef.current) return;

    setIsLoading(true);
    
    // Clear previous widget safely
    try {
      containerRef.current.innerHTML = '';
    } catch (e) {
      // Ignore cleanup errors
    }

    const init = () => {
      if (!containerRef.current) return;

      const script = document.createElement('script');
      script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
      script.async = true;
      script.type = 'text/javascript';
      
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
        locale: 'en',
        save_image: true,
        style: style,
        symbol: symbol,
        theme: theme === 'dark' ? 'dark' : 'light',
        timezone: 'Etc/UTC',
        watchlist: [],
        withdateranges: true,
        studies: studies,
        autosize: true,
        enable_publishing: true,
        show_popup_button: true,
        popup_height: '650',
        popup_width: '1000'
      } as const;

      script.innerHTML = JSON.stringify(config);

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

      script.onload = () => {
        const start = Date.now();
        const checkWidget = setInterval(() => {
          if (!isMountedRef.current) {
            clearInterval(checkWidget);
            return;
          }
          const iframe = widgetDiv.querySelector('iframe');
          if (iframe) {
            clearInterval(checkWidget);
            setTimeout(() => {
              if (isMountedRef.current) setIsLoading(false);
            }, 500);
          } else if (Date.now() - start > 3000) {
            clearInterval(checkWidget);
            if (isMountedRef.current) setIsLoading(false);
          }
        }, 100);
      };

      script.onerror = () => {
        if (isMountedRef.current) setIsLoading(false);
        console.error('TradingView widget failed to load');
      };

      widgetContainer.appendChild(widgetDiv);
      widgetContainer.appendChild(copyrightDiv);
      widgetContainer.appendChild(script);

      containerRef.current.appendChild(widgetContainer);
    };

    // Wait until the container is visible to avoid stuck loading inside hidden tabs
    let started = false;
    const tryStart = () => {
      if (!containerRef.current) return;
      const { offsetWidth, offsetHeight } = containerRef.current;
      if (offsetWidth > 0 && offsetHeight > 0 && !started) {
        started = true;
        init();
      }
    };

    const visibleCheck = window.setInterval(tryStart, 100);
    const safetyTimeout = window.setTimeout(() => {
      if (!started) {
        started = true;
        init();
      }
    }, 1200);

    // Kick first check immediately
    tryStart();

    return () => {
      isMountedRef.current = false;
      clearInterval(visibleCheck);
      clearTimeout(safetyTimeout);
      if (containerRef.current) {
        try {
          containerRef.current.innerHTML = '';
        } catch (e) {
          // Silently handle cleanup errors during unmount
        }
      }
    };
  }, [symbol, theme, interval, style, hideTopToolbar, hideSideToolbar, allowSymbolChange, isFullscreen, reloadToken]);

  // Lock body scroll when fullscreen to avoid background interaction
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    if (isFullscreen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = prevOverflow || '';
    }
    return () => {
      document.body.style.overflow = prevOverflow || '';
    };
  }, [isFullscreen]);


  const chart = (
    <div className={`${isFullscreen ? 'fixed inset-0 z-[9999] bg-background' : ''} ${className}`}>
      {!isFullscreen && (
        <div className="flex justify-end gap-2 mb-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setIsFullscreen((f) => !f)}
            aria-label="Enter fullscreen"
          >
            <Maximize size={16} />
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setReloadToken((t) => t + 1)}
            aria-label="Reload chart"
          >
            <RotateCcw size={16} />
          </Button>
        </div>
      )}
      {isFullscreen && (
        <div className="fixed top-4 right-4 z-[10000] flex gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setIsFullscreen((f) => !f)}
            aria-label="Exit fullscreen"
          >
            <X size={16} />
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setReloadToken((t) => t + 1)}
            aria-label="Reload chart"
          >
            <RotateCcw size={16} />
          </Button>
        </div>
      )}
      <div
        className="relative"
        style={{ height: isFullscreen ? '100vh' : height, width: isFullscreen ? '100vw' : '100%' }}
      >
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
          className="tradingview-chart-container w-full h-full"
          style={{ height: isFullscreen ? '100vh' : height, width: isFullscreen ? '100vw' : '100%' }}
        />
      </div>
    </div>
  );

  return isFullscreen ? createPortal(chart, document.body) : chart;


}