import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Target, TrendingUp } from 'lucide-react';

interface FOMOScoreWidgetProps {
  score?: number;
  factors?: string[];
  className?: string;
}

export function FOMOScoreWidget({ score = 45, factors = [], className = "" }: FOMOScoreWidgetProps) {
  const getFOMOLabel = (score: number) => {
    if (score >= 85) return 'Blow-off Risk';
    if (score >= 70) return 'Frothy';
    if (score >= 50) return 'Hot';
    if (score >= 25) return 'Warming';
    return 'Calm';
  };

  const getFOMOColor = (score: number) => {
    if (score >= 85) return 'text-destructive';
    if (score >= 70) return 'text-warning';
    if (score >= 50) return 'text-accent';
    if (score >= 25) return 'text-primary';
    return 'text-muted-foreground';
  };

  const getProgressColor = (score: number) => {
    if (score >= 85) return 'bg-destructive';
    if (score >= 70) return 'bg-warning';
    if (score >= 50) return 'bg-accent';
    if (score >= 25) return 'bg-primary';
    return 'bg-muted';
  };

  return (
    <Card className={`xr-card ${className}`}>
      <CardHeader className="text-center pb-2">
        <CardTitle className="flex items-center justify-center gap-2 text-lg">
          <Target className="h-5 w-5 text-warning" />
          FOMO Score
        </CardTitle>
      </CardHeader>
      <CardContent className="text-center space-y-4">
        <div className={`text-4xl font-bold ${getFOMOColor(score)} font-pixel`}>
          {score}
        </div>
        
        <div className="space-y-2">
          <div className={`text-sm font-medium ${getFOMOColor(score)}`}>
            {getFOMOLabel(score)}
          </div>
          <Progress 
            value={score} 
            className="w-full h-3"
          />
        </div>

        {factors.length > 0 && (
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground font-pixel">Drivers:</div>
            <div className="flex flex-wrap gap-1 justify-center">
              {factors.slice(0, 3).map((factor, index) => (
                <Badge key={index} variant="secondary" className="text-xs">
                  {factor}
                </Badge>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center justify-center gap-1">
          <TrendingUp className="h-3 w-3 text-warning" />
          <span className="text-xs text-muted-foreground font-pixel">Composite</span>
        </div>
      </CardContent>
    </Card>
  );
}