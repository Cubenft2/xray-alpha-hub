import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function StocksScreener() {
  return (
    <Card className="xr-card">
      <CardHeader>
        <CardTitle className="flex items-center">
          📊 U.S. Stock Screener
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-96 rounded-lg overflow-hidden">
          <div
            dangerouslySetInnerHTML={{
              __html: `
                <div class="tradingview-widget-container" style="height:100%;width:100%">
                  <div class="tradingview-widget-container__widget" style="height:calc(100% - 32px);width:100%"></div>
                  <script type="text/javascript" src="https://s3.tradingview.com/external-embedding/embed-widget-screener.js" async>
                  {
                    "width": "100%",
                    "height": "100%",
                    "defaultColumn": "overview",
                    "screener_type": "stock_market",
                    "displayCurrency": "USD",
                    "colorTheme": "${document.documentElement.classList.contains('dark') ? 'dark' : 'light'}",
                    "locale": "en",
                    "isTransparent": false
                  }
                  </script>
                </div>
              `
            }}
          />
        </div>
      </CardContent>
    </Card>
  );
}