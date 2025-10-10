import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface FallbackSparklineProps {
  symbol: string;
  coingeckoId?: string;
  polygonTicker?: string;
  timespan?: '1D' | '7D' | '30D' | '90D' | '1Y';
  className?: string;
}

interface DataPoint {
  time: number;
  price: number;
}

export function FallbackSparkline({ 
  symbol, 
  coingeckoId, 
  polygonTicker, 
  timespan = '7D',
  className = ''
}: FallbackSparklineProps) {
  const [data, setData] = useState<DataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    fetchSparklineData();
  }, [symbol, coingeckoId, polygonTicker, timespan]);

  const fetchSparklineData = async (attempt = 0) => {
    setLoading(true);
    setError(null);

    try {
      // Try CoinGecko first if available (public API, no key required)
      if (coingeckoId) {
        const days = timespan === '1D' ? 1 : timespan === '7D' ? 7 : timespan === '30D' ? 30 : timespan === '90D' ? 90 : 365;
        
        console.log(`📈 Fetching CoinGecko data for ${symbol} (${coingeckoId}), ${days} days`);
        const url = `https://api.coingecko.com/api/v3/coins/${coingeckoId}/market_chart?vs_currency=usd&days=${days}`;
        const response = await fetch(url);
        
        if (response.ok) {
          const json = await response.json();
          if (json.prices && json.prices.length > 0) {
            const points = json.prices.map(([time, price]: [number, number]) => ({
              time,
              price
            }));
            console.log(`✅ CoinGecko data loaded for ${symbol}: ${points.length} points`);
            setData(points);
            setLoading(false);
            return;
          }
        } else {
          console.warn(`⚠️ CoinGecko API error for ${symbol}: ${response.status}`);
        }
      }

      // Try price_history table as fallback for Polygon data
      if (polygonTicker) {
        console.log(`📊 Fetching price history for ${symbol} (${polygonTicker})`);
        const days = timespan === '1D' ? 1 : timespan === '7D' ? 7 : timespan === '30D' ? 30 : timespan === '90D' ? 90 : 365;
        const fromDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
        
        const { data: historyData, error: historyError } = await supabase
          .from('price_history')
          .select('timestamp, close')
          .eq('ticker', polygonTicker)
          .gte('timestamp', fromDate)
          .order('timestamp', { ascending: true });

        if (!historyError && historyData && historyData.length > 0) {
          const points = historyData.map((r: any) => ({
            time: new Date(r.timestamp).getTime(),
            price: parseFloat(r.close)
          }));
          console.log(`✅ Price history loaded for ${symbol}: ${points.length} points`);
          setData(points);
          setLoading(false);
          return;
        } else {
          console.warn(`⚠️ No price history found for ${symbol}`);
        }
      }

      // Retry logic with exponential backoff (max 2 retries)
      if (attempt < 2) {
        const delay = Math.pow(2, attempt) * 2000; // 2s, 4s
        console.log(`Retrying sparkline fetch for ${symbol} in ${delay}ms (attempt ${attempt + 1}/2)`);
        setTimeout(() => fetchSparklineData(attempt + 1), delay);
        return;
      }
      
      setError('No data available');
    } catch (err) {
      console.error('Sparkline fetch error:', err);
      
      // Retry logic for errors (max 2 retries)
      if (attempt < 2) {
        const delay = Math.pow(2, attempt) * 2000; // 2s, 4s
        console.log(`Retrying sparkline fetch for ${symbol} in ${delay}ms (attempt ${attempt + 1}/2)`);
        setTimeout(() => fetchSparklineData(attempt + 1), delay);
        return;
      }
      
      setError('Failed to load chart');
    } finally {
      setLoading(false);
      setRetryCount(attempt);
    }
  };

  if (loading) {
    return (
      <div className={`flex items-center justify-center h-16 ${className}`}>
        <div className="text-muted-foreground text-sm">Loading...</div>
      </div>
    );
  }

  if (error || data.length === 0) {
    return (
      <div className={`flex items-center justify-center h-16 ${className}`}>
        <div className="text-muted-foreground text-sm">{error || 'No data'}</div>
      </div>
    );
  }

  // Calculate dimensions and path
  const width = 200;
  const height = 64;
  const padding = 4;

  const minPrice = Math.min(...data.map(d => d.price));
  const maxPrice = Math.max(...data.map(d => d.price));
  const priceRange = maxPrice - minPrice || 1;

  const points = data.map((d, i) => {
    const x = padding + (i / (data.length - 1)) * (width - 2 * padding);
    const y = height - padding - ((d.price - minPrice) / priceRange) * (height - 2 * padding);
    return `${x},${y}`;
  }).join(' ');

  const pathD = `M ${points.split(' ').join(' L ')}`;
  
  // Determine color based on first vs last price
  const isPositive = data[data.length - 1].price >= data[0].price;
  const strokeColor = isPositive ? 'rgb(34, 197, 94)' : 'rgb(239, 68, 68)';

  return (
    <div className={`relative ${className}`}>
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <path
          d={pathD}
          fill="none"
          stroke={strokeColor}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}