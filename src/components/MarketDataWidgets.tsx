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
  const socialData = marketData?.content_sections?.social_data;
  const socialForGauge = (Array.isArray(data.social_sentiment) && data.social_sentiment.length > 0)
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
      {/* Sentiment and Fear & Greed */}
      <SentimentGauge 
        fearGreedValue={data.fear_greed_index || 50}
        fearGreedLabel={data.fear_greed_label || 'Neutral'}
        socialSentiment={socialForGauge}
      />
      
      {/* Top Movers */}
      <TopMoversTable 
        gainers={data.top_gainers || []}
        losers={data.top_losers || []}
      />
    </div>
  );
}