import React, { createContext, useContext, useState, useCallback, useMemo, lazy, Suspense } from 'react';
import { useLocation } from 'react-router-dom';
import { XRHeader } from './XRHeader';
import { XRTicker } from './XRTicker';
import { PolygonTicker } from './PolygonTicker';
import { XRFooter } from './XRFooter';
import { ScrollToTop } from './ScrollToTop';

// Lazy load ZombieDogWidget - not needed for initial render, wrapped in try-catch
const LazyZombieDogWidget = lazy(async () => {
  try {
    const module = await import('./ZombieDogWidget');
    return { default: module.ZombieDogWidget };
  } catch (error) {
    console.error('Failed to load ZombieDogWidget:', error);
    // Return a fallback empty component if loading fails
    return { default: () => null };
  }
});

interface LayoutContextType {
  onSearch: (term: string) => void;
  setSearchHandler: (handler: (term: string) => void) => void;
}

const LayoutContext = createContext<LayoutContextType>({
  onSearch: () => {},
  setSearchHandler: () => {},
});

export const useLayoutSearch = () => useContext(LayoutContext);

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout = ({ children }: LayoutProps) => {
  const [searchHandler, setSearchHandler] = useState<(term: string) => void>(() => () => {});
  const location = useLocation();

  const handleSearch = useCallback((term: string) => {
    searchHandler(term);
  }, [searchHandler]);

  const setSearchHandlerStable = useCallback((handler: (term: string) => void) => {
    setSearchHandler(() => handler);
  }, []);

  const contextValue = useMemo(() => ({
    onSearch: handleSearch,
    setSearchHandler: setSearchHandlerStable,
  }), [handleSearch, setSearchHandlerStable]);

  return (
    <LayoutContext.Provider value={contextValue}>
      <div className="min-h-screen">
        {/* Persistent Header - never unmounts */}
        <XRHeader onSearch={handleSearch} />
        
        {/* Persistent Tickers - never unmount */}
        <div className="space-y-0">
          {/* Desktop and Medium: Both tickers */}
          <div className="hidden sm:block">
            <XRTicker type="crypto" />
          </div>
          <div className="hidden sm:block">
            <XRTicker type="stocks" />
          </div>
          {/* Small screens: Context-aware ticker */}
          <div className="block sm:hidden">
            {location.pathname === '/markets' ? (
              <XRTicker type="stocks" />
            ) : (
              <PolygonTicker />
            )}
          </div>
        </div>

        {/* Page Content */}
        <main>
          {children}
        </main>

        {/* Persistent Footer */}
        <XRFooter />

        {/* Scroll to Top Button */}
        <ScrollToTop />

        {/* ZombieDog Chat Widget - Lazy loaded, Hidden on /zombiedog page */}
        {location.pathname !== '/zombiedog' && (
          <Suspense fallback={null}>
            <LazyZombieDogWidget />
          </Suspense>
        )}
      </div>
    </LayoutContext.Provider>
  );
};
