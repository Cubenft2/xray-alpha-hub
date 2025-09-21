import React from 'react';
import { XRHeader } from '@/components/XRHeader';
import { XRTicker } from '@/components/XRTicker';
import { XRFooter } from '@/components/XRFooter';
import { NewsSection } from '@/components/NewsSection';

export default function News() {
  return (
    <div className="min-h-screen bg-background">
      <XRHeader currentPage="news" />
      <XRTicker type="crypto" />
      
      <main className="container mx-auto px-4 py-6 space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold xr-gradient-text">📰 Financial News</h1>
          <p className="text-muted-foreground">Latest cryptocurrency and market news</p>
        </div>
        
        <NewsSection />
      </main>
      
      <XRFooter />
    </div>
  );
}