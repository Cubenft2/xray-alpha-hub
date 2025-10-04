import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface SentimentData {
  positive: number;
  negative: number;
  neutral: number;
  total: number;
}

interface NewsSentimentOverviewProps {
  sentimentBreakdown?: SentimentData;
  topTickers?: string[];
  topKeywords?: string[];
}

export function NewsSentimentOverview({ 
  sentimentBreakdown, 
  topTickers = [], 
  topKeywords = [] 
}: NewsSentimentOverviewProps) {
  if (!sentimentBreakdown || sentimentBreakdown.total === 0) {
    return null;
  }

  const positivePercent = (sentimentBreakdown.positive / sentimentBreakdown.total) * 100;
  const negativePercent = (sentimentBreakdown.negative / sentimentBreakdown.total) * 100;
  const neutralPercent = (sentimentBreakdown.neutral / sentimentBreakdown.total) * 100;

  const getMarketMood = () => {
    if (positivePercent >= 60) return { text: 'Bullish', color: 'text-green-600 dark:text-green-400' };
    if (negativePercent >= 60) return { text: 'Bearish', color: 'text-red-600 dark:text-red-400' };
    if (positivePercent > negativePercent) return { text: 'Cautiously Optimistic', color: 'text-green-600 dark:text-green-400' };
    if (negativePercent > positivePercent) return { text: 'Cautiously Bearish', color: 'text-orange-600 dark:text-orange-400' };
    return { text: 'Neutral', color: 'text-muted-foreground' };
  };

  const mood = getMarketMood();

  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          📰 News Sentiment Analysis
          <span className="text-sm text-muted-foreground">({sentimentBreakdown.total} articles)</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Market Mood Indicator */}
        <div className="text-center p-3 rounded-lg bg-muted/50">
          <div className="text-sm text-muted-foreground mb-1">Market Mood</div>
          <div className={`text-2xl font-bold ${mood.color}`}>{mood.text}</div>
        </div>

        {/* Sentiment Breakdown Bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-xs text-muted-foreground mb-1">
            <span>Sentiment Distribution</span>
          </div>
          <div className="h-8 rounded-full overflow-hidden flex bg-muted">
            {positivePercent > 0 && (
              <div 
                className="bg-green-500 dark:bg-green-600 flex items-center justify-center text-xs font-medium text-white"
                style={{ width: `${positivePercent}%` }}
              >
                {positivePercent >= 15 && `${positivePercent.toFixed(0)}%`}
              </div>
            )}
            {neutralPercent > 0 && (
              <div 
                className="bg-gray-400 dark:bg-gray-600 flex items-center justify-center text-xs font-medium text-white"
                style={{ width: `${neutralPercent}%` }}
              >
                {neutralPercent >= 15 && `${neutralPercent.toFixed(0)}%`}
              </div>
            )}
            {negativePercent > 0 && (
              <div 
                className="bg-red-500 dark:bg-red-600 flex items-center justify-center text-xs font-medium text-white"
                style={{ width: `${negativePercent}%` }}
              >
                {negativePercent >= 15 && `${negativePercent.toFixed(0)}%`}
              </div>
            )}
          </div>
          
          {/* Legend */}
          <div className="flex justify-between text-xs mt-2">
            <div className="flex items-center gap-1">
              <TrendingUp className="w-3 h-3 text-green-600" />
              <span className="text-green-600 dark:text-green-400">{sentimentBreakdown.positive} Positive</span>
            </div>
            <div className="flex items-center gap-1">
              <Minus className="w-3 h-3 text-gray-600" />
              <span className="text-gray-600 dark:text-gray-400">{sentimentBreakdown.neutral} Neutral</span>
            </div>
            <div className="flex items-center gap-1">
              <TrendingDown className="w-3 h-3 text-red-600" />
              <span className="text-red-600 dark:text-red-400">{sentimentBreakdown.negative} Negative</span>
            </div>
          </div>
        </div>

        {/* Most Mentioned Tickers */}
        {topTickers.length > 0 && (
          <div className="space-y-2">
            <div className="text-sm font-medium">🎯 Most Mentioned Assets</div>
            <div className="flex flex-wrap gap-2">
              {topTickers.slice(0, 8).map((ticker, idx) => (
                <span 
                  key={idx} 
                  className="px-2 py-1 rounded-md text-xs bg-primary/10 text-primary font-medium"
                >
                  {ticker}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Trending Keywords */}
        {topKeywords.length > 0 && (
          <div className="space-y-2">
            <div className="text-sm font-medium">🏷️ Trending Themes</div>
            <div className="flex flex-wrap gap-2">
              {topKeywords.slice(0, 10).map((keyword, idx) => (
                <span 
                  key={idx} 
                  className="px-2 py-1 rounded-md text-xs bg-muted text-muted-foreground"
                >
                  {keyword}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="text-xs text-muted-foreground text-center pt-2 border-t">
          Powered by Polygon.io professional news data
        </div>
      </CardContent>
    </Card>
  );
}
