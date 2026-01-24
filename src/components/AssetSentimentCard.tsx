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
    if (trend === 'up') return <TrendingUp className="w-3 h-3 text-success" />;
    if (trend === 'down') return <TrendingDown className="w-3 h-3 text-destructive" />;
    return <Minus className="w-3 h-3 text-muted-foreground" />;
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
    <Card className={`p-2 transition-all duration-300 ${getCardClasses()}`}>
      {/* Row 1: Symbol + Score + Trend */}
      <div className="flex items-center justify-between gap-2 mb-1">
        <div className="font-bold text-sm">{symbol}</div>
        <div className="flex items-center gap-1.5">
          <div className={`text-base font-bold ${getLabelColor()}`}>
            {score > 0 ? '+' : ''}{score.toFixed(1)}
          </div>
          <div className={`text-xs font-medium ${getLabelColor()} capitalize`}>
            {label}
          </div>
          <div className={`flex items-center ${getTrendColor()}`}>
            {getTrendIcon()}
          </div>
        </div>
      </div>

      {/* Row 2: Sentiment Bar */}
      <div className="relative h-1 bg-gradient-to-r from-destructive via-muted to-success rounded-full mb-1">
        <div 
          className="absolute w-2 h-2 bg-primary rounded-full -top-0.5 transition-all duration-1000 shadow-lg"
          style={{ left: `calc(${barPosition}% - 4px)` }}
        />
      </div>

      {/* Row 3: Asset Name + Breakdown */}
      <div className="flex items-center justify-between gap-2 text-xs">
        <div className="text-muted-foreground truncate flex-1">{name}</div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span className="flex items-center gap-0.5">
            <span className="w-1.5 h-1.5 rounded-full bg-success" />
            {positive}
          </span>
          <span className="flex items-center gap-0.5">
            <span className="w-1.5 h-1.5 rounded-full bg-destructive" />
            {negative}
          </span>
          <span className="flex items-center gap-0.5">
            <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground" />
            {neutral}
          </span>
          <span className="text-muted-foreground">({total})</span>
        </div>
      </div>
    </Card>
  );
}
