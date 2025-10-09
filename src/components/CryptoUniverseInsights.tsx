import { TrendingUp, TrendingDown, DollarSign, Activity, Star } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CoinData, UniverseMetadata } from '@/hooks/useLunarCrushUniverse';

interface CryptoUniverseInsightsProps {
  coins: CoinData[];
  metadata: UniverseMetadata | null;
}

export function CryptoUniverseInsights({ coins, metadata }: CryptoUniverseInsightsProps) {
  const formatCurrency = (value: number) => {
    if (value >= 1e12) return `$${(value / 1e12).toFixed(2)}T`;
    if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
    if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
    return `$${value.toFixed(2)}`;
  };

  const topGainers = [...coins]
    .sort((a, b) => b.percent_change_24h - a.percent_change_24h)
    .slice(0, 5);

  const topLosers = [...coins]
    .sort((a, b) => a.percent_change_24h - b.percent_change_24h)
    .slice(0, 5);

  const topGalaxyScores = [...coins]
    .sort((a, b) => b.galaxy_score - a.galaxy_score)
    .slice(0, 5);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Market Overview */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Market Overview</CardTitle>
          <DollarSign className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div>
              <div className="text-xs text-muted-foreground">Total Market Cap</div>
              <div className="text-2xl font-bold">
                {metadata ? formatCurrency(metadata.total_market_cap) : '-'}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">24h Volume</div>
              <div className="text-lg font-semibold">
                {metadata ? formatCurrency(metadata.total_volume_24h) : '-'}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Assets Tracked</div>
              <div className="text-lg font-semibold">{metadata?.total_coins || 0}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Top Gainers */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Top Gainers (24h)</CardTitle>
          <TrendingUp className="h-4 w-4 text-green-500" />
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {topGainers.map((coin) => (
              <div key={coin.id} className="flex justify-between items-center">
                <span className="text-sm font-medium">{coin.symbol}</span>
                <span className="text-sm text-green-500 font-semibold">
                  +{coin.percent_change_24h.toFixed(2)}%
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Top Losers */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Top Losers (24h)</CardTitle>
          <TrendingDown className="h-4 w-4 text-red-500" />
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {topLosers.map((coin) => (
              <div key={coin.id} className="flex justify-between items-center">
                <span className="text-sm font-medium">{coin.symbol}</span>
                <span className="text-sm text-red-500 font-semibold">
                  {coin.percent_change_24h.toFixed(2)}%
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Galaxy Score Leaders */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Galaxy Score Leaders</CardTitle>
          <Star className="h-4 w-4 text-yellow-500" />
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {topGalaxyScores.map((coin) => (
              <div key={coin.id} className="flex justify-between items-center">
                <span className="text-sm font-medium">{coin.symbol}</span>
                <div className="flex items-center gap-1">
                  <Activity className="h-3 w-3 text-primary" />
                  <span className="text-sm font-semibold">{coin.galaxy_score}</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
