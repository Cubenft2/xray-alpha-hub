import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from './ui/badge';
import { Gauge, Radio } from 'lucide-react';
import { Button } from './ui/button';
import { useNavigate } from 'react-router-dom';
import { useTickerMappings } from '@/hooks/useTickerMappings';
import { useIsMobile } from '@/hooks/use-mobile';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';

interface PriceData {
  ticker: string;
  display: string;
  price: number;
  change24h: number;
  updated_at: string;
  coingecko_id?: string | null;
  logo_url?: string | null;
}

type LiveStatus = 'live' | 'recovering' | 'fallback';

export function PolygonTicker() {
  const speedLevels = [20, 40, 60, 80, 100];
  const [prices, setPrices] = useState<Map<string, PriceData>>(new Map());
  const [isPaused, setIsPaused] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [speedLevel, setSpeedLevel] = useState(1);
  const [logoCache, setLogoCache] = useState<Map<string, string>>(new Map());
  const [lastUpdateTs, setLastUpdateTs] = useState<number | null>(null);
  const [liveStatus, setLiveStatus] = useState<LiveStatus>('live');
  const [fallbackMode, setFallbackMode] = useState(false);
  const [reconnectToken, setReconnectToken] = useState(0);
  const tickerRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number>();
  const offsetRef = useRef(0);
  const fallbackIntervalRef = useRef<number>();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  
  const speed = speedLevels[speedLevel];

  useEffect(() => {
    let mounted = true;

    const initializeTickers = async () => {
      const { data: tickers } = await supabase
        .from('ticker_mappings')
        .select('symbol, display_name, polygon_ticker, coingecko_id')
        .not('polygon_ticker', 'is', null)
        .eq('type', 'crypto')
        .eq('is_active', true)
        .limit(70);

      if (!tickers || !mounted) return;

      const tickerToCoinGecko = new Map<string, string | null>();
      tickers.forEach(t => {
        if (t.polygon_ticker) {
          tickerToCoinGecko.set(t.polygon_ticker, t.coingecko_id);
        }
      });

      const tickerList = tickers.map(t => t.polygon_ticker).filter(Boolean);
      
      const { data: currentPrices } = await supabase
        .from('live_prices')
        .select('*')
        .in('ticker', tickerList);

      if (currentPrices && mounted) {
        const priceMap = new Map<string, PriceData>();
        let maxUpdatedAt = 0;

        currentPrices.forEach(price => {
          priceMap.set(price.ticker, {
            ...price,
            coingecko_id: tickerToCoinGecko.get(price.ticker)
          });
          const ts = new Date(price.updated_at).getTime();
          if (ts > maxUpdatedAt) maxUpdatedAt = ts;
        });

        setPrices(priceMap);
        setLastUpdateTs(maxUpdatedAt || Date.now());

        const coingeckoIds = Array.from(new Set(
          Array.from(tickerToCoinGecko.values())
            .filter(id => id != null && id.trim().length > 0)
        ));
        
        if (coingeckoIds.length > 0) {
          fetchLogos(coingeckoIds);
        }
      }
    };

    const fetchLogos = async (coingeckoIds: string[]) => {
      try {
        // Filter out empty or invalid IDs before calling the function
        const validIds = coingeckoIds.filter(id => 
          id && 
          typeof id === 'string' && 
          id.trim().length > 0 &&
          id !== 'null' &&
          id !== 'undefined'
        );

        if (validIds.length === 0) {
          console.log('⚠️ No valid CoinGecko IDs to fetch');
          return;
        }

        console.log('📡 Calling coingecko-logos with', validIds.length, 'valid IDs');
        const { data, error } = await supabase.functions.invoke('coingecko-logos', {
          body: { coingecko_ids: validIds }
        });

        if (error) {
          console.error('❌ CoinGecko logos error:', error);
          return;
        }

        if (data?.logos && mounted) {
          console.log('✅ Logos fetched:', Object.keys(data.logos).length);
          setLogoCache(new Map(Object.entries(data.logos)));
        }
      } catch (error) {
        console.error('💥 Logos fetch exception:', error);
      }
    };

    initializeTickers();

    // Subscribe to realtime updates with reconnect token
    const channel = supabase
      .channel(`polygon-ticker-updates-${reconnectToken}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'live_prices'
        },
        (payload) => {
          if (!mounted || !payload.new) return;
          
          const newPrice = payload.new as PriceData;
          const newTs = new Date(newPrice.updated_at).getTime();

          // Ignore stale updates
          if (lastUpdateTs && newTs < lastUpdateTs) return;
          
          setPrices(prev => {
            const updated = new Map(prev);
            updated.set(newPrice.ticker, newPrice);
            return updated;
          });

          setLastUpdateTs(newTs);
          setLiveStatus('live');
          
          // Stop fallback if it was active
          if (fallbackMode) {
            setFallbackMode(false);
            if (fallbackIntervalRef.current) {
              clearInterval(fallbackIntervalRef.current);
              fallbackIntervalRef.current = undefined;
            }
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('✅ PolygonTicker subscribed to live_prices');
        } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
          console.warn('⚠️ PolygonTicker channel issue, reconnecting...');
          setReconnectToken(prev => prev + 1);
        }
      });

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
      if (fallbackIntervalRef.current) {
        clearInterval(fallbackIntervalRef.current);
      }
    };
  }, [reconnectToken]);

  // Staleness detection and auto-recovery
  useEffect(() => {
    const stalenessCheck = setInterval(() => {
      if (!lastUpdateTs) return;

      const now = Date.now();
      const delta = (now - lastUpdateTs) / 1000; // seconds

      if (delta > 30) {
        // Critical staleness: enter fallback mode
        setLiveStatus('fallback');
        if (!fallbackMode) {
          console.warn('🔴 Stream stale >30s, entering fallback polling mode');
          setFallbackMode(true);
          startFallbackPolling();
        }
      } else if (delta > 10) {
        // Moderate staleness: recovering
        if (liveStatus !== 'recovering') {
          console.warn('🟡 Stream stale >10s, attempting recovery');
          setLiveStatus('recovering');
        }
      } else {
        // Fresh data
        if (liveStatus !== 'live') {
          setLiveStatus('live');
          if (fallbackMode) {
            setFallbackMode(false);
            if (fallbackIntervalRef.current) {
              clearInterval(fallbackIntervalRef.current);
              fallbackIntervalRef.current = undefined;
            }
          }
        }
      }
    }, 2000); // Check every 2 seconds

    return () => clearInterval(stalenessCheck);
  }, [lastUpdateTs, liveStatus, fallbackMode]);

  // Fallback polling: direct fetch from polygon-crypto-prices
  const startFallbackPolling = () => {
    if (fallbackIntervalRef.current) return; // Already polling

    const pollDirectQuotes = async () => {
      try {
        const tickerList = Array.from(prices.keys()).slice(0, 60); // Limit to 60 for performance
        if (tickerList.length === 0) return;

        // Parse polygon tickers to symbols for direct API call
        const symbols = tickerList
          .filter(t => t.startsWith('X:') && t.endsWith('USD'))
          .map(t => t.replace('X:', '').replace('USD', ''))
          .filter(s => s.length > 0);

        if (symbols.length === 0) return;

        const { data, error } = await supabase.functions.invoke('polygon-crypto-prices', {
          body: { symbols }
        });

        if (error || !data?.prices) {
          console.error('❌ Fallback polling failed:', error);
          return;
        }

        setPrices(prev => {
          const updated = new Map(prev);
          data.prices.forEach((p: any) => {
            const polygonTicker = `X:${p.symbol}USD`;
            const existing = prev.get(polygonTicker);
            if (existing) {
              updated.set(polygonTicker, {
                ...existing,
                price: p.price,
                updated_at: new Date().toISOString()
              });
            }
          });
          return updated;
        });

        setLastUpdateTs(Date.now());
        console.log('🔄 Fallback polling updated', data.prices.length, 'prices');
      } catch (err) {
        console.error('💥 Fallback polling exception:', err);
      }
    };

    pollDirectQuotes(); // Initial call
    fallbackIntervalRef.current = window.setInterval(pollDirectQuotes, 2000);
  };

  // Smooth scrolling animation
  useEffect(() => {
    if (!tickerRef.current || isPaused || isHovered) return;

    let lastTimestamp = 0;

    const animate = (timestamp: number) => {
      if (!lastTimestamp) {
        lastTimestamp = timestamp;
      }

      const deltaTime = (timestamp - lastTimestamp) / 1000;
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

  // Tab focus recovery
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('👀 Tab regained focus, forcing reconnect');
        setReconnectToken(prev => prev + 1);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  const priceArray = Array.from(prices.values());
  const displayPrices = [...priceArray, ...priceArray];

  const formatPrice = (price: number) => {
    if (price >= 1000) return `$${price.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
    if (price >= 1) return `$${price.toFixed(2)}`;
    if (price >= 0.01) return `$${price.toFixed(4)}`;
    return `$${price.toFixed(6)}`;
  };

  const getStatusBadge = () => {
    const now = Date.now();
    const delta = lastUpdateTs ? Math.floor((now - lastUpdateTs) / 1000) : 0;

    switch (liveStatus) {
      case 'live':
        return (
          <Badge variant="default" className="bg-green-600 hover:bg-green-600 gap-1 animate-pulse">
            <Radio className="h-3 w-3" />
            LIVE
          </Badge>
        );
      case 'recovering':
        return (
          <Badge variant="secondary" className="bg-amber-600 hover:bg-amber-600 gap-1">
            <Radio className="h-3 w-3" />
            RECOVERING
          </Badge>
        );
      case 'fallback':
        return (
          <Badge variant="destructive" className="gap-1">
            <Radio className="h-3 w-3" />
            FALLBACK
          </Badge>
        );
    }
  };

  return (
    <TooltipProvider>
      <div className="relative bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-y overflow-hidden">
        <div className="container mx-auto py-2 flex items-center gap-2 md:gap-4">
          {/* Status Badge */}
          <div className="flex items-center shrink-0">
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="cursor-help">
                  {getStatusBadge()}
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-xs">
                  {lastUpdateTs 
                    ? `Last update: ${Math.floor((Date.now() - lastUpdateTs) / 1000)}s ago`
                    : 'Connecting...'}
                </p>
                {liveStatus === 'fallback' && (
                  <p className="text-xs text-amber-400 mt-1">Polling direct quotes (stream stale)</p>
                )}
              </TooltipContent>
            </Tooltip>
          </div>

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
    </TooltipProvider>
  );
}
