import React, { useEffect, useRef, useState } from 'react';
import { useTheme } from 'next-themes';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { createPortal } from 'react-dom';
import { X, RotateCcw, Maximize } from 'lucide-react';
import { formatTvSymbol } from '@/lib/tvSymbolResolver';

interface TradingViewChartProps {
  symbol?: string;
  candidates?: string[]; // New: prioritized list of symbols to try
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
  candidates,
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
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
  const [attemptIndex, setAttemptIndex] = useState(0);
  const [usedFallback, setUsedFallback] = useState(false);
  const attemptTimeoutRef = useRef<number | null>(null);
  const mutationObserverRef = useRef<MutationObserver | null>(null);

  // Determine which symbol to use based on current attempt
  const symbolsToTry = candidates || [symbol];
  const currentSymbol = symbolsToTry[Math.min(attemptIndex, symbolsToTry.length - 1)];
  
  // Limit retry attempts to prevent endless cycling
  const MAX_ATTEMPTS = 3;

  useEffect(() => {
    if (!containerRef.current) return;

    setIsLoading(true);
    
    // Clear previous widget and observers
    containerRef.current.innerHTML = '';
    if (mutationObserverRef.current) {
      mutationObserverRef.current.disconnect();
    }
    if (attemptTimeoutRef.current) {
      clearTimeout(attemptTimeoutRef.current);
    }

    let started = false;

    const tryNextCandidate = () => {
      if (attemptIndex < Math.min(symbolsToTry.length - 1, MAX_ATTEMPTS - 1)) {
        console.log(`⚠️ Symbol ${currentSymbol} failed, trying next candidate (${attemptIndex + 1}/${MAX_ATTEMPTS})...`);
        setAttemptIndex(prev => prev + 1);
        setUsedFallback(true);
      } else {
        console.warn(`❌ All attempts exhausted (tried ${Math.min(symbolsToTry.length, MAX_ATTEMPTS)} symbols)`);
        setIsLoading(false);
      }
    };

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
        symbol: currentSymbol,
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

      // Set up timeout to try next candidate if widget doesn't load
      attemptTimeoutRef.current = window.setTimeout(() => {
        const iframe = widgetDiv.querySelector('iframe');
        if (!iframe) {
          console.warn(`⏱️ Timeout loading ${currentSymbol}`);
          tryNextCandidate();
        }
      }, 4000);

      script.onload = () => {
        const start = Date.now();
        const checkWidget = setInterval(() => {
          const iframe = widgetDiv.querySelector('iframe');
          if (iframe) {
            clearInterval(checkWidget);
            
            // Monitor for "Invalid symbol" error text
            if (mutationObserverRef.current) {
              mutationObserverRef.current.disconnect();
            }
            
            mutationObserverRef.current = new MutationObserver(() => {
              const errorText = widgetDiv.textContent || '';
              if (errorText.toLowerCase().includes('invalid symbol') || 
                  errorText.toLowerCase().includes('symbol not found')) {
                console.warn(`❌ Invalid symbol detected: ${currentSymbol}`);
                if (mutationObserverRef.current) {
                  mutationObserverRef.current.disconnect();
                }
                if (attemptTimeoutRef.current) {
                  clearTimeout(attemptTimeoutRef.current);
                }
                tryNextCandidate();
              }
            });

            mutationObserverRef.current.observe(widgetDiv, {
              childList: true,
              subtree: true,
              characterData: true
            });

            setTimeout(() => {
              setIsLoading(false);
              if (attemptTimeoutRef.current) {
                clearTimeout(attemptTimeoutRef.current);
              }
            }, 500);
          } else if (Date.now() - start > 3000) {
            clearInterval(checkWidget);
            setIsLoading(false);
          }
        }, 100);
      };

      script.onerror = () => {
        setIsLoading(false);
        console.error('TradingView widget failed to load');
        tryNextCandidate();
      };

      widgetContainer.appendChild(widgetDiv);
      widgetContainer.appendChild(copyrightDiv);
      widgetContainer.appendChild(script);

      containerRef.current.appendChild(widgetContainer);
    };

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

    tryStart();

    return () => {
      clearInterval(visibleCheck);
      clearTimeout(safetyTimeout);
      if (attemptTimeoutRef.current) {
        clearTimeout(attemptTimeoutRef.current);
      }
      if (mutationObserverRef.current) {
        mutationObserverRef.current.disconnect();
      }
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
    };
  }, [symbol, candidates?.join(','), theme, interval, style, hideTopToolbar, hideSideToolbar, allowSymbolChange, isFullscreen, reloadToken, attemptIndex]);

  // Reset attempt index when symbol/candidates change
  useEffect(() => {
    setAttemptIndex(0);
    setUsedFallback(false);
  }, [symbol, candidates?.join(',')]);

  // Lock body scroll when fullscreen
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

  const { exchange, pair } = formatTvSymbol(currentSymbol);

  const chart = (
    <div className={`${isFullscreen ? 'fixed inset-0 z-[9999] bg-background' : ''} ${className}`}>
      {!isFullscreen && (
        <div className="flex items-center justify-between mb-2">
          {usedFallback && attemptIndex > 0 && (
            <Badge variant="outline" className="text-xs">
              Using: {exchange}:{pair}
            </Badge>
          )}
          <div className="flex gap-2 ml-auto">
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
        </div>
      )}
      {isFullscreen && (
        <div className="fixed top-4 right-4 z-[10000] flex gap-2">
          {usedFallback && attemptIndex > 0 && (
            <Badge variant="outline" className="text-xs mr-2">
              Using: {exchange}:{pair}
            </Badge>
          )}
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