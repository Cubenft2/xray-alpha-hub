import { Lightbulb } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface TokenAIInsightsProps {
  insights: string[] | null;
}

export function TokenAIInsights({ insights }: TokenAIInsightsProps) {
  if (!insights || insights.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Lightbulb className="h-4 w-4 text-yellow-500" />
          AI Insights
        </CardTitle>
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
      </CardContent>
    </Card>
  );
}
