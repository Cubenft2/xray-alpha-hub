import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function StocksHeatmap() {
  return (
    <Card className="xr-card">
      <CardHeader>
        <CardTitle className="flex items-center">
          🗺️ Stock Market Heatmap
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-96 rounded-lg overflow-hidden">
          <div
            dangerouslySetInnerHTML={{
              __html: `
                <div class="tradingview-widget-container" style="height:100%;width:100%">
                  <div class="tradingview-widget-container__widget" style="height:calc(100% - 32px);width:100%"></div>
                  <script type="text/javascript" src="https://s3.tradingview.com/external-embedding/embed-widget-stock-heatmap.js" async>
                  {
                    "exchanges": [],
                    "dataSource": "SPX500",
                    "grouping": "sector",
                    "blockSize": "market_cap_basic",
                    "blockColor": "change",
                    "locale": "en",
                    "symbolUrl": "",
                    "colorTheme": "${document.documentElement.classList.contains('dark') ? 'dark' : 'light'}",
                    "hasTopBar": false,
                    "isDataSetEnabled": false,
                    "isZoomEnabled": true,
                    "hasSymbolTooltip": true,
                    "width": "100%",
                    "height": "100%"
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