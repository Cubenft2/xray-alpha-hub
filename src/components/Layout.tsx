import React, { createContext, useContext, useState } from 'react';
import { XRHeader } from './XRHeader';
import { XRTicker } from './XRTicker';
import { XRFooter } from './XRFooter';

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

  const handleSearch = (term: string) => {
    searchHandler(term);
  };

  const contextValue = {
    onSearch: handleSearch,
    setSearchHandler: (handler: (term: string) => void) => {
      setSearchHandler(() => handler);
    },
  };

  return (
    <LayoutContext.Provider value={contextValue}>
      <div className="min-h-screen bg-background">
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
          {/* Small screens: Only crypto ticker */}
          <div className="block sm:hidden">
            <XRTicker type="crypto" />
          </div>
        </div>

        {/* Page Content */}
        <main>
          {children}
        </main>

        {/* Persistent Footer */}
        <XRFooter />
      </div>
    </LayoutContext.Provider>
  );
};