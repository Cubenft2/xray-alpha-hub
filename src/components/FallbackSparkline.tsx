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

  useEffect(() => {
    fetchSparklineData();
  }, [symbol, coingeckoId, polygonTicker, timespan]);

  const fetchSparklineData = async () => {
    setLoading(true);
    setError(null);

    try {
      // Try Polygon first if we have a ticker
      if (polygonTicker) {
        const polygonApiKey = import.meta.env.VITE_POLYGON_API_KEY;
        if (polygonApiKey) {
          const days = timespan === '1D' ? 1 : timespan === '7D' ? 7 : timespan === '30D' ? 30 : timespan === '90D' ? 90 : 365;
          const multiplier = timespan === '1D' ? 1 : 1;
          const timeunit = timespan === '1D' ? 'hour' : 'day';
          
          const fromDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
          const toDate = new Date().toISOString().split('T')[0];
          
          const url = `https://api.polygon.io/v2/aggs/ticker/${polygonTicker}/range/${multiplier}/${timeunit}/${fromDate}/${toDate}?apiKey=${polygonApiKey}`;
          const response = await fetch(url);
          
          if (response.ok) {
            const json = await response.json();
            if (json.results && json.results.length > 0) {
              const points = json.results.map((r: any) => ({
                time: r.t,
                price: r.c
              }));
              setData(points);
              setLoading(false);
              return;
            }
          }
        }
      }

      // Fallback to CoinGecko if available
      if (coingeckoId) {
        const days = timespan === '1D' ? 1 : timespan === '7D' ? 7 : timespan === '30D' ? 30 : timespan === '90D' ? 90 : 365;
        
        const url = `https://api.coingecko.com/api/v3/coins/${coingeckoId}/market_chart?vs_currency=usd&days=${days}`;
        const response = await fetch(url);
        
        if (response.ok) {
          const json = await response.json();
          if (json.prices && json.prices.length > 0) {
            const points = json.prices.map(([time, price]: [number, number]) => ({
              time,
              price
            }));
            setData(points);
            setLoading(false);
            return;
          }
        }
      }

      setError('No data available');
    } catch (err) {
      console.error('Sparkline fetch error:', err);
      setError('Failed to load chart');
    } finally {
      setLoading(false);
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