import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface PriceData {
  symbol: string;
  price: number;
  change24h: number;
  timestamp: number;
}

interface PolygonTrade {
  ev: string;
  sym: string;
  p: number;
  s: number;
  t: number;
  x: number;
}

type ConnectionStatus = 'connecting' | 'live' | 'recovering' | 'fallback';

export function usePolygonWebSocket(symbols: string[]) {
  const [prices, setPrices] = useState<Record<string, PriceData>>({});
  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const [lastUpdate, setLastUpdate] = useState<number>(0);
  
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const fallbackIntervalRef = useRef<NodeJS.Timeout>();
  const healthCheckIntervalRef = useRef<NodeJS.Timeout>();
  const priceBufferRef = useRef<Record<string, PriceData>>({});
  const reconnectAttemptsRef = useRef(0);
  const apiKeyRef = useRef<string | null>(null);

  // Fetch API key once
  const fetchApiKey = useCallback(async () => {
    if (apiKeyRef.current) return apiKeyRef.current;
    
    try {
      const { data, error } = await supabase.functions.invoke('get-polygon-key');
      if (error) throw error;
      apiKeyRef.current = data.key;
      return data.key;
    } catch (error) {
      console.error('Failed to fetch Polygon API key:', error);
      return null;
    }
  }, []);

  // Normalize Polygon symbol to display symbol
  const normalizeSymbol = (polygonSym: string): string => {
    // X:BTCUSD -> BTC
    return polygonSym.replace(/^X:/, '').replace(/USD$/, '');
  };

  // Convert display symbol to Polygon channel
  const toPolygonChannel = (symbol: string): string => {
    return `XT.X:${symbol}-USD`;
  };

  // Start fallback polling
  const startFallbackPolling = useCallback(async () => {
    if (fallbackIntervalRef.current) return;
    
    console.log('🔄 Starting fallback polling...');
    setStatus('fallback');

    const poll = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('polygon-crypto-prices', {
          body: { symbols }
        });

        if (error) throw error;

        if (data?.prices) {
          const now = Date.now();
          const updates: Record<string, PriceData> = {};
          
          data.prices.forEach((p: any) => {
            updates[p.symbol] = {
              symbol: p.symbol,
              price: p.price,
              change24h: 0, // Polygon doesn't provide 24h change in this endpoint
              timestamp: now
            };
          });

          setPrices(prev => ({ ...prev, ...updates }));
          setLastUpdate(now);
        }
      } catch (error) {
        console.error('Fallback polling error:', error);
      }
    };

    poll(); // Initial poll
    fallbackIntervalRef.current = setInterval(poll, 2000);
  }, [symbols]);

  // Stop fallback polling
  const stopFallbackPolling = useCallback(() => {
    if (fallbackIntervalRef.current) {
      clearInterval(fallbackIntervalRef.current);
      fallbackIntervalRef.current = undefined;
      console.log('✅ Stopped fallback polling');
    }
  }, []);

  // Connect to Polygon WebSocket
  const connect = useCallback(async () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const apiKey = await fetchApiKey();
    if (!apiKey) {
      console.error('Cannot connect: no API key');
      startFallbackPolling();
      return;
    }

    try {
      setStatus('connecting');
      const ws = new WebSocket('wss://socket.polygon.io/crypto');
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('🔌 WebSocket connected to Polygon');
        
        // Authenticate
        ws.send(JSON.stringify({
          action: 'auth',
          params: apiKey
        }));

        // Subscribe to channels
        const channels = symbols.map(toPolygonChannel).join(',');
        ws.send(JSON.stringify({
          action: 'subscribe',
          params: channels
        }));

        reconnectAttemptsRef.current = 0;
        stopFallbackPolling();
        setStatus('live');
        console.log('✅ Subscribed to', symbols.length, 'channels');
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          const now = Date.now();
          
          // Handle both single message and array of messages
          const messages = Array.isArray(data) ? data : [data];
          
          messages.forEach((msg: any) => {
            if (msg.ev === 'status') {
              console.log('📡 Polygon status:', msg.message);
              if (msg.status === 'auth_success') {
                setStatus('live');
              }
              return;
            }

            if (msg.ev === 'T') {
              // Trade event
              const trade = msg as PolygonTrade;
              const symbol = normalizeSymbol(trade.sym);
              
              priceBufferRef.current[symbol] = {
                symbol,
                price: trade.p,
                change24h: 0, // Calculate from previous price if needed
                timestamp: now
              };
            }
          });

          // Batch update prices using requestAnimationFrame
          requestAnimationFrame(() => {
            if (Object.keys(priceBufferRef.current).length > 0) {
              setPrices(prev => ({ ...prev, ...priceBufferRef.current }));
              setLastUpdate(now);
              priceBufferRef.current = {};
            }
          });

        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      ws.onerror = (error) => {
        console.error('❌ WebSocket error:', error);
        setStatus('recovering');
      };

      ws.onclose = () => {
        console.log('🔌 WebSocket closed');
        wsRef.current = null;
        
        // Exponential backoff reconnection
        const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000);
        reconnectAttemptsRef.current++;
        
        setStatus('recovering');
        
        reconnectTimeoutRef.current = setTimeout(() => {
          console.log(`🔄 Reconnecting (attempt ${reconnectAttemptsRef.current})...`);
          connect();
        }, delay);
      };

    } catch (error) {
      console.error('Failed to create WebSocket:', error);
      startFallbackPolling();
    }
  }, [symbols, fetchApiKey, startFallbackPolling, stopFallbackPolling]);

  // Health check: switch to fallback if no updates
  useEffect(() => {
    healthCheckIntervalRef.current = setInterval(() => {
      const now = Date.now();
      const timeSinceUpdate = now - lastUpdate;
      
      if (timeSinceUpdate > 10000 && status === 'live') {
        console.warn('⚠️ No updates for 10s, switching to fallback...');
        startFallbackPolling();
      } else if (timeSinceUpdate < 5000 && status === 'fallback') {
        console.log('✅ WebSocket recovered, stopping fallback');
        stopFallbackPolling();
        setStatus('live');
      }
    }, 5000);

    return () => {
      if (healthCheckIntervalRef.current) {
        clearInterval(healthCheckIntervalRef.current);
      }
    };
  }, [lastUpdate, status, startFallbackPolling, stopFallbackPolling]);

  // Initial connection
  useEffect(() => {
    connect();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      stopFallbackPolling();
      if (healthCheckIntervalRef.current) {
        clearInterval(healthCheckIntervalRef.current);
      }
    };
  }, [connect, stopFallbackPolling]);

  return {
    prices,
    status,
    lastUpdate
  };
}
