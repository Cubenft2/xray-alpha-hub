import React from 'react';
import { XRHeader } from '@/components/XRHeader';
import { XRTicker } from '@/components/XRTicker';
import { XRFooter } from '@/components/XRFooter';
import { NewsSection } from '@/components/NewsSection';
import { LiveNewsStreams } from '@/components/LiveNewsStreams';

export default function News() {
  return (
    <div className="min-h-screen bg-background">
      <XRHeader currentPage="news" />
      {/* Desktop and Medium: Both tickers */}
      <div className="hidden sm:block">
        <XRTicker type="crypto" />
      </div>
      <div className="hidden sm:block">
        <XRTicker type="stocks" />
      </div>
      {/* Small screens: Only stocks ticker */}
      <div className="block sm:hidden">
        <XRTicker type="stocks" />
      </div>
      
      <main className="container mx-auto py-6 space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold xr-gradient-text">📰 Financial News Hub</h1>
          <p className="text-muted-foreground">Live streams and latest cryptocurrency & market news</p>
        </div>
        
        <LiveNewsStreams />
        <NewsSection />
      </main>
      
      <XRFooter />
    </div>
  );
}