import React, { useEffect, useRef } from 'react';
import { useTheme } from 'next-themes';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function StocksScreener() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { theme } = useTheme();

  useEffect(() => {
    if (!containerRef.current) return;

    // Clear previous widget
    containerRef.current.innerHTML = '';

    // Add a small delay to ensure proper loading
    const timer = setTimeout(() => {
      if (!containerRef.current) return;

      const script = document.createElement('script');
      script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-screener.js';
      script.async = true;
      script.type = 'text/javascript';
      
      const config = {
        width: "100%",
        height: "100%",
        defaultColumn: "overview",
        screener_type: "stock_market",
        displayCurrency: "USD",
        colorTheme: theme === 'dark' ? 'dark' : 'light',
        locale: "en",
        isTransparent: false,
        toolbar_bg: theme === 'dark' ? '#1a1a1a' : '#ffffff'
      };

      script.innerHTML = JSON.stringify(config);

      const widgetContainer = document.createElement('div');
      widgetContainer.className = 'tradingview-widget-container';
      widgetContainer.style.height = '100%';
      widgetContainer.style.width = '100%';

      const widgetInner = document.createElement('div');
      widgetInner.className = 'tradingview-widget-container__widget';
      widgetInner.style.height = 'calc(100% - 32px)';
      widgetInner.style.width = '100%';

      widgetContainer.appendChild(widgetInner);
      widgetContainer.appendChild(script);
      containerRef.current.appendChild(widgetContainer);
    }, 100);

    return () => {
      clearTimeout(timer);
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
    };
  }, [theme]);

  return (
    <Card className="xr-card">
      <CardHeader>
        <CardTitle className="flex items-center">
          📊 U.S. Stock Screener
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-96 rounded-lg overflow-hidden">
          <div ref={containerRef} style={{ height: '100%', width: '100%' }} />
        </div>
      </CardContent>
    </Card>
  );
}