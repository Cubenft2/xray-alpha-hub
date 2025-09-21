import React from 'react';
import { XRHeader } from '@/components/XRHeader';
import { XRTicker } from '@/components/XRTicker';
import { XRFooter } from '@/components/XRFooter';
import { WatchlistManager } from '@/components/WatchlistManager';

export default function Watchlist() {
  return (
    <div className="min-h-screen bg-background">
      <XRHeader currentPage="watchlist" />
      <XRTicker type="crypto" />
      
      <main className="container mx-auto px-4 py-6">
        <WatchlistManager />
      </main>
      
      <XRFooter />
    </div>
  );
}