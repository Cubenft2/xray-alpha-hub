import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from './ui/badge';
import { Pause, Play, ChevronUp, ChevronDown } from 'lucide-react';
import { Button } from './ui/button';

interface PriceData {
  ticker: string;
  display: string;
  price: number;
  change24h: number;
  updated_at: string;
}

export function PolygonTicker() {
  const [prices, setPrices] = useState<Map<string, PriceData>>(new Map());
  const [isPaused, setIsPaused] = useState(false);
  const [speed, setSpeed] = useState(50); // pixels per second
  const tickerRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number>();

  useEffect(() => {
    let mounted = true;

    // Fetch initial mapped tickers
    const initializeTickers = async () => {
      const { data: tickers } = await supabase
        .from('ticker_mappings')
        .select('symbol, display_name, polygon_ticker')
        .not('polygon_ticker', 'is', null)
        .eq('type', 'crypto')
        .eq('is_active', true)
        .limit(71);

      if (!tickers || !mounted) return;

      // Fetch current prices for these tickers
      const tickerList = tickers.map(t => t.polygon_ticker).filter(Boolean);
      
      const { data: currentPrices } = await supabase
        .from('live_prices')
        .select('*')
        .in('ticker', tickerList);

      if (currentPrices && mounted) {
        const priceMap = new Map<string, PriceData>();
        currentPrices.forEach(price => {
          priceMap.set(price.ticker, price);
        });
        setPrices(priceMap);
      }
    };

    initializeTickers();

    // Subscribe to realtime updates
    const channel = supabase
      .channel('polygon-ticker-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'live_prices'
        },
        (payload) => {
          if (!mounted) return;
          
          const newPrice = payload.new as PriceData;
          
          setPrices(prev => {
            const updated = new Map(prev);
            updated.set(newPrice.ticker, newPrice);
            return updated;
          });
        }
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, []);

  // Smooth scrolling animation
  useEffect(() => {
    if (!tickerRef.current || isPaused) return;

    let lastTimestamp = 0;
    let offset = 0;

    const animate = (timestamp: number) => {
      if (!lastTimestamp) {
        lastTimestamp = timestamp;
      }

      const deltaTime = (timestamp - lastTimestamp) / 1000; // seconds
      lastTimestamp = timestamp;

      offset += speed * deltaTime;

      if (tickerRef.current) {
        const maxScroll = tickerRef.current.scrollWidth / 2;
        if (offset >= maxScroll) {
          offset = 0;
        }
        tickerRef.current.style.transform = `translateX(-${offset}px)`;
      }

      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isPaused, speed]);

  const priceArray = Array.from(prices.values());

  // Duplicate for seamless loop
  const displayPrices = [...priceArray, ...priceArray];

  const formatPrice = (price: number) => {
    if (price >= 1000) return `$${price.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
    if (price >= 1) return `$${price.toFixed(2)}`;
    if (price >= 0.01) return `$${price.toFixed(4)}`;
    return `$${price.toFixed(6)}`;
  };

  return (
    <div className="relative bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-y overflow-hidden">
      <div className="container mx-auto py-2 flex items-center gap-4">
        {/* Controls */}
        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsPaused(!isPaused)}
            className="h-7 w-7 p-0"
          >
            {isPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
          </Button>
          
          <div className="flex flex-col gap-0.5">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSpeed(s => Math.min(s + 10, 100))}
              className="h-3 w-5 p-0"
            >
              <ChevronUp className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSpeed(s => Math.max(s - 10, 10))}
              className="h-3 w-5 p-0"
            >
              <ChevronDown className="h-3 w-3" />
            </Button>
          </div>

          <Badge variant="secondary" className="text-xs shrink-0">
            LIVE
          </Badge>
        </div>

        {/* Ticker */}
        <div className="flex-1 overflow-hidden">
          <div
            ref={tickerRef}
            className="flex gap-6 whitespace-nowrap"
            style={{ width: 'max-content' }}
          >
            {displayPrices.map((price, idx) => {
              const isPositive = price.change24h >= 0;
              
              return (
                <div
                  key={`${price.ticker}-${idx}`}
                  className="flex items-center gap-3 hover:bg-accent/50 px-3 py-1 rounded cursor-pointer transition-colors"
                  onClick={() => {
                    // TODO: Open chart for this ticker
                    console.log('Open chart for', price.ticker);
                  }}
                >
                  <span className="font-semibold text-sm">{price.display}</span>
                  <span className="text-sm font-mono">{formatPrice(price.price)}</span>
                  <span
                    className={`text-xs font-medium ${
                      isPositive ? 'text-green-500' : 'text-red-500'
                    }`}
                  >
                    {isPositive ? '+' : ''}{price.change24h.toFixed(2)}%
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
