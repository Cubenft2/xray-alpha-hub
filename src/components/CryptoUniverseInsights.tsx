import { TrendingUp, TrendingDown, DollarSign, Activity, Star, BarChart3, MessageCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CoinData, UniverseMetadata, useTopGainers, useTopLosers } from '@/hooks/useLunarCrushUniverse';
import { Skeleton } from '@/components/ui/skeleton';

interface CryptoUniverseInsightsProps {
  metadata: UniverseMetadata | null;
  isLoading?: boolean;
}

export function CryptoUniverseInsights({ metadata, isLoading }: CryptoUniverseInsightsProps) {
  const { data: topGainers = [], isLoading: gainersLoading } = useTopGainers(5);
  const { data: topLosers = [], isLoading: losersLoading } = useTopLosers(5);

  const formatCurrency = (value: number) => {
    if (value >= 1e12) return `$${(value / 1e12).toFixed(2)}T`;
    if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
    if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
    return `$${value.toFixed(2)}`;
  };

  const getSentimentLabel = (score: number) => {
    if (score >= 60) return { label: 'Bullish', color: 'text-green-500' };
    if (score >= 40) return { label: 'Neutral', color: 'text-yellow-500' };
    return { label: 'Bearish', color: 'text-red-500' };
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="pt-4">
              <Skeleton className="h-4 w-20 mb-2" />
              <Skeleton className="h-8 w-24" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const sentimentInfo = metadata?.average_sentiment 
    ? getSentimentLabel(metadata.average_sentiment)
    : { label: '—', color: 'text-muted-foreground' };

  return (
    <div className="space-y-4">
      {/* Global Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-3 px-4">
            <CardTitle className="text-xs font-medium text-muted-foreground">Total Market Cap</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="pb-3 px-4">
            <div className="text-xl font-bold">
              {metadata ? formatCurrency(metadata.total_market_cap) : '—'}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-3 px-4">
            <CardTitle className="text-xs font-medium text-muted-foreground">24h Volume</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="pb-3 px-4">
            <div className="text-xl font-bold">
              {metadata ? formatCurrency(metadata.total_volume_24h) : '—'}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-3 px-4">
            <CardTitle className="text-xs font-medium text-muted-foreground">Avg Galaxy Score</CardTitle>
            <Star className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent className="pb-3 px-4">
            <div className="text-xl font-bold">
              {metadata?.average_galaxy_score?.toFixed(1) || '—'}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-3 px-4">
            <CardTitle className="text-xs font-medium text-muted-foreground">Market Sentiment</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="pb-3 px-4">
            <div className={`text-xl font-bold ${sentimentInfo.color}`}>
              {sentimentInfo.label}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-3 px-4">
            <CardTitle className="text-xs font-medium text-muted-foreground">Tokens Tracked</CardTitle>
            <MessageCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="pb-3 px-4">
            <div className="text-xl font-bold">
              {metadata?.total_all_coins?.toLocaleString() || '—'}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-3 px-4">
            <CardTitle className="text-xs font-medium text-muted-foreground">Filtered</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="pb-3 px-4">
            <div className="text-xl font-bold">
              {metadata?.total_coins?.toLocaleString() || '—'}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top Movers */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Top Gainers */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-3 px-4">
            <CardTitle className="text-sm font-medium">🚀 Top Gainers (24h)</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent className="pb-3 px-4">
            {gainersLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-6 w-full" />
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {topGainers.map((coin) => (
                  <div key={coin.id} className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      {coin.logo_url && (
                        <img src={coin.logo_url} alt={coin.symbol} className="w-5 h-5 rounded-full" />
                      )}
                      <span className="text-sm font-medium">{coin.symbol}</span>
                    </div>
                    <span className="text-sm text-green-500 font-semibold">
                      +{coin.percent_change_24h?.toFixed(2)}%
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top Losers */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-3 px-4">
            <CardTitle className="text-sm font-medium">📉 Top Losers (24h)</CardTitle>
            <TrendingDown className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent className="pb-3 px-4">
            {losersLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-6 w-full" />
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {topLosers.map((coin) => (
                  <div key={coin.id} className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      {coin.logo_url && (
                        <img src={coin.logo_url} alt={coin.symbol} className="w-5 h-5 rounded-full" />
                      )}
                      <span className="text-sm font-medium">{coin.symbol}</span>
                    </div>
                    <span className="text-sm text-red-500 font-semibold">
                      {coin.percent_change_24h?.toFixed(2)}%
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
