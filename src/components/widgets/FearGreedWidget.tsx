import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Activity } from 'lucide-react';

interface FearGreedWidgetProps {
  score?: number;
  label?: string;
  className?: string;
}

export function FearGreedWidget({ score = 50, label, className = "" }: FearGreedWidgetProps) {
  const getFearGreedLabel = (score: number) => {
    if (score >= 75) return 'Extreme Greed';
    if (score >= 55) return 'Greed';
    if (score >= 45) return 'Neutral';
    if (score >= 25) return 'Fear';
    return 'Extreme Fear';
  };

  const getFearGreedColor = (score: number) => {
    if (score >= 75) return 'text-success';
    if (score >= 55) return 'text-warning';
    if (score >= 45) return 'text-muted-foreground';
    if (score >= 25) return 'text-warning';
    return 'text-destructive';
  };

  const getGaugeColor = (score: number) => {
    if (score >= 75) return 'border-success';
    if (score >= 55) return 'border-warning';
    if (score >= 45) return 'border-muted-foreground';
    if (score >= 25) return 'border-warning';
    return 'border-destructive';
  };

  return (
    <Card className={`xr-card ${className}`}>
      <CardHeader className="text-center pb-2">
        <CardTitle className="flex items-center justify-center gap-2 text-lg">
          <Activity className="h-5 w-5 text-primary" />
          Fear & Greed Index
        </CardTitle>
      </CardHeader>
      <CardContent className="text-center">
        <div className="relative w-32 h-32 mx-auto mb-4">
          {/* Base circle */}
          <div className="absolute inset-0 rounded-full border-8 border-muted/30"></div>
          {/* Progress circle */}
          <div 
            className={`absolute inset-0 rounded-full border-8 border-t-transparent border-r-transparent transform -rotate-90 transition-all duration-1000 ${getGaugeColor(score)}`}
            style={{ 
              clipPath: `polygon(50% 50%, 50% 0%, ${50 + 50 * Math.cos((score * 3.6 - 90) * Math.PI / 180)}% ${50 + 50 * Math.sin((score * 3.6 - 90) * Math.PI / 180)}%, 50% 50%)`
            }}
          ></div>
          {/* Center content */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <div className={`text-3xl font-bold ${getFearGreedColor(score)}`}>
                {score}
              </div>
              <div className="text-xs text-muted-foreground font-pixel">
                {label || getFearGreedLabel(score)}
              </div>
            </div>
          </div>
        </div>
        <Badge variant="outline" className="text-xs font-pixel">
          Alternative.me
        </Badge>
      </CardContent>
    </Card>
  );
}