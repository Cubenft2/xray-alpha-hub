import { useRef } from 'react';
import { Sparkles, Download, Share2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatDistanceToNow } from 'date-fns';
import { useAISummaryShare } from './useAISummaryShare';

interface TokenAIHeadlineProps {
  headline: string | null;
  fetchedAt: string | null;
  symbol?: string;
}

export function TokenAIHeadline({ headline, fetchedAt, symbol = '' }: TokenAIHeadlineProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const { isExporting, handleExportImage, handleShare } = useAISummaryShare(cardRef, {
    symbol,
    type: 'headline',
    text: `💡 ${headline?.slice(0, 100)}${(headline?.length || 0) > 100 ? '...' : ''} | ${symbol} AI Narrative`,
  });

  if (!headline) return null;

  return (
    <Card ref={cardRef} className="border-primary/30 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent">
      <CardContent className="pt-6 pb-5">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 p-2 rounded-lg bg-primary/20">
            <Sparkles className="h-5 w-5 text-primary" />
          </div>
          <div className="space-y-2 flex-1">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs border-primary/30 text-primary">
                  AI Narrative
                </Badge>
                {fetchedAt && (
                  <span className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(fetchedAt), { addSuffix: true })}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleExportImage} disabled={isExporting}>
                  <Download className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleShare} disabled={isExporting}>
                  <Share2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
            <p className="text-lg font-medium leading-relaxed">
              {headline}
            </p>
          </div>
        </div>
        {/* Watermark - hidden until export */}
        <div data-watermark className="hidden items-center justify-between pt-4 mt-4 border-t border-border/50 text-xs text-muted-foreground">
          <span className="font-semibold">XRayCrypto</span>
          <span>xraycrypto.io/{symbol}</span>
        </div>
      </CardContent>
    </Card>
  );
}
