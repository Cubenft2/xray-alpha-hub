import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowUpIcon, ArrowDownIcon, TrendingUpIcon } from 'lucide-react';

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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUpIcon className="h-5 w-5" />
          Available on {exchanges.length} Exchanges
        </CardTitle>
        <div className="text-sm text-muted-foreground">
          Price spread: {priceSpread}% ({formatPrice(lowestPrice)} - {formatPrice(highestPrice)})
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
