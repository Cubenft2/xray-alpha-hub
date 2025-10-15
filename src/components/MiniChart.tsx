import React, { useEffect, useRef, lazy, Suspense } from 'react';
import { getTickerMapping } from '@/config/tickerMappings';

const FallbackSparkline = lazy(() => import('./FallbackSparkline').then(module => ({ default: module.FallbackSparkline })));
interface MiniChartProps {
  symbol: string;
  theme?: string;
  onClick?: () => void;
  tvOk?: boolean; // Capability flag for TradingView support
  coingeckoId?: string;
  polygonTicker?: string;
  showFallback?: boolean; // Whether to show fallback sparkline
  assetType?: 'crypto' | 'stock' | 'index' | 'forex'; // Asset type for smart defaults
}

export function MiniChart({ 
  symbol, 
  theme, 
  onClick, 
  tvOk = true,
  coingeckoId,
  polygonTicker,
  showFallback = true,
  assetType
}: MiniChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [renderMode, setRenderMode] = React.useState<'tv' | 'fallback' | 'none'>('tv');

  // Smart symbol formatting: add exchange prefix if missing
  const formatTradingViewSymbol = (rawSymbol: string): string => {
    const input = rawSymbol.trim().toUpperCase();

    // 1) If already exchange-qualified, sanitize obvious mistakes
    if (input.includes(':')) {
      const [exch, sym] = input.split(':');
      const STOCK_EXCHANGES = ['NASDAQ', 'NYSE', 'AMEX', 'ARCA', 'BATS', 'CBOE'];
      // If a stock exchange symbol incorrectly ends with USD/USDT, strip it
      if (STOCK_EXCHANGES.includes(exch) && /[A-Z0-9]+(USD|USDT)$/.test(sym)) {
        const cleaned = sym.replace(/(USD|USDT)$/,'');
        return `${exch}:${cleaned}`;
      }
      return input;
    }

    // 2) Crypto detection – anything ending in USD/USDT is likely crypto
    const endsWithCryptoPair = /USD(T)?$/i.test(input);
    const isCrypto = assetType === 'crypto'
      || endsWithCryptoPair
      || (!!polygonTicker && polygonTicker.startsWith('X:'))
      || (!!coingeckoId)
      || /^(BTC|ETH|SOL|DOGE|ADA|XRP|DOT|LINK|MATIC|ATOM|UNI|LTC|BCH|TRX|TON|NEAR|APT|RNDR|INJ|STX|FTM|ALGO|SAND|MANA|AAVE|EOS|XTZ|THETA|AXS|FLOW|SUI|HYPE|ASTR|ASTER|XMR|DASH|ZEC|IMX|HBAR|VET|MKR|OP|ARB|GRT|RUNE|FIL|LISTA|XAU|DEFI|2Z|CHEEMS|PYUSD)$/i.test(input);

    if (isCrypto) {
      return /USDT?$/.test(input) ? input : `${input}USD`;
    }

    // 3) Stocks only - must NOT end with USD/USDT
    // Check for known NYSE stocks
    const NYSE_STOCKS = ['TRU', 'CVE', 'BAC', 'JPM', 'WMT', 'KO', 'PFE', 'DIS', 'NKE', 'V', 'MA', 'UNH'];
    if (NYSE_STOCKS.includes(input)) {
      console.log(`📊 Adding NYSE prefix to ${input}`);
      return `NYSE:${input}`;
    }
    
    console.log(`📊 Adding NASDAQ prefix to ${input}`);
    return `NASDAQ:${input}`;
  };

  // Get ticker mapping if available
  const mapped = React.useMemo(() => {
    const s = symbol.trim().toUpperCase();
    return getTickerMapping(s);
  }, [symbol]);

  // Build candidate symbols and manage retry attempts
  const [attempt, setAttempt] = React.useState(0);

  const candidates = React.useMemo(() => {
    const input = symbol.trim().toUpperCase();
    const mappedSym = mapped?.symbol?.toUpperCase();
    const base = input.includes(':') ? input.split(':')[1] : input;
    const endsWithUsd = /USD(T)?$/.test(base);

    const exchanges = ['BINANCE','BYBIT','KUCOIN','MEXC','GATEIO','OKX','KRAKEN','COINBASE','BITSTAMP','CRYPTO'];

    const list: string[] = [];
    if (mappedSym) list.push(mappedSym);
    list.push(input);
    if (endsWithUsd && !input.includes(':')) {
      exchanges.forEach(ex => list.push(`${ex}:${base}`));
    }

    // Fallback smart formatting as a last resort
    list.push(formatTradingViewSymbol(symbol));

    // Deduplicate while preserving order
    const seen = new Set<string>();
    return list.filter(s => {
      if (!s) return false;
      if (seen.has(s)) return false;
      seen.add(s);
      return true;
    });
  }, [symbol, mapped, assetType]);

  const currentSymbol = candidates[attempt] ?? formatTradingViewSymbol(symbol);

  // Reset attempts when symbol or mapping changes
  React.useEffect(() => {
    setAttempt(0);
  }, [symbol, mapped?.symbol]);
  
  // Determine effective tvOk: if we have a local mapping with exchange:pair, prefer TradingView
  const effectiveTvOk = React.useMemo(() => {
    if (mapped?.symbol && /^[A-Z]+:/.test(mapped.symbol)) {
      return true;
    }
    return tvOk;
  }, [mapped, tvOk]);

  // Initialize render mode based on effectiveTvOk and available fallbacks
  React.useEffect(() => {
    if (!effectiveTvOk && showFallback && (coingeckoId || polygonTicker)) {
      setRenderMode('fallback');
    } else if (!effectiveTvOk) {
      setRenderMode('none');
    } else {
      setRenderMode('tv');
    }
  }, [effectiveTvOk, showFallback, coingeckoId, polygonTicker]);

  useEffect(() => {
    if (!containerRef.current || renderMode !== 'tv') return;

    const sym = currentSymbol;
    // Clear previous widget
    containerRef.current.innerHTML = '';

    let cancelled = false;

    const tryNext = (reason: string) => {
      if (cancelled) return;
      const hasNext = attempt + 1 < candidates.length;
      console.warn(`⚠️ ${reason} for ${sym}. Attempt ${attempt + 1}/${candidates.length}`);
      if (hasNext) {
        setAttempt(a => a + 1);
      } else {
        if (showFallback && (coingeckoId || polygonTicker)) {
          setRenderMode('fallback');
        } else {
          setRenderMode('none');
        }
      }
    };

    // Shorter timeout per attempt
    const loadTimeout = setTimeout(() => {
      tryNext('TradingView widget timeout');
    }, 4000);

    console.log(`📈 Attempt ${attempt + 1}/${candidates.length}: loading ${sym} (original: ${symbol})`);

    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-mini-symbol-overview.js';
    script.async = true;
    script.innerHTML = JSON.stringify({
      symbol: sym,
      width: '100%',
      height: '100%',
      locale: 'en',
      dateRange: '12M',
      colorTheme: theme === 'dark' ? 'dark' : 'light',
      isTransparent: false,
      autosize: true,
      largeChartUrl: ''
    });

    const widgetContainer = document.createElement('div');
    widgetContainer.className = 'tradingview-widget-container';
    widgetContainer.style.height = '100%';
    widgetContainer.style.width = '100%';
    widgetContainer.style.cursor = onClick ? 'pointer' : 'default';

    const widgetInner = document.createElement('div');
    widgetInner.className = 'tradingview-widget-container__widget';
    widgetInner.style.height = 'calc(100% - 32px)';
    widgetInner.style.width = '100%';

    if (onClick) {
      widgetContainer.addEventListener('click', onClick);
    }

    widgetContainer.appendChild(widgetInner);
    widgetContainer.appendChild(script);
    containerRef.current.appendChild(widgetContainer);

    // Detect TradingView "Invalid symbol" and retry/fallback automatically
    const observer = new MutationObserver(() => {
      const text = widgetContainer.textContent || '';
      if (/Invalid symbol|Symbol not found/i.test(text)) {
        clearTimeout(loadTimeout);
        observer.disconnect();
        if (containerRef.current) {
          containerRef.current.innerHTML = '';
        }
        tryNext('TradingView invalid symbol');
      }
    });
    observer.observe(widgetContainer, { childList: true, subtree: true, characterData: true });

    // Clear timeout if widget loads successfully
    script.onload = () => {
      clearTimeout(loadTimeout);
      console.log(`✅ TradingView widget loaded for ${sym}`);
    };

    script.onerror = () => {
      clearTimeout(loadTimeout);
      tryNext('TradingView widget failed to load');
    };

    return () => {
      cancelled = true;
      clearTimeout(loadTimeout);
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
      try { observer.disconnect(); } catch {}
      if (onClick) {
        widgetContainer.removeEventListener('click', onClick);
      }
    };
  }, [currentSymbol, attempt, candidates.length, theme, onClick, renderMode, showFallback, coingeckoId, polygonTicker, symbol]);

  // Render based on mode
  if (renderMode === 'fallback' && (coingeckoId || polygonTicker)) {
    return (
      <div key="fallback" style={{ height: '100%', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '8px', overflow: 'hidden' }}>
        <Suspense fallback={<div className="text-sm text-muted-foreground">Loading chart...</div>}>
          <FallbackSparkline 
            symbol={symbol}
            coingeckoId={coingeckoId}
            polygonTicker={polygonTicker}
            timespan="7D"
            className="w-full h-full"
          />
        </Suspense>
      </div>
    );
  }

  if (renderMode === 'none') {
    return (
      <div key="none" style={{ height: '100%', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.5 }}>
        <p className="text-sm text-muted-foreground">Chart unavailable</p>
      </div>
    );
  }

  return <div key="tv" ref={containerRef} style={{ height: '100%', width: '100%', overflow: 'hidden', position: 'relative' }} />;
}