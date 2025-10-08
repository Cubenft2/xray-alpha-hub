import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Card } from '@/components/ui/card';

interface AssetSentimentCardProps {
  symbol: string;
  name: string;
  score: number;
  label: 'bullish' | 'bearish' | 'neutral';
  positive: number;
  negative: number;
  neutral: number;
  total: number;
  trend?: 'up' | 'down' | 'stable';
  scoreChange?: number;
}

export function AssetSentimentCard({
  symbol,
  name,
  score,
  label,
  positive,
  negative,
  neutral,
  total,
  trend = 'stable',
  scoreChange = 0
}: AssetSentimentCardProps) {
  const getTrendIcon = () => {
    if (trend === 'up') return <TrendingUp className="w-4 h-4 text-success" />;
    if (trend === 'down') return <TrendingDown className="w-4 h-4 text-destructive" />;
    return <Minus className="w-4 h-4 text-muted-foreground" />;
  };

  const getTrendColor = () => {
    if (trend === 'up') return 'text-success';
    if (trend === 'down') return 'text-destructive';
    return 'text-muted-foreground';
  };

  const getCardClasses = () => {
    if (label === 'bullish') return 'border-success/50 bg-success/5 hover:shadow-success/20';
    if (label === 'bearish') return 'border-destructive/50 bg-destructive/5 hover:shadow-destructive/20';
    return 'border-border bg-card hover:shadow-md';
  };

  const getLabelColor = () => {
    if (label === 'bullish') return 'text-success';
    if (label === 'bearish') return 'text-destructive';
    return 'text-muted-foreground';
  };

  // Calculate position on sentiment bar (from -100 to +100, mapped to 0-100%)
  const barPosition = ((score + 100) / 200) * 100;

  return (
    <Card className={`p-4 transition-all duration-300 hover:scale-105 ${getCardClasses()}`}>
      {/* Header: Symbol + Trend */}
      <div className="flex items-center justify-between mb-2">
        <div className="font-bold text-lg">{symbol}</div>
        <div className={`flex items-center gap-1 text-sm ${getTrendColor()}`}>
          {getTrendIcon()}
          <span>{scoreChange > 0 ? '+' : ''}{scoreChange.toFixed(1)}</span>
        </div>
      </div>

      {/* Asset Name */}
      <div className="text-sm text-muted-foreground mb-3 truncate">{name}</div>

      {/* Sentiment Bar */}
      <div className="relative h-2 bg-gradient-to-r from-destructive via-muted to-success rounded-full mb-3">
        <div 
          className="absolute w-3 h-3 bg-primary rounded-full -top-0.5 transition-all duration-1000 shadow-lg"
          style={{ left: `calc(${barPosition}% - 6px)` }}
        />
      </div>

      {/* Score Display */}
      <div className="flex items-baseline gap-2 mb-3">
        <div className={`text-2xl font-bold ${getLabelColor()}`}>
          {score > 0 ? '+' : ''}{score.toFixed(1)}
        </div>
        <div className={`text-sm font-medium ${getLabelColor()} capitalize`}>
          {label}
        </div>
      </div>

      {/* Breakdown */}
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-success" />
            {positive}
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-destructive" />
            {negative}
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-muted-foreground" />
            {neutral}
          </span>
        </div>
        <span className="text-muted-foreground">({total})</span>
      </div>
    </Card>
  );
}
