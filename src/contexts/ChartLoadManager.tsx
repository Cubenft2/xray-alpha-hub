import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';

interface ChartLoadManagerContextType {
  requestLoad: (chartId: string, loadFn: () => void) => void;
  releaseLoad: (chartId: string) => void;
}

const ChartLoadManagerContext = createContext<ChartLoadManagerContextType | undefined>(undefined);

const MAX_CONCURRENT_LOADS = 3;

export function ChartLoadManagerProvider({ children }: { children: React.ReactNode }) {
  const [activeLoads, setActiveLoads] = useState<Set<string>>(new Set());
  const queueRef = useRef<Array<{ chartId: string; loadFn: () => void }>>([]);

  const processQueue = useCallback(() => {
    setActiveLoads((currentActive) => {
      if (currentActive.size >= MAX_CONCURRENT_LOADS || queueRef.current.length === 0) {
        return currentActive;
      }

      const newActive = new Set(currentActive);
      
      while (newActive.size < MAX_CONCURRENT_LOADS && queueRef.current.length > 0) {
        const next = queueRef.current.shift();
        if (next && !newActive.has(next.chartId)) {
          newActive.add(next.chartId);
          // Execute load function asynchronously
          setTimeout(() => next.loadFn(), 0);
        }
      }

      return newActive;
    });
  }, []);

  const requestLoad = useCallback((chartId: string, loadFn: () => void) => {
    setActiveLoads((currentActive) => {
      if (currentActive.size < MAX_CONCURRENT_LOADS && !currentActive.has(chartId)) {
        const newActive = new Set(currentActive);
        newActive.add(chartId);
        setTimeout(() => loadFn(), 0);
        return newActive;
      } else {
        // Add to queue
        queueRef.current.push({ chartId, loadFn });
        return currentActive;
      }
    });
  }, []);

  const releaseLoad = useCallback((chartId: string) => {
    setActiveLoads((currentActive) => {
      const newActive = new Set(currentActive);
      newActive.delete(chartId);
      return newActive;
    });
    // Process queue after releasing
    setTimeout(processQueue, 100);
  }, [processQueue]);

  return (
    <ChartLoadManagerContext.Provider value={{ requestLoad, releaseLoad }}>
      {children}
    </ChartLoadManagerContext.Provider>
  );
}

export function useChartLoadManager() {
  const context = useContext(ChartLoadManagerContext);
  if (!context) {
    throw new Error('useChartLoadManager must be used within ChartLoadManagerProvider');
  }
  return context;
}
