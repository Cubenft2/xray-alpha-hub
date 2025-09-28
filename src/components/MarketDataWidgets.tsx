import React from 'react';
import { TopMoversTable } from './TopMoversTable';
import { SentimentGauge } from './SentimentGauge';

interface MarketDataWidgetsProps {
  marketData: any;
}

export function MarketDataWidgets({ marketData }: MarketDataWidgetsProps) {
  if (!marketData?.content_sections?.market_data) {
    return null;
  }

  const data = marketData.content_sections.market_data;
  
  return (
    <div className="space-y-6">
      {/* Sentiment and Fear & Greed */}
      <SentimentGauge 
        fearGreedValue={data.fear_greed_index || 50}
        fearGreedLabel={data.fear_greed_label || 'Neutral'}
        socialSentiment={data.social_sentiment || []}
      />
      
      {/* Top Movers */}
      <TopMoversTable 
        gainers={data.top_gainers || []}
        losers={data.top_losers || []}
      />
    </div>
  );
}