import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { TrendingUp, TrendingDown, DollarSign, Activity, ExternalLink } from 'lucide-react';

interface MarketOverviewProps {
  marketData: any;
}

export function MarketOverview({ marketData }: MarketOverviewProps) {
  const navigate = useNavigate();

  if (!marketData?.content_sections?.market_data) {
    return null;
  }

  const data = marketData.content_sections.market_data;
  
  // Client-side fallback for global totals when brief has 0
  const [globalFallback, setGlobalFallback] = React.useState<{ marketCap: number; volume: number }>({ marketCap: 0, volume: 0 });
  React.useEffect(() => {
    const needsCap = !(data?.total_market_cap > 0);
    const needsVol = !(data?.total_volume > 0);
    if (!needsCap && !needsVol) return;
    (async () => {
      try {
        const res = await fetch('https://api.coingecko.com/api/v3/global');
        const json = await res.json();
        const mc = json?.data?.total_market_cap?.usd ?? 0;
        const tv = json?.data?.total_volume?.usd ?? 0;
        setGlobalFallback({ marketCap: mc, volume: tv });
        console.info('MarketOverview: loaded global fallback', { mc, tv });
      } catch (e) {
        console.warn('MarketOverview: global fallback failed', e);
      }
    })();
  }, [data?.total_market_cap, data?.total_volume]);

  // Derive biggest mover if not provided
  const biggestMoverData = data.biggest_mover || (() => {
    const candidates = [...(data.top_gainers || []), ...(data.top_losers || [])];
    if (!candidates.length) return null;
    return candidates
      .slice()
      .sort((a: any, b: any) => Math.abs((b.change_24h || 0)) - Math.abs((a.change_24h || 0)))[0];
  })();
  
  const totalMarketCap = (data?.total_market_cap && data.total_market_cap > 0) ? data.total_market_cap : globalFallback.marketCap;
  const totalVolume = (data?.total_volume && data.total_volume > 0) ? data.total_volume : globalFallback.volume;
  
  // Hide if all key metrics are zero/empty
  const hasData = (totalMarketCap || 0) > 0 || (totalVolume || 0) > 0 || 
                  (data.fear_greed_index || 0) > 0 || !!biggestMoverData;
  
  if (!hasData) {
    return (
      <Card className="xr-card">
        <CardContent className="p-6 text-center">
          <p className="text-muted-foreground">Market overview data temporarily unavailable</p>
        </CardContent>
      </Card>
    );
  }

  const handleCryptoNavigation = () => {
    navigate('/crypto');
  };

  const handleStockNavigation = () => {
    navigate('/markets');
  };
  
  const formatCurrency = (value: number) => {
    if (value >= 1e12) return `$${(value / 1e12).toFixed(2)}T`;
    if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
    if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
    return `$${value.toLocaleString()}`;
  };

  const getFearGreedColor = (value: number) => {
    if (value <= 25) return 'text-red-500 border-red-500/20 bg-red-500/10';
    if (value <= 45) return 'text-orange-500 border-orange-500/20 bg-orange-500/10';
    if (value <= 55) return 'text-yellow-500 border-yellow-500/20 bg-yellow-500/10';
    if (value <= 75) return 'text-green-500 border-green-500/20 bg-green-500/10';
    return 'text-emerald-500 border-emerald-500/20 bg-emerald-500/10';
  };

  const getTrendIcon = (trend: number) => {
    if (trend > 0) return <TrendingUp className="w-4 h-4 text-green-500" />;
    if (trend < 0) return <TrendingDown className="w-4 h-4 text-red-500" />;
    return <Activity className="w-4 h-4 text-muted-foreground" />;
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Total Market Cap */}
      <Card className="xr-card hover:bg-accent/20 transition-colors cursor-pointer group" onClick={handleCryptoNavigation}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-green-500" />
              <div>
                <p className="text-sm text-muted-foreground">Total Market Cap</p>
                <p className="text-xl font-bold text-green-500 group-hover:text-green-400 transition-colors">
                  {formatCurrency(totalMarketCap || 0)}
                </p>
              </div>
            </div>
            <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100 transition-opacity">
              <ExternalLink className="w-4 h-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 24h Volume */}
      <Card className="xr-card hover:bg-accent/20 transition-colors cursor-pointer group" onClick={handleCryptoNavigation}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-blue-500" />
              <div>
                <p className="text-sm text-muted-foreground">24h Volume</p>
                <p className="text-xl font-bold text-blue-500 group-hover:text-blue-400 transition-colors">
                  {formatCurrency(totalVolume || 0)}
                </p>
              </div>
            </div>
            <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100 transition-opacity">
              <ExternalLink className="w-4 h-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Fear & Greed Index */}
      <Card className="xr-card hover:bg-accent/20 transition-colors cursor-pointer group" onClick={handleStockNavigation}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {getTrendIcon(data.fear_greed_trend || 0)}
              <div>
                <p className="text-sm text-muted-foreground">Fear & Greed</p>
                <div className="flex items-center gap-2">
                  <p className="text-xl font-bold text-foreground">
                    {data.fear_greed_index || 50}
                  </p>
                  <Badge variant="outline" className={`${getFearGreedColor(data.fear_greed_index || 50)} font-semibold`}>
                    {data.fear_greed_label || 'Neutral'}
                  </Badge>
                </div>
              </div>
            </div>
            <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100 transition-opacity">
              <ExternalLink className="w-4 h-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Biggest Mover */}
      <Card className="xr-card hover:bg-accent/20 transition-colors cursor-pointer group" onClick={handleCryptoNavigation}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-yellow-500" />
              <div>
                <p className="text-sm text-muted-foreground">Biggest Mover</p>
                {biggestMoverData ? (
                  <>
                    <div className="space-y-1">
                      <p className="text-lg font-bold text-[#00e5ff]">
                        {biggestMoverData.name}
                      </p>
                      <div className="flex items-center gap-2">
                        {typeof biggestMoverData.change_24h === 'number' && (
                          <Badge 
                            variant="outline" 
                            className={`${biggestMoverData.change_24h > 0 
                              ? 'text-[#22c55e] border-[#22c55e]/20 bg-[#22c55e]/10' 
                              : 'text-[#ef4444] border-[#ef4444]/20 bg-[#ef4444]/10'
                            } font-bold text-xs`}
                          >
                            {biggestMoverData.change_24h > 0 ? '+' : ''}
                            {biggestMoverData.change_24h.toFixed(2)}%
                          </Badge>
                        )}
                      </div>
                    </div>
                  </>
                ) : (
                  <p className="text-muted-foreground">No data available</p>
                )}
              </div>
            </div>
            <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100 transition-opacity">
              <ExternalLink className="w-4 h-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}