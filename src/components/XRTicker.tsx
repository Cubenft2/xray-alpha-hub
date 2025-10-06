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
    crypto: 'COINBASE:BTCUSD,COINBASE:ETHUSD,BINANCE:BTCUSDT,BINANCE:ETHUSDT,BINANCE:BNBUSDT,BINANCE:SOLUSDT,BINANCE:XRPUSDT,BINANCE:ADAUSDT,BINANCE:AVAXUSDT,BINANCE:DOGEUSDT,BINANCE:SHIBUSDT,BINANCE:LINKUSDT,BINANCE:DOTUSDT,BINANCE:UNIUSDT,COINBASE:MATICUSD,BINANCE:LTCUSDT,BINANCE:BCHUSDT,BINANCE:ATOMUSDT,BINANCE:FILUSDT,BINANCE:XLMUSDT,BINANCE:ALGOUSDT,BINANCE:MANAUSDT,BINANCE:SANDUSDT,BINANCE:CHZUSDT,BINANCE:NEARUSDT,BINANCE:AXSUSDT,BINANCE:COMPUSDT,COINBASE:MKRUSD,BINANCE:AAVEUSDT,BINANCE:SNXUSDT,BINANCE:YFIUSDT,BINANCE:CRVUSDT,BINANCE:ENJUSDT,BINANCE:GALAUSDT,BINANCE:FLOWUSDT,BINANCE:ICPUSDT,BINANCE:FETUSDT,BINANCE:PEPEUSDT,COINBASE:BONKUSD,BINANCE:WIFUSDT,BINANCE:ARBUSDT,GEMINI:RNDRUSD,BINANCE:TONUSDT,BINANCE:TRXUSDT,OKX:ZETAUSD,BINANCE:SUIUSDT,BINANCE:CETUSUSDT,BYBIT:HYPEUSDT,OKX:OKBUSDT,BINANCE:ONDOUSDT,BINANCE:SEIUSDT,BINANCE:JUPUSDT,BITSTAMP:FLRUSD,BINANCE:OPUSDT,BINANCE:WLFIUSDT,BINANCE:PENGUUSDT,BINANCE:AVNTUSDT,BINANCE:ASPERUSDT,MEXC:ASTERUSDT,BINANCE:ASTRUSDT,MEXC:OVPPUSDT,MEXC:COAIUSDT,MEXC:PLUMEUSDT',
    stocks: 'FOREXCOM:DJI,FOREXCOM:SPXUSD,FOREXCOM:NAS100,AMEX:SPY,NASDAQ:QQQ,NASDAQ:NVDA,NASDAQ:TSLA,NASDAQ:COIN,NASDAQ:MSTR,NASDAQ:MARA,NASDAQ:RIOT,NASDAQ:CLSK,NASDAQ:HUT,NASDAQ:BITF,NYSE:BBAI,NASDAQ:HOOD,NASDAQ:AAPL,NASDAQ:MSFT,NASDAQ:GOOGL,NASDAQ:AMZN,NASDAQ:META,NYSE:JPM,NYSE:BAC,NYSE:WFC,NYSE:GS,NYSE:MS,NASDAQ:NFLX,NYSE:DIS,NYSE:V,NYSE:MA,NYSE:JNJ,NYSE:PG,NYSE:KO,NYSE:PFE,NYSE:WMT,NYSE:HD,NYSE:UNH,NYSE:CVX,NYSE:XOM,NASDAQ:ADBE,NYSE:CRM,NYSE:ORCL,NYSE:IBM,NASDAQ:INTC,NASDAQ:AMD,NASDAQ:QCOM,NASDAQ:AVGO,NYSE:T,NYSE:VZ,NASDAQ:CMCSA,NYSE:NKE,NYSE:MCD,NASDAQ:SBUX,NASDAQ:PYPL,NASDAQ:SQ,NYSE:UBER,NASDAQ:LYFT,NYSE:TWTR,NYSE:SNAP,NYSE:PINS,NASDAQ:ROKU,NASDAQ:ZM,NASDAQ:DOCU,NASDAQ:SHOP,NYSE:SPOT,NYSE:NET,NYSE:SNOW,NASDAQ:PLTR,NYSE:RBLX,NASDAQ:ABNB,NASDAQ:EA,NASDAQ:MNPR,NYSE:IONQ'
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