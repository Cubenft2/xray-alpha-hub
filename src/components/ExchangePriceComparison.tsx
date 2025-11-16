import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowUpIcon, ArrowDownIcon, TrendingUpIcon, Clock, AlertTriangle } from 'lucide-react';

interface ExchangePrice {
  exchange: string;
  price: number;
  volume_24h: number;
  change_24h: number;
  high_24h?: number;
  low_24h?: number;
  last_updated: string;
}

interface ExchangePriceComparisonProps {
  symbol: string;
}

export function ExchangePriceComparison({ symbol }: ExchangePriceComparisonProps) {
  const [exchanges, setExchanges] = useState<ExchangePrice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchExchangeData();
  }, [symbol]);

  const fetchExchangeData = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('exchange_ticker_data')
        .select('*')
        .eq('asset_symbol', symbol)
        .order('volume_24h', { ascending: false });

      if (error) {
        console.error('Error fetching exchange data:', error);
        return;
      }

      setExchanges(data || []);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatPrice = (price: number) => {
    if (price < 0.01) return `$${price.toFixed(6)}`;
    if (price < 1) return `$${price.toFixed(4)}`;
    return `$${price.toFixed(2)}`;
  };

  const formatVolume = (volume: number) => {
    if (volume >= 1e9) return `$${(volume / 1e9).toFixed(2)}B`;
    if (volume >= 1e6) return `$${(volume / 1e6).toFixed(2)}M`;
    if (volume >= 1e3) return `$${(volume / 1e3).toFixed(2)}K`;
    return `$${volume.toFixed(0)}`;
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUpIcon className="h-5 w-5" />
            Exchange Prices
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">Loading exchange data...</div>
        </CardContent>
      </Card>
    );
  }

  if (exchanges.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUpIcon className="h-5 w-5" />
            Exchange Prices
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">
            No exchange data available for {symbol}
          </div>
        </CardContent>
      </Card>
    );
  }

  const highestPrice = Math.max(...exchanges.map(e => e.price));
  const lowestPrice = Math.min(...exchanges.map(e => e.price));
  const priceSpread = ((highestPrice - lowestPrice) / lowestPrice * 100).toFixed(2);

  // Calculate data freshness
  const mostRecentUpdate = exchanges.reduce((latest, exchange) => {
    const updateTime = new Date(exchange.last_updated).getTime();
    return updateTime > latest ? updateTime : latest;
  }, 0);

  const hoursSinceUpdate = (Date.now() - mostRecentUpdate) / (1000 * 60 * 60);
  
  const getFreshnessStatus = () => {
    if (hoursSinceUpdate < 1) return { label: 'Fresh', variant: 'default' as const, color: 'text-success' };
    if (hoursSinceUpdate < 6) return { label: 'Recent', variant: 'secondary' as const, color: 'text-warning' };
    return { label: 'Stale', variant: 'destructive' as const, color: 'text-destructive' };
  };

  const getTimeAgo = () => {
    if (hoursSinceUpdate < 1) {
      const minutes = Math.floor(hoursSinceUpdate * 60);
      return `${minutes}m ago`;
    }
    if (hoursSinceUpdate < 24) {
      return `${Math.floor(hoursSinceUpdate)}h ago`;
    }
    const days = Math.floor(hoursSinceUpdate / 24);
    return `${days}d ago`;
  };

  const freshness = getFreshnessStatus();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUpIcon className="h-5 w-5" />
          Available on {exchanges.length} Exchanges
        </CardTitle>
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span>Last updated: {getTimeAgo()}</span>
            <Badge variant={freshness.variant} className="ml-2">
              {freshness.label}
            </Badge>
          </div>
          {hoursSinceUpdate > 1 && (
            <div className="flex items-center gap-2 text-sm text-warning">
              <AlertTriangle className="h-3 w-3" />
              <span>Price data may not be current</span>
            </div>
          )}
          <div className="text-sm text-muted-foreground">
            Price spread: {priceSpread}% ({formatPrice(lowestPrice)} - {formatPrice(highestPrice)})
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {exchanges.map((exchange) => (
            <div
              key={exchange.exchange}
              className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
            >
              <div className="flex-1">
                <div className="font-semibold capitalize">{exchange.exchange}</div>
                <div className="text-sm text-muted-foreground">
                  Vol: {formatVolume(exchange.volume_24h)}
                </div>
              </div>
              
              <div className="text-right">
                <div className="font-mono font-bold">{formatPrice(exchange.price)}</div>
                <div className={`flex items-center gap-1 text-sm ${
                  exchange.change_24h >= 0 ? 'text-success' : 'text-destructive'
                }`}>
                  {exchange.change_24h >= 0 ? (
                    <ArrowUpIcon className="h-3 w-3" />
                  ) : (
                    <ArrowDownIcon className="h-3 w-3" />
                  )}
                  {Math.abs(exchange.change_24h).toFixed(2)}%
                </div>
              </div>
            </div>
          ))}
        </div>

        {exchanges.length > 3 && (
          <div className="mt-4 pt-4 border-t">
            <Badge variant="secondary" className="w-full justify-center">
              Showing all {exchanges.length} exchanges
            </Badge>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
