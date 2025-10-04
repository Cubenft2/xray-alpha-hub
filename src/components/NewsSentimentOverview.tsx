import React, { useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { TrendingUp, TrendingDown, Minus, Download, Share2 } from 'lucide-react';
import html2canvas from 'html2canvas';
import { useToast } from '@/hooks/use-toast';

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
  const cardRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  if (!sentimentBreakdown || sentimentBreakdown.total === 0) {
    return null;
  }

  const handleExportImage = async () => {
    if (!cardRef.current) return;

    try {
      const canvas = await html2canvas(cardRef.current, {
        backgroundColor: null,
        scale: 2,
        logging: false,
      });

      canvas.toBlob((blob) => {
        if (blob) {
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.download = `news-sentiment-${new Date().toISOString().split('T')[0]}.png`;
          link.href = url;
          link.click();
          URL.revokeObjectURL(url);
          
          toast({
            title: "Image downloaded!",
            description: "News sentiment card saved as PNG",
          });
        }
      });
    } catch (error) {
      toast({
        title: "Export failed",
        description: "Could not export the card as image",
        variant: "destructive",
      });
    }
  };

  const handleShare = async () => {
    if (!cardRef.current) return;

    try {
      const canvas = await html2canvas(cardRef.current, {
        backgroundColor: null,
        scale: 2,
        logging: false,
      });

      canvas.toBlob(async (blob) => {
        if (blob) {
          const file = new File([blob], 'news-sentiment.png', { type: 'image/png' });
          
          if (navigator.share && navigator.canShare({ files: [file] })) {
            await navigator.share({
              files: [file],
              title: 'News Sentiment Analysis',
              text: 'Check out this market sentiment analysis!',
            });
          } else {
            // Fallback to download
            handleExportImage();
          }
        }
      });
    } catch (error) {
      toast({
        title: "Share failed",
        description: "Could not share the card",
        variant: "destructive",
      });
    }
  };

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
    <Card className="overflow-hidden" ref={cardRef}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            📰 News Sentiment Analysis
            <span className="text-sm text-muted-foreground">({sentimentBreakdown.total} articles)</span>
          </CardTitle>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportImage}
              className="gap-2"
            >
              <Download className="w-4 h-4" />
              Download
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleShare}
              className="gap-2"
            >
              <Share2 className="w-4 h-4" />
              Share
            </Button>
          </div>
        </div>
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
