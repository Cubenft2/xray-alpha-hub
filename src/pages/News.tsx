import React from 'react';
import { NewsSection } from '@/components/NewsSection';
import { LiveNewsStreams } from '@/components/LiveNewsStreams';

export default function News() {
  return (
    <div className="container mx-auto py-6 space-y-8">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold xr-gradient-text">📰 Financial News Hub</h1>
        <p className="text-muted-foreground">Live streams and latest cryptocurrency & market news</p>
      </div>
      
      <LiveNewsStreams />
      <NewsSection />
    </div>
  );
}