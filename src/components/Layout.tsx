import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { XRHeader } from './XRHeader';
import { XRTicker } from './XRTicker';
import { PolygonTicker } from './PolygonTicker';
import { XRFooter } from './XRFooter';
import { ScrollToTop } from './ScrollToTop';
import { ZombieDogWidget } from './ZombieDogWidget';

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

        {/* ZombieDog Chat Widget - Hidden on /zombiedog page */}
        {location.pathname !== '/zombiedog' && <ZombieDogWidget />}
      </div>
    </LayoutContext.Provider>
  );
};