import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from './ui/badge';
import { Gauge } from 'lucide-react';
import { Button } from './ui/button';
import { useNavigate } from 'react-router-dom';
import { useTickerMappings } from '@/hooks/useTickerMappings';
import { useIsMobile } from '@/hooks/use-mobile';

interface PriceData {
  ticker: string;
  display: string;
  price: number;
  change24h: number;
  updated_at: string;
  coingecko_id?: string | null;
  logo_url?: string | null;
}

export function PolygonTicker() {
  const speedLevels = [30, 50, 80]; // slow, medium, fast
  const [prices, setPrices] = useState<Map<string, PriceData>>(new Map());
  const [isPaused, setIsPaused] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [speedLevel, setSpeedLevel] = useState(1); // index into speedLevels (start at medium)
  const [logoCache, setLogoCache] = useState<Map<string, string>>(new Map());
  const tickerRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number>();
  const offsetRef = useRef(0); // Persist offset across pauses
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  
  const speed = speedLevels[speedLevel];

  useEffect(() => {
    let mounted = true;

    // Fetch initial mapped tickers
    const initializeTickers = async () => {
      const { data: tickers } = await supabase
        .from('ticker_mappings')
        .select('symbol, display_name, polygon_ticker, coingecko_id')
        .not('polygon_ticker', 'is', null)
        .eq('type', 'crypto')
        .eq('is_active', true)
        .limit(71);

      if (!tickers || !mounted) return;

      // Create mapping of polygon_ticker to coingecko_id
      const tickerToCoinGecko = new Map<string, string | null>();
      tickers.forEach(t => {
        if (t.polygon_ticker) {
          tickerToCoinGecko.set(t.polygon_ticker, t.coingecko_id);
        }
      });

      // Fetch current prices for these tickers
      const tickerList = tickers.map(t => t.polygon_ticker).filter(Boolean);
      
      const { data: currentPrices } = await supabase
        .from('live_prices')
        .select('*')
        .in('ticker', tickerList);

      if (currentPrices && mounted) {
        const priceMap = new Map<string, PriceData>();
        currentPrices.forEach(price => {
          priceMap.set(price.ticker, {
            ...price,
            coingecko_id: tickerToCoinGecko.get(price.ticker)
          });
        });
        setPrices(priceMap);

        // Fetch logo URLs for all coingecko_ids
        const coingeckoIds = Array.from(new Set(
          Array.from(tickerToCoinGecko.values()).filter(id => id != null)
        ));
        
        if (coingeckoIds.length > 0) {
          fetchLogos(coingeckoIds);
        }
      }
    };

    const fetchLogos = async (coingeckoIds: string[]) => {
      try {
        const { data, error } = await supabase.functions.invoke('coingecko-logos', {
          body: { coingecko_ids: coingeckoIds }
        });

        if (error) throw error;

        if (data?.logos && mounted) {
          setLogoCache(new Map(Object.entries(data.logos)));
        }
      } catch (error) {
        console.error('Error fetching logos:', error);
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
    if (!tickerRef.current || isPaused || isHovered) return;

    let lastTimestamp = 0;

    const animate = (timestamp: number) => {
      if (!lastTimestamp) {
        lastTimestamp = timestamp;
      }

      const deltaTime = (timestamp - lastTimestamp) / 1000; // seconds
      lastTimestamp = timestamp;

      offsetRef.current += speed * deltaTime;

      if (tickerRef.current) {
        const maxScroll = tickerRef.current.scrollWidth / 2;
        if (offsetRef.current >= maxScroll) {
          offsetRef.current = 0;
        }
        tickerRef.current.style.transform = `translateX(-${offsetRef.current}px)`;
      }

      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isPaused, isHovered, speed]);

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
      <div className="container mx-auto py-2 flex items-center gap-2 md:gap-4">
          {/* Speed Control */}
          <div className="flex items-center shrink-0">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSpeedLevel((prev) => (prev + 1) % speedLevels.length)}
              className="h-7 px-2 gap-1 text-xs font-medium"
              title="Cycle speed"
            >
              <Gauge className="h-3 w-3" />
              {speedLevel + 1}x
            </Button>
          </div>

          {/* Ticker */}
          <div className="flex-1 overflow-hidden">
            <div
              ref={tickerRef}
              className="flex gap-6 whitespace-nowrap transition-opacity duration-200"
              style={{ 
                width: 'max-content',
                opacity: isHovered ? 0.7 : 1
              }}
              onMouseEnter={() => setIsHovered(true)}
              onMouseLeave={() => setIsHovered(false)}
            >
            {displayPrices.map((price, idx) => {
              const isPositive = price.change24h >= 0;
              const logoUrl = price.coingecko_id 
                ? logoCache.get(price.coingecko_id)
                : null;
              
              return (
                <div
                  key={`${price.ticker}-${idx}`}
                  className="flex items-center gap-3 hover:bg-accent/50 px-3 py-1 rounded cursor-pointer transition-colors"
                  onClick={() => navigate(`/crypto?symbol=${price.display}`)}
                  onTouchStart={(e) => {
                    if (isMobile) {
                      e.stopPropagation();
                      setIsPaused(!isPaused);
                    }
                  }}
                >
                  {logoUrl ? (
                    <img 
                      src={logoUrl} 
                      alt={price.display}
                      className="w-5 h-5 rounded-full"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  ) : (
                    <div className="w-5 h-5 rounded-full bg-muted flex items-center justify-center">
                      <span className="text-[10px] font-bold text-muted-foreground">{price.display.slice(0, 2)}</span>
                    </div>
                  )}
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
