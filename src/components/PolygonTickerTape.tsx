import React, { useState, useEffect, memo } from 'react';
import { useTheme } from 'next-themes';
import { supabase } from '@/integrations/supabase/client';
import { useMarquee } from '@/hooks/useMarquee';

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
    // Start the edge function (it will keep running)
    const startEdgeFunction = async () => {
      try {
        const ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9kbmN2Zml1emxpeW9oeHJzaWdjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg3Mzk4MjEsImV4cCI6MjA3NDMxNTgyMX0.7cnRatKpHqsylletKVel7WAprIYdpP85AXtXLswMYXQ";
        await fetch('https://odncvfiuzliyohxrsigc.supabase.co/functions/v1/polygon-ticker-stream', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${ANON_KEY}`
          }
        });
        console.log('✅ Polygon ticker stream started');
      } catch (error) {
        console.error('❌ Failed to start polygon ticker stream:', error);
      }
    };

    startEdgeFunction();

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

    // Wait a bit for edge function to populate data
    setTimeout(fetchInitialPrices, 2000);

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
