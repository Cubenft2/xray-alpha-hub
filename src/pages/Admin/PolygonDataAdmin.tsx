import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2, TrendingUp, BarChart3 } from 'lucide-react';

export function PolygonDataAdmin() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [indicatorsLoading, setIndicatorsLoading] = useState(false);
  
  // Historical data form state
  const [ticker, setTicker] = useState('BTC');
  const [timeframe, setTimeframe] = useState<'1min' | '5min' | '1hour' | '1day'>('1day');
  const [assetType, setAssetType] = useState<'crypto' | 'stock'>('crypto');
  const [fromDate, setFromDate] = useState(() => {
    const date = new Date();
    date.setMonth(date.getMonth() - 3);
    return date.toISOString().split('T')[0];
  });
  const [toDate, setToDate] = useState(() => new Date().toISOString().split('T')[0]);

  const handleFetchHistoricalData = async () => {
    setLoading(true);
    try {
      console.log('📊 Fetching historical data for:', ticker);
      
      const { data, error } = await supabase.functions.invoke('polygon-historical-data', {
        body: {
          ticker,
          timeframe,
          from: fromDate,
          to: toDate,
          asset_type: assetType
        }
      });

      if (error) throw error;

      toast({
        title: 'Historical Data Fetched',
        description: `${data.bars_count} bars fetched for ${ticker}. ${data.cached ? '(Cached)' : ''}`,
      });

      console.log('✅ Historical data:', data);
    } catch (error) {
      console.error('Error fetching historical data:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to fetch historical data',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRefreshTechnicalIndicators = async () => {
    setIndicatorsLoading(true);
    try {
      console.log('📈 Refreshing technical indicators...');
      
      const { data, error } = await supabase.functions.invoke('polygon-technical-indicators', {
        body: {
          tickers: ['BTC', 'ETH', 'SOL', 'AAPL', 'TSLA', 'COIN', 'MSTR', 'XRP', 'ADA'],
          indicators: ['rsi', 'macd', 'sma_50', 'ema_20'],
          timeframe: 'daily'
        }
      });

      if (error) throw error;

      toast({
        title: 'Technical Indicators Refreshed',
        description: `Indicators fetched for ${data.tickers_processed} tickers`,
      });

      console.log('✅ Technical indicators:', data);
    } catch (error) {
      console.error('Error fetching technical indicators:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to fetch technical indicators',
        variant: 'destructive',
      });
    } finally {
      setIndicatorsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Historical Data Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Historical OHLC Data (Priority 1)
          </CardTitle>
          <CardDescription>
            Fetch historical price bars from Polygon.io. Data is cached for 24 hours (daily/hourly) or 5 minutes (minute bars).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="ticker">Ticker Symbol</Label>
              <Input
                id="ticker"
                value={ticker}
                onChange={(e) => setTicker(e.target.value.toUpperCase())}
                placeholder="BTC, AAPL, etc."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="assetType">Asset Type</Label>
              <Select value={assetType} onValueChange={(v) => setAssetType(v as 'crypto' | 'stock')}>
                <SelectTrigger id="assetType">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="crypto">Crypto</SelectItem>
                  <SelectItem value="stock">Stock</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="timeframe">Timeframe</Label>
              <Select value={timeframe} onValueChange={(v) => setTimeframe(v as any)}>
                <SelectTrigger id="timeframe">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1min">1 Minute</SelectItem>
                  <SelectItem value="5min">5 Minutes</SelectItem>
                  <SelectItem value="1hour">1 Hour</SelectItem>
                  <SelectItem value="1day">1 Day</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="fromDate">From Date</Label>
              <Input
                id="fromDate"
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="toDate">To Date</Label>
              <Input
                id="toDate"
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
              />
            </div>
          </div>

          <Button
            onClick={handleFetchHistoricalData}
            disabled={loading || !ticker}
            className="w-full"
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Fetch Historical Data
          </Button>

          <div className="text-sm text-muted-foreground space-y-1 mt-4">
            <p><strong>Usage:</strong> This data can be used to power custom charts, calculate volatility, or analyze historical patterns.</p>
            <p><strong>Example:</strong> BTC crypto 1day from 3 months ago</p>
          </div>
        </CardContent>
      </Card>

      {/* Technical Indicators Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Technical Indicators (Priority 2)
          </CardTitle>
          <CardDescription>
            Refresh technical indicators (RSI, MACD, SMA, EMA) for key assets. Used in daily market briefs.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <p className="font-medium">Default Tickers:</p>
            <p className="text-sm text-muted-foreground">
              BTC, ETH, SOL, AAPL, TSLA, COIN, MSTR, XRP, ADA
            </p>
            <p className="font-medium mt-3">Indicators:</p>
            <p className="text-sm text-muted-foreground">
              RSI (14), MACD (12,26,9), SMA (50), EMA (20)
            </p>
          </div>

          <Button
            onClick={handleRefreshTechnicalIndicators}
            disabled={indicatorsLoading}
            className="w-full"
          >
            {indicatorsLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Refresh Technical Indicators
          </Button>

          <div className="text-sm text-muted-foreground space-y-1 mt-4">
            <p><strong>Cache Duration:</strong> 1 hour</p>
            <p><strong>Integration:</strong> Automatically used in market brief generation</p>
            <p><strong>Example Output:</strong> "Bitcoin (BTC): RSI 72 (overbought), MACD bullish crossover"</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
