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
    crypto: 'BITSTAMP:BTCUSD,BINANCE:ETHUSD,BINANCE:SOLUSD,BINANCE:DOGEUSDT,BITSTAMP:XRPUSD,BINANCE:ADAUSDT,BINANCE:AVAXUSDT,BINANCE:SHIBUSDT,BINANCE:BONKUSDT,BINANCE:LINKUSDT,BINANCE:DOTUSDT,BINANCE:UNIUSDT,BINANCE:MATICUSDT,BINANCE:LTCUSD,BINANCE:BCHUSDT,BINANCE:ATOMUSDT,BINANCE:FILUSDT,BINANCE:VETUSDT,BINANCE:XLMUSDT,BINANCE:TRXUSDT,BINANCE:EOSUSDT,BINANCE:AAVEUSDT,BINANCE:MKRUSDT,BINANCE:COMPUSDT,BINANCE:SNXUSDT,BINANCE:YFIUSDT,BINANCE:SUSHIUSDT,BINANCE:CRVUSDT,BINANCE:1INCHUSDT,BINANCE:ENJUSDT,BINANCE:MANAUSDT,BINANCE:SANDUSDT,BINANCE:GALAUSDT,BINANCE:AXSUSDT,BINANCE:CHZUSDT,BINANCE:FLOWUSDT,BINANCE:NEARUSDT,BINANCE:FTMUSDT,BINANCE:HBARUSDT,BINANCE:EGLDUSDT,BINANCE:THETAUSDT,BINANCE:KLAYUSDT,BINANCE:RUNEUSDT,BINANCE:WAVESUSDT,BINANCE:ICPUSDT,BINANCE:ZILUSDT,BINANCE:STXUSDT',
    stocks: 'AMEX:SPY,NASDAQ:QQQ,NASDAQ:NVDA,NASDAQ:TSLA,NASDAQ:COIN,NASDAQ:MSTR,NASDAQ:AAPL,NASDAQ:MSFT,NASDAQ:GOOGL,NASDAQ:AMZN,NASDAQ:META,NYSE:JPM,NYSE:BAC,NYSE:WFC,NYSE:GS,NYSE:MS,NASDAQ:NFLX,NYSE:DIS,NYSE:V,NYSE:MA,NYSE:JNJ,NYSE:PG,NYSE:KO,NYSE:PFE,NYSE:WMT,NYSE:HD,NYSE:UNH,NYSE:CVX,NYSE:XOM,NASDAQ:ADBE,NASDAQ:CRM,NASDAQ:ORCL,NYSE:IBM,NASDAQ:INTC,NASDAQ:AMD,NASDAQ:QCOM,NASDAQ:AVGO,NYSE:T,NYSE:VZ,NASDAQ:CMCSA,NYSE:NKE,NYSE:MCD,NYSE:SBUX,NASDAQ:PYPL,NASDAQ:SQ,NYSE:UBER,NASDAQ:LYFT,NYSE:TWTR,NASDAQ:SNAP,NYSE:PINS,NASDAQ:ROKU,NASDAQ:ZM,NASDAQ:DOCU,NASDAQ:SHOP,NASDAQ:SPOT,NYSE:NET,NYSE:SNOW,NYSE:PLTR,NYSE:RBLX,NYSE:ABNB'
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