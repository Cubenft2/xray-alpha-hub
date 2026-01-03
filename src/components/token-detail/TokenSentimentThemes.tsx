import { ThumbsUp, ThumbsDown } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

interface Theme {
  theme: string;
  percentage: number;
  description?: string;
}

interface TokenSentimentThemesProps {
  supportiveThemes: Theme[] | null;
  criticalThemes: Theme[] | null;
}

export function TokenSentimentThemes({ supportiveThemes, criticalThemes }: TokenSentimentThemesProps) {
  const hasSupport = supportiveThemes && supportiveThemes.length > 0;
  const hasCritical = criticalThemes && criticalThemes.length > 0;
  
  if (!hasSupport && !hasCritical) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Supportive Themes */}
      <Card className="border-green-500/20">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2 text-green-600 dark:text-green-400">
            <ThumbsUp className="h-4 w-4" />
            Bullish Themes
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {hasSupport ? (
            supportiveThemes.slice(0, 4).map((theme, i) => (
              <div key={i} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{theme.theme}</span>
                  <span className="text-green-600 dark:text-green-400">{theme.percentage}%</span>
                </div>
                <Progress value={theme.percentage} className="h-1.5 bg-green-500/10 [&>div]:bg-green-500" />
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">No bullish themes detected</p>
          )}
        </CardContent>
      </Card>

      {/* Critical Themes */}
      <Card className="border-red-500/20">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2 text-red-600 dark:text-red-400">
            <ThumbsDown className="h-4 w-4" />
            Bearish Themes
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {hasCritical ? (
            criticalThemes.slice(0, 4).map((theme, i) => (
              <div key={i} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{theme.theme}</span>
                  <span className="text-red-600 dark:text-red-400">{theme.percentage}%</span>
                </div>
                <Progress value={theme.percentage} className="h-1.5 bg-red-500/10 [&>div]:bg-red-500" />
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">No bearish themes detected</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
