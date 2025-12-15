import { Bot, Sparkles, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';

interface TokenAISummaryProps {
  aiSummary: string | null;
  aiSummaryShort: string | null;
  keyThemes: string[] | null;
  notableEvents: string[] | null;
  aiUpdatedAt: string | null;
  tier: number | null;
}

export function TokenAISummary({ 
  aiSummary, 
  aiSummaryShort, 
  keyThemes, 
  notableEvents,
  aiUpdatedAt,
  tier 
}: TokenAISummaryProps) {
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
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Bot className="h-4 w-4 text-primary" />
            <span className="text-primary">AI Summary</span>
            <Sparkles className="h-3 w-3 text-yellow-500" />
          </CardTitle>
          {tier && (
            <Badge variant="outline" className="text-xs">
              Tier {tier}
            </Badge>
          )}
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
      </CardContent>
    </Card>
  );
}
