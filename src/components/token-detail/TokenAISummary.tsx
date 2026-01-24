import { useRef } from 'react';
import { Bot, Sparkles, Clock, Download, Share2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatDistanceToNow } from 'date-fns';
import { useAISummaryShare } from './useAISummaryShare';

interface TokenAISummaryProps {
  aiSummary: string | null;
  aiSummaryShort: string | null;
  keyThemes: string[] | null;
  notableEvents: string[] | null;
  aiUpdatedAt: string | null;
  tier: number | null;
  symbol?: string;
}

export function TokenAISummary({ 
  aiSummary, 
  aiSummaryShort, 
  keyThemes, 
  notableEvents,
  aiUpdatedAt,
  tier,
  symbol = ''
}: TokenAISummaryProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const summaryText = aiSummary || aiSummaryShort || '';
  const { isExporting, handleExportImage, handleShare } = useAISummaryShare(cardRef, {
    symbol,
    type: 'summary',
    text: `🤖 ${symbol} AI Analysis: ${summaryText.slice(0, 80)}${summaryText.length > 80 ? '...' : ''}`,
  });

  const hasContent = aiSummary || aiSummaryShort || (keyThemes && keyThemes.length > 0);

  if (!hasContent) {
    return (
      <Card className="bg-muted/30">
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Bot className="h-4 w-4" />
            AI Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            {tier === 1 
              ? 'AI summary loading...' 
              : 'AI summary not available for this token tier'}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card ref={cardRef} className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Bot className="h-4 w-4 text-primary" />
            <span className="text-primary">AI Summary</span>
            <Sparkles className="h-3 w-3 text-yellow-500" />
          </CardTitle>
          <div className="flex items-center gap-2">
            {tier && (
              <Badge variant="outline" className="text-xs">
                Tier {tier}
              </Badge>
            )}
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleExportImage} disabled={isExporting}>
                <Download className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleShare} disabled={isExporting}>
                <Share2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>
        {aiUpdatedAt && (
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {formatDistanceToNow(new Date(aiUpdatedAt), { addSuffix: true })}
          </p>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary */}
        {(aiSummary || aiSummaryShort) && (
          <p className="text-sm leading-relaxed">
            "{aiSummary || aiSummaryShort}"
          </p>
        )}

        {/* Key Themes */}
        {keyThemes && keyThemes.length > 0 && (
          <div className="space-y-2">
            <div className="text-xs text-muted-foreground font-medium">Key Themes</div>
            <div className="space-y-1">
              {keyThemes.slice(0, 5).map((theme, i) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  <span className="text-primary">•</span>
                  <span>{theme}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Notable Events */}
        {notableEvents && notableEvents.length > 0 && (
          <div className="space-y-2 pt-2 border-t">
            <div className="text-xs text-muted-foreground font-medium">Notable Events</div>
            <div className="space-y-1">
              {notableEvents.slice(0, 3).map((event, i) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  <span className="text-yellow-500">⚡</span>
                  <span>{event}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Watermark - hidden until export */}
        <div data-watermark className="hidden items-center justify-between pt-3 mt-3 border-t border-border/50 text-xs text-muted-foreground">
          <span className="font-semibold">XRayCrypto</span>
          <span>xraycrypto.io/{symbol}</span>
        </div>
      </CardContent>
    </Card>
  );
}
