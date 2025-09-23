import React, { useState } from 'react';
import { XRHeader } from '@/components/XRHeader';
import { XRTicker } from '@/components/XRTicker';
import { XRFooter } from '@/components/XRFooter';
import { WatchlistManager } from '@/components/WatchlistManager';

export default function Watchlist() {
  const [searchTerm, setSearchTerm] = useState('');

  const handleSearch = (term: string) => {
    setSearchTerm(term);
  };

  return (
    <div className="min-h-screen bg-background">
      <XRHeader currentPage="watchlist" onSearch={handleSearch} />
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
      
      <main className="container mx-auto py-6">
        <WatchlistManager />
      </main>
      
      <XRFooter />
    </div>
  );
}