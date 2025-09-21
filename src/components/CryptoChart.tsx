import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Maximize2, Minimize2, RotateCcw } from 'lucide-react';
import { useTheme } from 'next-themes';

interface CryptoChartProps {
  symbol?: string;
  height?: number;
}

export function CryptoChart({ symbol = 'BITSTAMP:BTCUSD', height = 400 }: CryptoChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const { theme } = useTheme();

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
      theme: theme === 'dark' ? 'dark' : 'light',
      style: '1',
      locale: 'en',
      toolbar_bg: theme === 'dark' ? '#1a1a1a' : '#f1f3f6',
      enable_publishing: false,
      allow_symbol_change: true,
      container_id: 'tradingview_chart',
      height: isFullscreen ? '100vh' : height,
      studies: ['STD;SMA'],
      hide_top_toolbar: false,
      hide_legend: false,
      save_image: true,
      hide_volume: false
    };

    script.innerHTML = JSON.stringify(config);
    containerRef.current.appendChild(script);

    return () => {
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
    };
  }, [symbol, height, isFullscreen, theme]);

  const toggleFullscreen = () => {
    if (!isFullscreen) {
      // Enter fullscreen
      setIsFullscreen(true);
      // Lock to landscape on mobile
      try {
        if (screen.orientation && 'lock' in screen.orientation) {
          (screen.orientation as any).lock('landscape').catch(() => {
            // Ignore if not supported
          });
        }
      } catch (e) {
        // Ignore orientation lock errors
      }
    } else {
      // Exit fullscreen
      setIsFullscreen(false);
      // Unlock orientation
      try {
        if (screen.orientation && 'unlock' in screen.orientation) {
          (screen.orientation as any).unlock();
        }
      } catch (e) {
        // Ignore orientation unlock errors
      }
    }
  };

  return (
    <div className={`xr-card p-4 ${isFullscreen ? 'fixed inset-0 z-50 bg-background' : ''}`}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">
          {symbol.includes('BTC') ? '📊 Bitcoin Chart' : symbol.includes('SPY') ? '📈 SPY Chart' : '📈 Advanced Chart'}
        </h2>
        <div className="flex items-center space-x-2">
          <span className="text-sm text-muted-foreground">
            TradingView
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={toggleFullscreen}
            className="hidden md:flex"
          >
            {isFullscreen ? (
              <>
                <Minimize2 className="w-4 h-4 mr-1" />
                Exit Fullscreen
              </>
            ) : (
              <>
                <Maximize2 className="w-4 h-4 mr-1" />
                Fullscreen
              </>
            )}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={toggleFullscreen}
            className="md:hidden"
          >
            {isFullscreen ? (
              <>
                <RotateCcw className="w-4 h-4 mr-1" />
                Exit
              </>
            ) : (
              <>
                <Maximize2 className="w-4 h-4 mr-1" />
                Expand
              </>
            )}
          </Button>
        </div>
      </div>
      <div 
        ref={containerRef} 
        className="tradingview-widget-container rounded-lg overflow-hidden"
        style={{ 
          height: isFullscreen ? 'calc(100vh - 80px)' : `${height}px`,
          width: '100%'
        }}
      >
        <div className="tradingview-widget-container__widget"></div>
      </div>
    </div>
  );
}