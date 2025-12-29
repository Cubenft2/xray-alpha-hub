import React from 'react';
import { SEOHead } from '@/components/SEOHead';
import { NewsSection } from '@/components/NewsSection';
import { LiveNewsStreams } from '@/components/LiveNewsStreams';
import { TopAssetsSentiment } from '@/components/TopAssetsSentiment';

export default function News() {
  return (
    <>
      <SEOHead
        title="Crypto & Market News - Latest Headlines"
        description="Stay updated with the latest cryptocurrency and stock market news. Aggregated headlines from top financial news sources with sentiment analysis."
      />
      <div className="container mx-auto py-6 space-y-8">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold xr-gradient-text">📰 Financial News Hub</h1>
        <p className="text-muted-foreground">Live streams and latest cryptocurrency & market news</p>
      </div>
      
      <LiveNewsStreams />
      
      {/* Top Assets Sentiment */}
      <div className="xr-card p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold">
            📊 Top Assets by News Sentiment
          </h2>
        </div>
        <TopAssetsSentiment />
      </div>
      
      <NewsSection />
    </div>
    </>
  );
}