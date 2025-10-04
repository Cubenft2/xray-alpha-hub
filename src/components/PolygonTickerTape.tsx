import React, { useState, useEffect, memo } from 'react';
import { useTheme } from 'next-themes';
import { supabase } from '@/integrations/supabase/client';

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
    <div className="ticker-card flex items-center gap-2 px-4 py-2 bg-card/50 backdrop-blur-sm rounded-lg border border-border/50 whitespace-nowrap">
      <span className="font-bold text-foreground">{display}</span>
      <span className="text-muted-foreground">${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
      <span className={`text-sm font-medium ${changeColor}`}>
        {isPositive ? '▲' : '▼'} {Math.abs(change24h).toFixed(2)}%
      </span>
    </div>
  );
});

TickerCard.displayName = 'TickerCard';

export function PolygonTickerTape() {
  const [tickers, setTickers] = useState<TickerItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { theme } = useTheme();
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    // Fetch initial snapshot
    const fetchInitialPrices = async () => {
      const { data, error } = await supabase
        .from('live_prices')
        .select('*')
        .order('ticker', { ascending: true });

      if (error) {
        console.error('Error fetching initial prices:', error);
        return;
      }

      setTickers(data || []);
      setIsLoading(false);
    };

    fetchInitialPrices();

    // Subscribe to real-time updates
    const channel = supabase
      .channel('live-prices-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'live_prices'
        },
        (payload) => {
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const newPrice = payload.new as TickerItem;
            
            setTickers(prev => {
              const existingIndex = prev.findIndex(t => t.ticker === newPrice.ticker);
              
              if (existingIndex >= 0) {
                const updated = [...prev];
                updated[existingIndex] = newPrice;
                return updated;
              } else {
                return [...prev, newPrice].sort((a, b) => a.ticker.localeCompare(b.ticker));
              }
            });
          } else if (payload.eventType === 'DELETE') {
            setTickers(prev => prev.filter(t => t.ticker !== payload.old.ticker));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Duplicate tickers for infinite scroll effect
  const displayTickers = tickers.length > 0 ? [...tickers, ...tickers] : [];

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
    <div className="ticker-tape-container relative overflow-hidden bg-background/95 backdrop-blur-sm border-b border-border">
      <div 
        className="ticker-tape-scroll flex gap-4 py-3"
        style={{ 
          animationPlayState: isPaused ? 'paused' : 'running',
          animation: 'scroll-left 60s linear infinite',
          willChange: 'transform'
        }}
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
        onTouchStart={() => setIsPaused(true)}
        onTouchEnd={() => setIsPaused(false)}
      >
        {displayTickers.map((ticker, idx) => (
          <TickerCard 
            key={`${ticker.ticker}-${idx}`} 
            {...ticker}
            index={idx}
          />
        ))}
      </div>
      
      <style>{`
        @keyframes scroll-left {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  );
}
