import React, { useState, useEffect, memo } from 'react';
import { useTheme } from 'next-themes';
import { supabase } from '@/integrations/supabase/client';
import { useMarquee } from '@/hooks/useMarquee';
import { useLivePrices } from '@/hooks/useLivePrices';

interface TickerItem {
  ticker: string;
  display: string;
  price: number;
  change24h: number;
  updated_at: string;
}

interface TickerCardProps extends TickerItem {
  index: number;
}

const TickerCard = memo(({ display, price, change24h }: TickerCardProps) => {
  const isPositive = change24h >= 0;
  const changeColor = isPositive ? 'text-green-500' : 'text-red-500';
  
  return (
    <div className="ticker-card flex items-center gap-2 px-4 py-2 bg-card/50 backdrop-blur-sm rounded-lg border border-border/50 whitespace-nowrap min-w-[180px]">
      <span className="font-bold text-foreground">{display}</span>
      <span className="text-muted-foreground tabular-nums font-mono">
        {price > 0 ? `$${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'}
      </span>
      <span className={`text-sm font-medium tabular-nums ${changeColor}`}>
        {price > 0 ? `${isPositive ? '▲' : '▼'} ${Math.abs(change24h).toFixed(2)}%` : '—'}
      </span>
    </div>
  );
});

TickerCard.displayName = 'TickerCard';

export function PolygonTickerTape() {
  const [isPaused, setIsPaused] = useState(false);
  
  // Popular crypto symbols to display
  const symbols = ['BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'ADA', 'AVAX', 'DOGE', 'MATIC', 'DOT', 'UNI', 'LINK', 'ATOM', 'LTC', 'BCH'];
  
  const { prices, loading: isLoading } = useLivePrices(symbols);

  // Convert prices to ticker format - show all symbols with placeholders for missing prices
  const tickers: TickerItem[] = symbols.map(symbol => {
    const priceData = prices[symbol];
    
    return {
      ticker: symbol,
      display: symbol,
      price: priceData?.price || 0,
      change24h: priceData?.change_24h || 0,
      updated_at: new Date().toISOString()
    };
  });

  const { containerRef, trackRef } = useMarquee({ 
    pxPerSecond: 80, 
    pause: isPaused 
  });

  if (isLoading) {
    return (
      <div className="ticker-tape-container relative overflow-hidden bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="flex items-center justify-center py-3">
          <span className="text-muted-foreground text-sm animate-pulse">
            Loading live prices...
          </span>
        </div>
      </div>
    );
  }

  return (
    <div 
      ref={containerRef}
      className="ticker-tape-container relative overflow-hidden bg-background/95 backdrop-blur-sm border-b border-border"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onTouchStart={() => setIsPaused(true)}
      onTouchEnd={() => setIsPaused(false)}
    >
      <div 
        ref={trackRef}
        className="flex gap-4 py-3"
        style={{ willChange: 'transform' }}
      >
        <div className="flex gap-4">
          {tickers.map((ticker) => (
            <TickerCard 
              key={`${ticker.ticker}-A`} 
              {...ticker}
              index={0}
            />
          ))}
        </div>
        <div className="flex gap-4">
          {tickers.map((ticker) => (
            <TickerCard 
              key={`${ticker.ticker}-B`} 
              {...ticker}
              index={0}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
