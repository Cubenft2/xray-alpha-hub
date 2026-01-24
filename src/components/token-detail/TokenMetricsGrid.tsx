import { TrendingUp, TrendingDown, Users, MessageSquare, Activity, Star, BarChart3, Percent } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

interface TokenMetricsGridProps {
  priceUsd: number | null;
  change24hPct: number | null;
  altRank: number | null;
  galaxyScore: number | null;
  interactions24h: number | null;
  socialVolume24h: number | null;
  contributorsActive: number | null;
  sentiment: number | null;
  socialDominance: number | null;
}

const formatNumber = (num: number | null | undefined, decimals = 0) => {
  if (num === null || num === undefined) return '-';
  if (num >= 1_000_000_000) return `${(num / 1_000_000_000).toFixed(1)}B`;
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return num.toFixed(decimals);
};

const formatPrice = (price: number | null) => {
  if (!price) return '-';
  if (price >= 1000) return `$${price.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  if (price >= 1) return `$${price.toFixed(2)}`;
  if (price >= 0.01) return `$${price.toFixed(4)}`;
  return `$${price.toFixed(8)}`;
};

export function TokenMetricsGrid({
  priceUsd,
  change24hPct,
  altRank,
  galaxyScore,
  interactions24h,
  socialVolume24h,
  contributorsActive,
  sentiment,
  socialDominance,
}: TokenMetricsGridProps) {
  const metrics = [
    {
      label: 'Price',
      value: formatPrice(priceUsd),
      change: change24hPct,
      icon: TrendingUp,
      color: 'text-primary',
    },
    {
      label: 'AltRank™',
      value: altRank ? `#${altRank}` : '-',
      description: 'Lower is better',
      icon: BarChart3,
      color: altRank && altRank <= 50 ? 'text-green-500' : 'text-muted-foreground',
    },
    {
      label: 'Galaxy Score™',
      value: galaxyScore?.toFixed(1) || '-',
      max: 100,
      current: galaxyScore,
      icon: Star,
      color: galaxyScore && galaxyScore >= 70 ? 'text-yellow-500' : 'text-muted-foreground',
    },
    {
      label: 'Engagements',
      value: formatNumber(interactions24h),
      icon: Activity,
      color: 'text-blue-500',
    },
    {
      label: 'Mentions',
      value: formatNumber(socialVolume24h),
      icon: MessageSquare,
      color: 'text-purple-500',
    },
    {
      label: 'Creators',
      value: formatNumber(contributorsActive),
      icon: Users,
      color: 'text-orange-500',
    },
    {
      label: 'Sentiment',
      value: sentiment !== null ? `${sentiment}%` : '-',
      isBar: true,
      barValue: sentiment,
      icon: TrendingUp,
      color: sentiment && sentiment >= 50 ? 'text-green-500' : 'text-destructive',
    },
    {
      label: 'Social Dominance',
      value: socialDominance !== null ? `${socialDominance.toFixed(2)}%` : '-',
      icon: Percent,
      color: 'text-cyan-500',
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {metrics.map((metric) => (
        <Card 
          key={metric.label} 
          className="bg-gradient-to-br from-card to-muted/30 border-border/50 hover:border-primary/30 transition-colors"
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <metric.icon className={`h-4 w-4 ${metric.color}`} />
              <span className="text-xs text-muted-foreground font-medium">{metric.label}</span>
            </div>
            <div className="text-xl font-bold">{metric.value}</div>
            
            {/* Change indicator */}
            {metric.change !== undefined && metric.change !== null && (
              <div className={`flex items-center gap-1 mt-1 text-sm ${
                metric.change >= 0 ? 'text-green-500' : 'text-destructive'
              }`}>
                {metric.change >= 0 ? (
                  <TrendingUp className="h-3 w-3" />
                ) : (
                  <TrendingDown className="h-3 w-3" />
                )}
                <span>{Math.abs(metric.change).toFixed(2)}%</span>
              </div>
            )}

            {/* Bar indicator for sentiment */}
            {metric.isBar && metric.barValue !== null && metric.barValue !== undefined && (
              <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
                <div 
                  className={`h-full rounded-full transition-all ${
                    metric.barValue >= 50 ? 'bg-green-500' : 'bg-destructive'
                  }`}
                  style={{ width: `${Math.min(100, metric.barValue)}%` }}
                />
              </div>
            )}

            {/* Description */}
            {metric.description && (
              <div className="text-xs text-muted-foreground mt-1">{metric.description}</div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
