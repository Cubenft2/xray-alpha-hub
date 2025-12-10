import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2, TrendingUp, BarChart3 } from 'lucide-react';

export function PolygonDataAdmin() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [indicatorsLoading, setIndicatorsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressText, setProgressText] = useState('');
  const [tickerCount, setTickerCount] = useState(0);
  
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

  // Fetch ticker count on mount
  useEffect(() => {
    const fetchTickerCount = async () => {
      const { count } = await supabase
        .from('polygon_assets')
        .select('*', { count: 'exact', head: true })
        .eq('market', 'crypto')
        .eq('is_active', true);
      
      setTickerCount(count || 0);
    };
    fetchTickerCount();
  }, []);

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
    setProgress(0);
    setProgressText('Fetching tickers...');

    try {
      // Fetch ALL active crypto tickers from polygon_assets
      const { data: allTickers, error: tickerError } = await supabase
        .from('polygon_assets')
        .select('assets!inner(symbol)')
        .eq('market', 'crypto')
        .eq('is_active', true);

      if (tickerError) throw tickerError;

      if (!allTickers || allTickers.length === 0) {
        throw new Error('No active crypto tickers found');
      }

      const symbols = allTickers.map((t: any) => t.assets?.symbol).filter(Boolean);
      console.log(`📈 Processing technical indicators for ${symbols.length} tickers...`);

      // Process in batches of 50 to avoid timeouts
      const batchSize = 50;
      const batches = [];
      for (let i = 0; i < symbols.length; i += batchSize) {
        batches.push(symbols.slice(i, i + batchSize));
      }

      let totalProcessed = 0;
      let totalSuccess = 0;

      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        setProgressText(`Processing batch ${i + 1}/${batches.length} (${batch.length} tickers)...`);
        setProgress(Math.round((i / batches.length) * 100));

        try {
          const { data, error } = await supabase.functions.invoke('polygon-technical-indicators', {
            body: {
              tickers: batch,
              indicators: ['rsi', 'macd', 'sma_50', 'ema_20'],
              timeframe: 'daily'
            }
          });

          if (error) {
            console.error(`Batch ${i + 1} error:`, error);
          } else {
            totalSuccess += data?.tickers_processed || batch.length;
          }
        } catch (batchError) {
          console.error(`Batch ${i + 1} exception:`, batchError);
        }

        totalProcessed += batch.length;

        // Small delay between batches
        if (i < batches.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }

      setProgress(100);
      setProgressText('Complete!');

      toast({
        title: 'Technical Indicators Refreshed',
        description: `Processed ${totalProcessed} tickers in ${batches.length} batches`,
      });

      console.log('✅ Technical indicators complete:', { totalProcessed, totalSuccess });
    } catch (error) {
      console.error('Error fetching technical indicators:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to fetch technical indicators',
        variant: 'destructive',
      });
    } finally {
      setIndicatorsLoading(false);
      setTimeout(() => {
        setProgress(0);
        setProgressText('');
      }, 3000);
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
            Technical Indicators (All Tickers)
          </CardTitle>
          <CardDescription>
            Refresh technical indicators (RSI, MACD, SMA, EMA) for ALL {tickerCount} active crypto tickers. Processed in batches.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <p className="font-medium">Dynamic Ticker Processing:</p>
            <p className="text-sm text-muted-foreground">
              Will process <strong>{tickerCount}</strong> active crypto tickers with Polygon mappings
            </p>
            <p className="font-medium mt-3">Indicators:</p>
            <p className="text-sm text-muted-foreground">
              RSI (14), MACD (12,26,9), SMA (50), EMA (20)
            </p>
            <p className="font-medium mt-3">Batch Size:</p>
            <p className="text-sm text-muted-foreground">
              50 tickers per batch to avoid timeouts
            </p>
          </div>

          {indicatorsLoading && (
            <div className="space-y-2">
              <Progress value={progress} className="w-full" />
              <p className="text-sm text-center text-muted-foreground">{progressText}</p>
            </div>
          )}

          <Button
            onClick={handleRefreshTechnicalIndicators}
            disabled={indicatorsLoading}
            className="w-full"
          >
            {indicatorsLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Refresh All Technical Indicators
          </Button>

          <div className="text-sm text-muted-foreground space-y-1 mt-4">
            <p><strong>Cache Duration:</strong> 1 hour</p>
            <p><strong>Integration:</strong> Automatically used in market brief generation</p>
            <p><strong>Estimated Time:</strong> ~{Math.ceil(tickerCount / 50) * 2} seconds for {Math.ceil(tickerCount / 50)} batches</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
