import React, { useState, useEffect, memo } from 'react';
import { useTheme } from 'next-themes';

interface TickerItem {
  ticker: string;
  display: string;
  price: number;
  change24h: number;
  timestamp: number;
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
  const [status, setStatus] = useState<'connecting' | 'connected' | 'reconnecting' | 'error'>('connecting');
  const { theme } = useTheme();
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    let ws: WebSocket | null = null;
    let reconnectTimeout: NodeJS.Timeout;
    let reconnectAttempts = 0;
    const maxReconnectAttempts = 5;

    const connect = () => {
      try {
        setStatus(reconnectAttempts > 0 ? 'reconnecting' : 'connecting');
        
        ws = new WebSocket('wss://odncvfiuzliyohxrsigc.supabase.co/functions/v1/polygon-ticker-stream');
        
        ws.onopen = () => {
          console.log('Polygon ticker WebSocket connected');
          setStatus('connected');
          reconnectAttempts = 0;
        };
        
        ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            
            if (message.type === 'snapshot') {
              setTickers(message.data || []);
            } else if (message.type === 'price_update') {
              setTickers(prev => 
                prev.map(t => t.ticker === message.data.ticker ? message.data : t)
              );
            } else if (message.type === 'status') {
              setStatus(message.status);
            }
          } catch (error) {
            console.error('Error parsing WebSocket message:', error);
          }
        };
        
        ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          setStatus('error');
        };
        
        ws.onclose = () => {
          console.log('WebSocket closed');
          
          if (reconnectAttempts < maxReconnectAttempts) {
            const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 10000);
            reconnectAttempts++;
            console.log(`Reconnecting in ${delay}ms (attempt ${reconnectAttempts}/${maxReconnectAttempts})`);
            
            reconnectTimeout = setTimeout(() => {
              connect();
            }, delay);
          } else {
            setStatus('error');
          }
        };
      } catch (error) {
        console.error('Error connecting to WebSocket:', error);
        setStatus('error');
      }
    };

    connect();

    return () => {
      if (ws) {
        ws.close();
      }
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
      }
    };
  }, []);

  // Duplicate tickers for infinite scroll effect
  const displayTickers = tickers.length > 0 ? [...tickers, ...tickers] : [];

  return (
    <div className="ticker-tape-container relative overflow-hidden bg-background/95 backdrop-blur-sm border-b border-border">
      {status === 'connecting' && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/50 z-10">
          <span className="text-muted-foreground text-sm animate-pulse">Connecting to live data...</span>
        </div>
      )}
      
      {status === 'error' && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/50 z-10">
          <span className="text-destructive text-sm">Connection error. Retrying...</span>
        </div>
      )}
      
      {status === 'reconnecting' && (
        <div className="absolute top-2 right-2 z-10">
          <span className="text-yellow-500 text-xs">Reconnecting...</span>
        </div>
      )}
      
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
