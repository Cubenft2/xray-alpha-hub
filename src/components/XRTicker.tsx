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
    crypto: 'COINBASE:BTCUSD,COINBASE:ETHUSD,COINBASE:SOLUSD,COINBASE:DOGEUSD,COINBASE:XRPUSD,COINBASE:ADAUSD,COINBASE:AVAXUSD,COINBASE:SHIBUSD,COINBASE:LINKUSD,COINBASE:DOTUSD,COINBASE:UNIUSD,COINBASE:MATICUSD,COINBASE:LTCUSD,COINBASE:BCHUSD,COINBASE:ATOMUSD,COINBASE:FILUSD,COINBASE:XLMUSD,COINBASE:ALGOUSD,COINBASE:MANAUSD,COINBASE:SANDUSD,COINBASE:CHZUSD,COINBASE:NEARUSD,COINBASE:FTMUSD,COINBASE:AXSUSD,COINBASE:COMPUSD,COINBASE:MKRUSD,COINBASE:AAVEUSD,COINBASE:SNXUSD,COINBASE:YFIUSD,COINBASE:CRVUSD,COINBASE:ENJTOUSD,COINBASE:GALAUSD,COINBASE:FLOWUSD,COINBASE:ICPUSD,COINBASE:THETAUSD,COINBASE:PEPEUSD,COINBASE:BONKUSD,NASDAQ:DJT,COINBASE:WIFUSD,COINBASE:BNBUSD',
    stocks: 'AMEX:SPY,NASDAQ:QQQ,NASDAQ:NVDA,NASDAQ:TSLA,NASDAQ:COIN,NASDAQ:MSTR,NASDAQ:MARA,NASDAQ:RIOT,NASDAQ:CLSK,NASDAQ:HUT,NASDAQ:BITF,NYSE:BBAI,NASDAQ:HOOD,NASDAQ:AAPL,NASDAQ:MSFT,NASDAQ:GOOGL,NASDAQ:AMZN,NASDAQ:META,NYSE:JPM,NYSE:BAC,NYSE:WFC,NYSE:GS,NYSE:MS,NASDAQ:NFLX,NYSE:DIS,NYSE:V,NYSE:MA,NYSE:JNJ,NYSE:PG,NYSE:KO,NYSE:PFE,NYSE:WMT,NYSE:HD,NYSE:UNH,NYSE:CVX,NYSE:XOM,NASDAQ:ADBE,NASDAQ:CRM,NASDAQ:ORCL,NYSE:IBM,NASDAQ:INTC,NASDAQ:AMD,NASDAQ:QCOM,NASDAQ:AVGO,NYSE:T,NYSE:VZ,NASDAQ:CMCSA,NYSE:NKE,NYSE:MCD,NYSE:SBUX,NASDAQ:PYPL,NASDAQ:SQ,NYSE:UBER,NASDAQ:LYFT,NYSE:TWTR,NASDAQ:SNAP,NYSE:PINS,NASDAQ:ROKU,NYSE:ZM,NASDAQ:DOCU,NASDAQ:SHOP,NASDAQ:SPOT,NYSE:NET,NYSE:SNOW,NYSE:PLTR,NYSE:RBLX,NYSE:ABNB'
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