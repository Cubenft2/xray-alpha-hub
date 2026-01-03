import { Sparkles } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';

interface TokenAIHeadlineProps {
  headline: string | null;
  fetchedAt: string | null;
}

export function TokenAIHeadline({ headline, fetchedAt }: TokenAIHeadlineProps) {
  if (!headline) return null;

  return (
    <Card className="border-primary/30 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent">
      <CardContent className="pt-6 pb-5">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 p-2 rounded-lg bg-primary/20">
            <Sparkles className="h-5 w-5 text-primary" />
          </div>
          <div className="space-y-2 flex-1">
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
            <p className="text-lg font-medium leading-relaxed">
              {headline}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
