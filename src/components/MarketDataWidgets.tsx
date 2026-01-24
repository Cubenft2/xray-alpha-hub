import React from 'react';
import { TopMoversTable } from './TopMoversTable';
import { SentimentGauge } from './SentimentGauge';

interface MarketDataWidgetsProps {
  marketData: any;
}

export function MarketDataWidgets({ marketData }: MarketDataWidgetsProps) {
  const data = marketData?.content_sections?.market_data;
  
  // If no market data at all, show fallback message
  if (!data && !marketData?.content_sections?.social_data) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        <p>Market data is currently being generated. Please refresh in a moment.</p>
      </div>
    );
  }
  const socialData = marketData?.content_sections?.social_data;
  
  // Build social sentiment for gauge
  const socialForGauge = (Array.isArray(data?.social_sentiment) && data.social_sentiment.length > 0)
    ? data.social_sentiment
    : (Array.isArray(socialData?.top_social_assets)
        ? socialData.top_social_assets.slice(0, 4).map((sym: string) => ({
            name: sym.toUpperCase(),
            symbol: sym,
            galaxy_score: Math.round(socialData?.avg_galaxy_score || 0),
            sentiment: 0,
            social_volume: 0,
          }))
        : []);
  
  return (
    <div className="space-y-6">
      {/* Sentiment and Fear & Greed - Only show if we have data */}
      {(data?.fear_greed_index || socialForGauge.length > 0) && (
        <SentimentGauge 
          fearGreedValue={data?.fear_greed_index || 50}
          fearGreedLabel={data?.fear_greed_label || 'Neutral'}
          socialSentiment={socialForGauge}
        />
      )}
      
      {/* Top Movers - Only show if we have data */}
      {(data?.top_gainers?.length > 0 || data?.top_losers?.length > 0) && (
        <TopMoversTable 
          gainers={data?.top_gainers || []}
          losers={data?.top_losers || []}
        />
      )}
      
      {/* Show message if no widgets have data */}
      {!data?.fear_greed_index && socialForGauge.length === 0 && 
       !data?.top_gainers?.length && !data?.top_losers?.length && (
        <div className="p-6 text-center text-muted-foreground">
          <p>Market widgets are loading. Data will appear shortly.</p>
        </div>
      )}
    </div>
  );
}