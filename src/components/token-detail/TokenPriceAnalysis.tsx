import { TrendingUp, TrendingDown } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

interface TokenPriceAnalysisProps {
  priceAnalysis: string | null;
  sentimentPct: number | null;
}

export function TokenPriceAnalysis({ priceAnalysis, sentimentPct }: TokenPriceAnalysisProps) {
  if (!priceAnalysis && sentimentPct === null) return null;

  const isBullish = sentimentPct !== null && sentimentPct >= 50;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          {isBullish ? (
            <TrendingUp className="h-4 w-4 text-green-500" />
          ) : (
            <TrendingDown className="h-4 w-4 text-red-500" />
          )}
          Price Analysis
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Sentiment Gauge */}
        {sentimentPct !== null && (
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-red-500">Bearish</span>
              <span className={isBullish ? 'text-green-500 font-medium' : 'text-red-500 font-medium'}>
                {sentimentPct.toFixed(0)}% {isBullish ? 'Bullish' : 'Bearish'}
              </span>
              <span className="text-green-500">Bullish</span>
            </div>
            <div className="relative h-2 rounded-full bg-gradient-to-r from-red-500/20 via-muted to-green-500/20">
              <div
                className={`absolute h-3 w-3 rounded-full top-1/2 -translate-y-1/2 border-2 border-background shadow ${
                  isBullish ? 'bg-green-500' : 'bg-red-500'
                }`}
                style={{ left: `${Math.min(Math.max(sentimentPct, 0), 100)}%`, transform: 'translate(-50%, -50%)' }}
              />
            </div>
          </div>
        )}

        {/* Analysis Text */}
        {priceAnalysis && (
          <p className="text-sm leading-relaxed text-muted-foreground">
            {priceAnalysis}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
