import { useState, useEffect, useRef, useCallback, useMemo } from 'react';

const WS_URL = 'wss://crypto-stream.xrprat.workers.dev/ws';
const REST_URL = 'https://crypto-stream.xrprat.workers.dev/prices';
const MAX_RECONNECT_ATTEMPTS = 10;

export interface PriceUpdate {
  symbol: string;
  price: number;
  bid: number;
  ask: number;
  timestamp: number;
  change24h?: number;
  volume?: number;
  previousPrice?: number;
  // OHLC data from Worker
  open?: number;
  high?: number;
  low?: number;
  close?: number;
  vwap?: number;
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
  isFallbackMode: boolean;
  priceCount: number;
}

// Extract symbol from Worker format (e.g., "X:BTCUSD" -> "BTC")
const parseWorkerSymbol = (symbol: string): string => {
  return symbol.replace('X:', '').replace('USD', '').toUpperCase();
};

// Calculate 24h change from open/close
const calculateChange24h = (open?: number, close?: number): number | undefined => {
  if (!open || !close || open === 0) return undefined;
  return ((close - open) / open) * 100;
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
  const [isFallbackMode, setIsFallbackMode] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const fallbackIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastWsUpdateRef = useRef<number>(Date.now());
  const reconnectAttemptsRef = useRef(0);
  const subscribedSymbolsRef = useRef<Set<string>>(new Set());
  const pendingUpdatesRef = useRef<Map<string, PriceUpdate>>(new Map());
  const batchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const onPriceUpdateRef = useRef(onPriceUpdate);
  const symbolsRef = useRef<string[]>(symbols);
  const enabledRef = useRef(enabled);
  const isConnectingRef = useRef(false);
  const isMountedRef = useRef(true);

  // Keep refs updated
  useEffect(() => {
    onPriceUpdateRef.current = onPriceUpdate;
  }, [onPriceUpdate]);

  useEffect(() => {
    symbolsRef.current = symbols;
  }, [symbols]);

  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);

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

  // Stop heartbeat
  const stopHeartbeat = useCallback(() => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }
  }, []);

  // Cleanup all timers
  const cleanupAll = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (batchTimeoutRef.current) {
      clearTimeout(batchTimeoutRef.current);
      batchTimeoutRef.current = null;
    }
    if (fallbackIntervalRef.current) {
      clearInterval(fallbackIntervalRef.current);
      fallbackIntervalRef.current = null;
    }
    stopHeartbeat();
  }, [stopHeartbeat]);

  // Send subscription message
  const sendSubscription = useCallback((action: 'subscribe' | 'unsubscribe', syms: string[]) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      return;
    }

    const message = {
      action,
      symbols: syms.map(s => s.toUpperCase()),
    };

    console.log(`[WS] ${action}:`, message.symbols);
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
        // Handle price updates from Worker
        if (msg.type === 'price' && msg.symbol) {
          const symbol = parseWorkerSymbol(msg.symbol);
          
          // Update last WS update time for fallback detection
          lastWsUpdateRef.current = Date.now();
          if (isFallbackMode) {
            setIsFallbackMode(false);
          }
          
          const update: PriceUpdate = {
            symbol,
            price: msg.price || msg.close || 0,
            bid: msg.price || 0,
            ask: msg.price || 0,
            timestamp: msg.timestamp || Date.now(),
            volume: msg.volume,
            change24h: calculateChange24h(msg.open, msg.close),
            open: msg.open,
            high: msg.high,
            low: msg.low,
            close: msg.close,
            vwap: msg.vwap,
          };

          queueUpdate(update);
        } 
        // Handle connection confirmation
        else if (msg.type === 'connected') {
          console.log('[WS] Connected:', msg.message);
        } 
        // Handle subscription confirmation
        else if (msg.type === 'subscribed') {
          console.log('[WS] Subscribed to:', msg.symbols);
        }
        // Handle errors
        else if (msg.type === 'error' || msg.status === 'error') {
          console.warn('[WS] Error:', msg.message);
        }
      }
    } catch (err) {
      console.error('[WS] Failed to parse message:', err);
    }
  }, [queueUpdate, isFallbackMode]);

  // Start heartbeat ping
  const startHeartbeat = useCallback(() => {
    stopHeartbeat();

    heartbeatIntervalRef.current = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ action: 'ping' }));
      }
    }, 30000);
  }, [stopHeartbeat]);

  // REST snapshot (also used for fallback)
  const fetchRestPrices = useCallback(async () => {
    try {
      const response = await fetch(REST_URL);
      if (!response.ok) return;

      const data: any = await response.json();
      const workerPrices: Record<string, any> =
        data && typeof data === 'object' && 'prices' in data ? data.prices : data;

      if (!workerPrices || typeof workerPrices !== 'object') return;

      Object.entries(workerPrices).forEach(([workerSymbol, priceData]) => {
        if (!priceData) return;
        const symbol = parseWorkerSymbol(workerSymbol);
        const px = priceData.price ?? priceData.close;
        if (px == null) return;

        const update: PriceUpdate = {
          symbol,
          price: Number(px),
          bid: Number(px),
          ask: Number(px),
          timestamp: priceData.timestamp || Date.now(),
          volume: priceData.volume,
          change24h: calculateChange24h(priceData.open, priceData.close),
          open: priceData.open,
          high: priceData.high,
          low: priceData.low,
          close: priceData.close,
          vwap: priceData.vwap,
        };

        queueUpdate(update);
      });
    } catch (err) {
      console.warn('[WS] REST snapshot failed:', err);
    }
  }, [queueUpdate]);


  // Connect to WebSocket
  const connect = useCallback(() => {
    // Prevent multiple simultaneous connection attempts
    if (isConnectingRef.current) {
      return;
    }

    if (wsRef.current?.readyState === WebSocket.OPEN || wsRef.current?.readyState === WebSocket.CONNECTING) {
      return;
    }

    // Check if we've exceeded max reconnection attempts
    if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) {
      console.log('[WS] Max reconnection attempts reached, switching to fallback');
      setError('Max reconnection attempts reached');
      setIsFallbackMode(true);
      return;
    }

    isConnectingRef.current = true;
    console.log('[WS] Connecting to', WS_URL);
    setError(null);

    try {
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!isMountedRef.current) return;
        
        console.log('[WS] Connected');
        isConnectingRef.current = false;
        setIsConnected(true);
        setError(null);
        setIsFallbackMode(false);
        reconnectAttemptsRef.current = 0;
        lastWsUpdateRef.current = Date.now();
        startHeartbeat();

        // Subscribe to current symbols
        const currentSymbols = symbolsRef.current;
        if (currentSymbols.length > 0) {
          sendSubscription('subscribe', currentSymbols);
        }
      };

      ws.onmessage = handleMessage;

      ws.onclose = (event) => {
        if (!isMountedRef.current) return;
        
        console.log('[WS] Disconnected:', event.code, event.reason);
        isConnectingRef.current = false;
        setIsConnected(false);
        stopHeartbeat();

        // Only auto-reconnect if enabled and within limits
        if (enabledRef.current && reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
          reconnectAttemptsRef.current++;
          const delay = getReconnectDelay();
          console.log(`[WS] Reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current}/${MAX_RECONNECT_ATTEMPTS})`);
          
          // Clear any existing timeout before setting a new one
          if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
          }
          reconnectTimeoutRef.current = setTimeout(connect, delay);
        } else if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) {
          console.log('[WS] Max attempts reached, using REST fallback');
          setIsFallbackMode(true);
        }
      };

      ws.onerror = () => {
        if (!isMountedRef.current) return;
        console.error('[WS] Connection error');
        setError('Connection error');
        isConnectingRef.current = false;
      };
    } catch (err) {
      console.error('[WS] Failed to create WebSocket:', err);
      setError('Failed to connect');
      isConnectingRef.current = false;
    }
  }, [handleMessage, startHeartbeat, stopHeartbeat, getReconnectDelay, sendSubscription]);

  // Disconnect from WebSocket
  const disconnect = useCallback(() => {
    console.log('[WS] Disconnecting');
    cleanupAll();

    if (wsRef.current) {
      // Remove handlers to prevent reconnection attempts
      wsRef.current.onclose = null;
      wsRef.current.onerror = null;
      wsRef.current.onmessage = null;
      wsRef.current.onopen = null;
      
      if (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING) {
        wsRef.current.close(1000, 'Client disconnect');
      }
      wsRef.current = null;
    }

    isConnectingRef.current = false;
    setIsConnected(false);
    subscribedSymbolsRef.current.clear();
  }, [cleanupAll]);

  // Main connection effect - only runs on mount/unmount and enabled changes
  useEffect(() => {
    isMountedRef.current = true;

    if (enabled && symbols.length > 0) {
      reconnectAttemptsRef.current = 0;
      connect();
    }

    return () => {
      isMountedRef.current = false;
      disconnect();
    };
  }, [enabled]); // Only depend on enabled, not on connect/disconnect to avoid loops

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


  // Check for fallback mode (no WS updates in 10 seconds)
  useEffect(() => {
    if (!enabled) return;

    const checkFallback = setInterval(() => {
      const timeSinceLastUpdate = Date.now() - lastWsUpdateRef.current;
      if (timeSinceLastUpdate > 10000 && !isFallbackMode) {
        console.log('[WS] No updates for 10s, switching to REST fallback');
        setIsFallbackMode(true);
      }
    }, 5000);

    return () => clearInterval(checkFallback);
  }, [enabled, isFallbackMode]);

  // REST polling when in fallback mode
  useEffect(() => {
    if (isFallbackMode && enabled) {
      fetchRestPrices();
      fallbackIntervalRef.current = setInterval(fetchRestPrices, 5000);
      return () => {
        if (fallbackIntervalRef.current) {
          clearInterval(fallbackIntervalRef.current);
          fallbackIntervalRef.current = null;
        }
      };
    }
  }, [isFallbackMode, enabled, fetchRestPrices]);

  // Memoize return value
  const priceCount = Object.keys(prices).length;
  
  const result = useMemo<UseWebSocketPricesReturn>(() => ({
    prices,
    isConnected,
    error,
    subscribe,
    unsubscribe,
    messageCount,
    lastUpdateTime,
    isFallbackMode,
    priceCount,
  }), [prices, isConnected, error, subscribe, unsubscribe, messageCount, lastUpdateTime, isFallbackMode, priceCount]);

  return result;
}
