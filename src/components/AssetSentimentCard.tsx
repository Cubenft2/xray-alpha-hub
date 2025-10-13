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
    if (trend === 'up') return <TrendingUp className="w-2 h-2 text-success" />;
    if (trend === 'down') return <TrendingDown className="w-2 h-2 text-destructive" />;
    return <Minus className="w-2 h-2 text-muted-foreground" />;
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
    <Card className={`p-1 transition-all duration-300 ${getCardClasses()}`}>
      {/* Row 1: Symbol + Score + Trend */}
      <div className="flex items-center justify-between gap-1 mb-0">
        <div className="font-bold text-[10px] leading-none">{symbol}</div>
        <div className="flex items-center gap-[2px]">
          <div className={`text-[11px] leading-none font-bold ${getLabelColor()}`}>
            {score > 0 ? '+' : ''}{score.toFixed(1)}
          </div>
          <div className={`text-[9px] leading-none font-medium ${getLabelColor()} capitalize`}>
            {label}
          </div>
          <div className={`flex items-center ${getTrendColor()}`}>
            {getTrendIcon()}
          </div>
        </div>
      </div>

      {/* Row 2: Sentiment Bar */}
      <div className="relative h-0.5 bg-gradient-to-r from-destructive via-muted to-success rounded-full mb-0">
        <div 
          className="absolute w-1 h-1 bg-primary rounded-full -top-[2px] transition-all duration-1000 shadow-lg"
          style={{ left: `calc(${barPosition}% - 2px)` }}
        />
      </div>

      {/* Row 3: Asset Name + Breakdown */}
      <div className="flex items-center justify-between gap-1 text-[9px] leading-none">
        <div className="text-muted-foreground truncate flex-1">{name}</div>
        <div className="flex items-center gap-[6px] flex-shrink-0">
          <span className="flex items-center gap-[2px]">
            <span className="w-[3px] h-[3px] rounded-full bg-success" />
            {positive}
          </span>
          <span className="flex items-center gap-[2px]">
            <span className="w-[3px] h-[3px] rounded-full bg-destructive" />
            {negative}
          </span>
          <span className="flex items-center gap-[2px]">
            <span className="w-[3px] h-[3px] rounded-full bg-muted-foreground" />
            {neutral}
          </span>
          <span className="text-muted-foreground">({total})</span>
        </div>
      </div>
    </Card>
  );
}
