import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Gauge, Radio } from 'lucide-react';
import { Button } from './ui/button';
import { useNavigate } from 'react-router-dom';
import { useIsMobile } from '@/hooks/use-mobile';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';
import { usePolygonWebSocket } from '@/hooks/usePolygonWebSocket';

interface DisplayPriceData {
  symbol: string;
  displayName: string;
  price: number;
  change24h: number;
  coingecko_id?: string | null;
  logo_url?: string | null;
}

export function PolygonTicker() {
  const speedLevels = [20, 40, 60, 80, 100];
  const [displayPrices, setDisplayPrices] = useState<DisplayPriceData[]>([]);
  const [isPaused, setIsPaused] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [speedLevel, setSpeedLevel] = useState(1);
  const [logoCache, setLogoCache] = useState<Map<string, string>>(new Map());
  const [symbols, setSymbols] = useState<string[]>([]);
  const [symbolMetadata, setSymbolMetadata] = useState<Map<string, { displayName: string; coingecko_id: string | null }>>(new Map());
  
  const tickerRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number>();
  const offsetRef = useRef(0);
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  
  const speed = speedLevels[speedLevel];

  // Load ticker mappings to get symbols
  useEffect(() => {
    const loadSymbols = async () => {
      const { data: tickers } = await supabase
        .from('ticker_mappings')
        .select('symbol, display_name, coingecko_id')
        .eq('type', 'crypto')
        .eq('is_active', true)
        .limit(60);

      if (!tickers) return;

      const symbolList = tickers.map(t => t.symbol);
      const metadata = new Map(
        tickers.map(t => [t.symbol, { displayName: t.display_name, coingecko_id: t.coingecko_id }])
      );

      setSymbols(symbolList);
      setSymbolMetadata(metadata);

      // Fetch logos
      const coingeckoIds = tickers
        .map(t => t.coingecko_id)
        .filter(id => id && id.trim().length > 0) as string[];

      if (coingeckoIds.length > 0) {
        fetchLogos(coingeckoIds);
      }
    };

    loadSymbols();
  }, []);

  const fetchLogos = async (coingeckoIds: string[]) => {
    try {
      const { data, error } = await supabase.functions.invoke('coingecko-logos', {
        body: { coingecko_ids: coingeckoIds }
      });

      if (error || !data?.logos) return;
      setLogoCache(new Map(Object.entries(data.logos)));
    } catch (error) {
      console.error('Logo fetch error:', error);
    }
  };

  // Use WebSocket hook
  const { prices: wsPrices, status, lastUpdate } = usePolygonWebSocket(symbols);

  // Transform WebSocket prices to display format
  useEffect(() => {
    const priceArray = Object.entries(wsPrices).map(([symbol, priceData]) => {
      const meta = symbolMetadata.get(symbol);
      return {
        symbol,
        displayName: meta?.displayName || symbol,
        price: priceData.price,
        change24h: priceData.change24h,
        coingecko_id: meta?.coingecko_id,
        logo_url: meta?.coingecko_id ? logoCache.get(meta.coingecko_id) : undefined
      };
    });

    setDisplayPrices([...priceArray, ...priceArray]); // Duplicate for seamless loop
  }, [wsPrices, symbolMetadata, logoCache]);

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

  const formatPrice = (price: number) => {
    if (price >= 1000) return `$${price.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
    if (price >= 1) return `$${price.toFixed(2)}`;
    if (price >= 0.01) return `$${price.toFixed(4)}`;
    return `$${price.toFixed(6)}`;
  };

  const getStatusBadge = () => {
    switch (status) {
      case 'live':
        return (
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-green-600/20">
            <Radio className="h-4 w-4 text-green-500 animate-pulse" />
          </div>
        );
      case 'recovering':
      case 'connecting':
        return (
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-amber-600/20">
            <Radio className="h-4 w-4 text-amber-500" />
          </div>
        );
      case 'fallback':
        return (
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-red-600/20">
            <Radio className="h-4 w-4 text-red-500" />
          </div>
        );
    }
  };

  return (
    <TooltipProvider>
      <div className="relative bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-y overflow-hidden">
        <div className="container mx-auto py-2 flex items-center gap-2 md:gap-4">
          {/* Status Indicator */}
          <div className="flex items-center shrink-0">
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="cursor-help">
                  {getStatusBadge()}
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-xs font-semibold">
                  {status === 'live' && 'STREAMING LIVE'}
                  {status === 'connecting' && 'CONNECTING...'}
                  {status === 'recovering' && 'RECOVERING...'}
                  {status === 'fallback' && 'FALLBACK MODE'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {lastUpdate 
                    ? `Updated ${Math.floor((Date.now() - lastUpdate) / 1000)}s ago`
                    : 'Connecting...'}
                </p>
                {status === 'fallback' && (
                  <p className="text-xs text-amber-400 mt-1">Polling every 2s</p>
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
                const logoUrl = price.logo_url;
                
                return (
                  <div
                    key={`${price.symbol}-${idx}`}
                    className="flex items-center gap-3 hover:bg-accent/50 px-3 py-1 rounded cursor-pointer transition-colors"
                    onClick={() => navigate(`/crypto?symbol=${price.displayName}`)}
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
                        alt={price.displayName}
                        className="w-5 h-5 rounded-full"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    ) : (
                      <div className="w-5 h-5 rounded-full bg-muted flex items-center justify-center">
                        <span className="text-[10px] font-bold text-muted-foreground">{price.symbol.slice(0, 2)}</span>
                      </div>
                    )}
                    <span className="font-semibold text-sm">{price.symbol}</span>
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
