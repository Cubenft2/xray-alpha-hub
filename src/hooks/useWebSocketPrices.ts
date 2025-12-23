import { useState, useEffect, useRef, useCallback, useMemo } from 'react';

const WS_URL = 'wss://crypto-stream.xrprat.workers.dev';

export interface PriceUpdate {
  symbol: string;
  price: number;
  bid: number;
  ask: number;
  timestamp: number;
  change24h?: number;
  volume?: number;
  previousPrice?: number;
}

export interface UseWebSocketPricesOptions {
  symbols: string[];
  enabled?: boolean;
  onPriceUpdate?: (update: PriceUpdate) => void;
}

export interface UseWebSocketPricesReturn {
  prices: Record<string, PriceUpdate>;
  isConnected: boolean;
  error: string | null;
  subscribe: (symbols: string[]) => void;
  unsubscribe: (symbols: string[]) => void;
  messageCount: number;
  lastUpdateTime: number | null;
}

// Convert symbol to Polygon pair format
const symbolToPair = (symbol: string): string => {
  const s = symbol.toUpperCase();
  return s.includes('-') ? s : `${s}-USD`;
};

// Extract symbol from pair
const pairToSymbol = (pair: string): string => {
  return pair.split('-')[0].toUpperCase();
};

export function useWebSocketPrices({
  symbols,
  enabled = true,
  onPriceUpdate,
}: UseWebSocketPricesOptions): UseWebSocketPricesReturn {
  const [prices, setPrices] = useState<Record<string, PriceUpdate>>({});
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [messageCount, setMessageCount] = useState(0);
  const [lastUpdateTime, setLastUpdateTime] = useState<number | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const subscribedSymbolsRef = useRef<Set<string>>(new Set());
  const pendingUpdatesRef = useRef<Map<string, PriceUpdate>>(new Map());
  const batchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const onPriceUpdateRef = useRef(onPriceUpdate);

  // Keep callback ref updated
  useEffect(() => {
    onPriceUpdateRef.current = onPriceUpdate;
  }, [onPriceUpdate]);

  // Calculate reconnect delay with exponential backoff
  const getReconnectDelay = useCallback(() => {
    const baseDelay = 1000;
    const maxDelay = 30000;
    const delay = Math.min(baseDelay * Math.pow(2, reconnectAttemptsRef.current), maxDelay);
    return delay;
  }, []);

  // Flush batched updates
  const flushUpdates = useCallback(() => {
    if (pendingUpdatesRef.current.size === 0) return;

    const updates = new Map(pendingUpdatesRef.current);
    pendingUpdatesRef.current.clear();

    setPrices(prev => {
      const next = { ...prev };
      updates.forEach((update, symbol) => {
        // Store previous price for flash animation
        if (prev[symbol]) {
          update.previousPrice = prev[symbol].price;
        }
        next[symbol] = update;
        
        // Call callback for each update
        if (onPriceUpdateRef.current) {
          onPriceUpdateRef.current(update);
        }
      });
      return next;
    });

    setLastUpdateTime(Date.now());
  }, []);

  // Queue update with batching (100ms debounce)
  const queueUpdate = useCallback((update: PriceUpdate) => {
    pendingUpdatesRef.current.set(update.symbol, update);
    setMessageCount(c => c + 1);

    if (batchTimeoutRef.current) {
      clearTimeout(batchTimeoutRef.current);
    }

    batchTimeoutRef.current = setTimeout(flushUpdates, 100);
  }, [flushUpdates]);

  // Send subscription message
  const sendSubscription = useCallback((action: 'subscribe' | 'unsubscribe', syms: string[]) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      console.warn('[WS] Cannot send subscription, socket not open');
      return;
    }

    const pairs = syms.map(symbolToPair).join(',');
    const params = syms.map(s => `XA.${symbolToPair(s)}`).join(',');
    
    const message = {
      action,
      params,
    };

    console.log(`[WS] ${action}:`, params);
    wsRef.current.send(JSON.stringify(message));

    // Track subscribed symbols
    syms.forEach(s => {
      const symbol = s.toUpperCase();
      if (action === 'subscribe') {
        subscribedSymbolsRef.current.add(symbol);
      } else {
        subscribedSymbolsRef.current.delete(symbol);
      }
    });
  }, []);

  // Public subscribe function
  const subscribe = useCallback((syms: string[]) => {
    const newSymbols = syms.filter(s => !subscribedSymbolsRef.current.has(s.toUpperCase()));
    if (newSymbols.length > 0) {
      sendSubscription('subscribe', newSymbols);
    }
  }, [sendSubscription]);

  // Public unsubscribe function
  const unsubscribe = useCallback((syms: string[]) => {
    const existingSymbols = syms.filter(s => subscribedSymbolsRef.current.has(s.toUpperCase()));
    if (existingSymbols.length > 0) {
      sendSubscription('unsubscribe', existingSymbols);
    }
  }, [sendSubscription]);

  // Handle incoming WebSocket message
  const handleMessage = useCallback((event: MessageEvent) => {
    try {
      const data = JSON.parse(event.data);
      
      // Handle array of messages
      const messages = Array.isArray(data) ? data : [data];
      
      for (const msg of messages) {
        // Check for crypto aggregate event
        if (msg.ev === 'XA' && msg.pair) {
          const symbol = pairToSymbol(msg.pair);
          
          const update: PriceUpdate = {
            symbol,
            price: msg.p || msg.c || 0,
            bid: msg.bp || msg.p || 0,
            ask: msg.ap || msg.p || 0,
            timestamp: msg.t || Date.now(),
            volume: msg.v,
            change24h: msg.dp, // Daily change percent if available
          };

          queueUpdate(update);
        } else if (msg.ev === 'status') {
          console.log('[WS] Status:', msg.message);
        } else if (msg.status === 'error') {
          console.warn('[WS] Error:', msg.message);
        }
      }
    } catch (err) {
      console.error('[WS] Failed to parse message:', err);
    }
  }, [queueUpdate]);

  // Start heartbeat ping
  const startHeartbeat = useCallback(() => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
    }

    heartbeatIntervalRef.current = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ action: 'ping' }));
      }
    }, 30000);
  }, []);

  // Stop heartbeat
  const stopHeartbeat = useCallback(() => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }
  }, []);

  // Connect to WebSocket
  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    console.log('[WS] Connecting to', WS_URL);
    setError(null);

    try {
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('[WS] Connected');
        setIsConnected(true);
        setError(null);
        reconnectAttemptsRef.current = 0;
        startHeartbeat();

        // Re-subscribe to all symbols
        if (symbols.length > 0) {
          sendSubscription('subscribe', symbols);
        }
      };

      ws.onmessage = handleMessage;

      ws.onclose = (event) => {
        console.log('[WS] Disconnected:', event.code, event.reason);
        setIsConnected(false);
        stopHeartbeat();

        // Auto-reconnect if enabled
        if (enabled) {
          const delay = getReconnectDelay();
          reconnectAttemptsRef.current++;
          console.log(`[WS] Reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current})`);
          
          reconnectTimeoutRef.current = setTimeout(connect, delay);
        }
      };

      ws.onerror = (event) => {
        console.error('[WS] Error:', event);
        setError('Connection error - will retry');
      };
    } catch (err) {
      console.error('[WS] Failed to create WebSocket:', err);
      setError('Failed to connect');
    }
  }, [enabled, symbols, handleMessage, startHeartbeat, stopHeartbeat, getReconnectDelay, sendSubscription]);

  // Disconnect from WebSocket
  const disconnect = useCallback(() => {
    console.log('[WS] Disconnecting');
    
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    stopHeartbeat();

    if (wsRef.current) {
      wsRef.current.close(1000, 'Client disconnect');
      wsRef.current = null;
    }

    setIsConnected(false);
    subscribedSymbolsRef.current.clear();
  }, [stopHeartbeat]);

  // Connect/disconnect based on enabled state
  useEffect(() => {
    if (enabled && symbols.length > 0) {
      connect();
    } else {
      disconnect();
    }

    return () => {
      disconnect();
      if (batchTimeoutRef.current) {
        clearTimeout(batchTimeoutRef.current);
      }
    };
  }, [enabled, connect, disconnect]);

  // Handle symbol changes (subscribe to new, unsubscribe from removed)
  useEffect(() => {
    if (!isConnected) return;

    const currentSymbols = new Set(symbols.map(s => s.toUpperCase()));
    const subscribedSymbols = subscribedSymbolsRef.current;

    // Find new symbols to subscribe
    const toSubscribe = symbols.filter(s => !subscribedSymbols.has(s.toUpperCase()));
    
    // Find symbols to unsubscribe
    const toUnsubscribe = Array.from(subscribedSymbols).filter(s => !currentSymbols.has(s));

    if (toUnsubscribe.length > 0) {
      sendSubscription('unsubscribe', toUnsubscribe);
    }

    if (toSubscribe.length > 0) {
      sendSubscription('subscribe', toSubscribe);
    }
  }, [symbols, isConnected, sendSubscription]);

  // Memoize return value
  const result = useMemo<UseWebSocketPricesReturn>(() => ({
    prices,
    isConnected,
    error,
    subscribe,
    unsubscribe,
    messageCount,
    lastUpdateTime,
  }), [prices, isConnected, error, subscribe, unsubscribe, messageCount, lastUpdateTime]);

  return result;
}
