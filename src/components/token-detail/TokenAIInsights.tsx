import { useRef } from 'react';
import { Lightbulb, Download, Share2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAISummaryShare } from './useAISummaryShare';

interface TokenAIInsightsProps {
  insights: string[] | null;
  symbol?: string;
}

export function TokenAIInsights({ insights, symbol = '' }: TokenAIInsightsProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const { isExporting, handleExportImage, handleShare } = useAISummaryShare(cardRef, {
    symbol,
    type: 'insights',
    text: `🔍 Top AI Insights for ${symbol}`,
  });

  if (!insights || insights.length === 0) return null;

  return (
    <Card ref={cardRef}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Lightbulb className="h-4 w-4 text-yellow-500" />
            AI Insights
          </CardTitle>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleExportImage} disabled={isExporting}>
              <Download className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleShare} disabled={isExporting}>
              <Share2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {insights.slice(0, 5).map((insight, i) => (
          <div key={i} className="flex items-start gap-3">
            <span className="flex-shrink-0 w-5 h-5 rounded-full bg-muted flex items-center justify-center text-xs font-medium">
              {i + 1}
            </span>
            <p className="text-sm leading-relaxed">{insight}</p>
          </div>
        ))}
        {/* Watermark - hidden until export */}
        <div data-watermark className="hidden items-center justify-between pt-3 mt-3 border-t border-border/50 text-xs text-muted-foreground">
          <span className="font-semibold">XRayCrypto</span>
          <span>xraycrypto.io/{symbol}</span>
        </div>
      </CardContent>
    </Card>
  );
}
