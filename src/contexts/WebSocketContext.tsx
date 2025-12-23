import React, { createContext, useContext, useState, useCallback, useMemo, ReactNode } from 'react';
import { useWebSocketPrices, PriceUpdate, UseWebSocketPricesReturn } from '@/hooks/useWebSocketPrices';

interface WebSocketContextValue extends UseWebSocketPricesReturn {
  addSymbols: (symbols: string[]) => void;
  removeSymbols: (symbols: string[]) => void;
  activeSymbols: string[];
}

const WebSocketContext = createContext<WebSocketContextValue | null>(null);

interface WebSocketProviderProps {
  children: ReactNode;
  defaultSymbols?: string[];
  enabled?: boolean;
}

export function WebSocketProvider({ 
  children, 
  defaultSymbols = [], 
  enabled = true 
}: WebSocketProviderProps) {
  const [activeSymbols, setActiveSymbols] = useState<string[]>(defaultSymbols);
  const [priceListeners] = useState<Map<string, Set<(update: PriceUpdate) => void>>>(new Map());

  const handlePriceUpdate = useCallback((update: PriceUpdate) => {
    const listeners = priceListeners.get(update.symbol);
    if (listeners) {
      listeners.forEach(listener => listener(update));
    }
  }, [priceListeners]);

  const wsResult = useWebSocketPrices({
    symbols: activeSymbols.length > 0 ? activeSymbols : ['BTC', 'ETH', 'SOL', 'XRP'],
    enabled,
    onPriceUpdate: handlePriceUpdate,
  });

  const addSymbols = useCallback((symbols: string[]) => {
    setActiveSymbols(prev => {
      const existing = new Set(prev.map(s => s.toUpperCase()));
      const newSymbols = symbols
        .map(s => s.toUpperCase())
        .filter(s => !existing.has(s));
      
      if (newSymbols.length === 0) return prev;
      return [...prev, ...newSymbols];
    });
  }, []);

  const removeSymbols = useCallback((symbols: string[]) => {
    const toRemove = new Set(symbols.map(s => s.toUpperCase()));
    setActiveSymbols(prev => prev.filter(s => !toRemove.has(s.toUpperCase())));
  }, []);

  const value = useMemo<WebSocketContextValue>(() => ({
    ...wsResult,
    addSymbols,
    removeSymbols,
    activeSymbols,
  }), [wsResult, addSymbols, removeSymbols, activeSymbols]);

  return (
    <WebSocketContext.Provider value={value}>
      {children}
    </WebSocketContext.Provider>
  );
}

export function useWebSocket(): WebSocketContextValue {
  const context = useContext(WebSocketContext);
  if (!context) {
    // Return a default mock when not in provider (for non-WS pages)
    return {
      prices: {},
      isConnected: false,
      error: null,
      subscribe: () => {},
      unsubscribe: () => {},
      messageCount: 0,
      lastUpdateTime: null,
      isFallbackMode: false,
      priceCount: 0,
      addSymbols: () => {},
      removeSymbols: () => {},
      activeSymbols: [],
    };
  }
  return context;
}

// Hook for subscribing to specific symbols
export function useLivePrice(symbol: string): PriceUpdate | null {
  const { prices, addSymbols, removeSymbols } = useWebSocket();
  
  React.useEffect(() => {
    addSymbols([symbol]);
    return () => removeSymbols([symbol]);
  }, [symbol, addSymbols, removeSymbols]);

  return prices[symbol.toUpperCase()] || null;
}

// Hook for subscribing to multiple symbols
export function useLivePrices(symbols: string[]): Record<string, PriceUpdate> {
  const { prices, addSymbols, removeSymbols } = useWebSocket();
  
  React.useEffect(() => {
    if (symbols.length > 0) {
      addSymbols(symbols);
      return () => removeSymbols(symbols);
    }
  }, [symbols.join(','), addSymbols, removeSymbols]);

  return useMemo(() => {
    const result: Record<string, PriceUpdate> = {};
    symbols.forEach(s => {
      const upper = s.toUpperCase();
      if (prices[upper]) {
        result[upper] = prices[upper];
      }
    });
    return result;
  }, [prices, symbols]);
}
