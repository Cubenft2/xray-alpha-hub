import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useToast } from '@/hooks/use-toast';
import { useQuery } from '@tanstack/react-query';
import { 
  Loader2, RefreshCw, Database, TrendingUp, BarChart3, 
  Coins, Clock, CheckCircle, ArrowUpDown, Link2
} from 'lucide-react';

export function DataSources() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Data Sources</h1>
        <p className="text-muted-foreground">
          Manage data synchronization from all connected sources
        </p>
      </div>

      <Tabs defaultValue="polygon" className="space-y-4">
        <TabsList className="grid grid-cols-5 w-full">
          <TabsTrigger value="polygon">Polygon</TabsTrigger>
          <TabsTrigger value="coingecko">CoinGecko</TabsTrigger>
          <TabsTrigger value="lunarcrush">LunarCrush</TabsTrigger>
          <TabsTrigger value="exchanges">Exchanges</TabsTrigger>
          <TabsTrigger value="contracts">Contracts</TabsTrigger>
        </TabsList>

        <TabsContent value="polygon">
          <PolygonTab />
        </TabsContent>

        <TabsContent value="coingecko">
          <CoinGeckoTab />
        </TabsContent>

        <TabsContent value="lunarcrush">
          <LunarCrushTab />
        </TabsContent>

        <TabsContent value="exchanges">
          <ExchangesTab />
        </TabsContent>

        <TabsContent value="contracts">
          <ContractsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ============= POLYGON TAB =============
function PolygonTab() {
  const [pollingCrypto, setPollingCrypto] = useState(false);
  const [pollingStocks, setPollingStocks] = useState(false);
  const [refreshingIndicators, setRefreshingIndicators] = useState(false);
  const [historicalLoading, setHistoricalLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressText, setProgressText] = useState('');
  
  // Historical data form
  const [ticker, setTicker] = useState('BTC');
  const [timeframe, setTimeframe] = useState<'1min' | '5min' | '1hour' | '1day'>('1day');
  const [assetType, setAssetType] = useState<'crypto' | 'stock'>('crypto');
  const [fromDate, setFromDate] = useState(() => {
    const date = new Date();
    date.setMonth(date.getMonth() - 3);
    return date.toISOString().split('T')[0];
  });
  const [toDate, setToDate] = useState(() => new Date().toISOString().split('T')[0]);

  const { data: stats, refetch } = useQuery({
    queryKey: ['polygon-stats'],
    queryFn: async () => {
      const [cryptoAssets, stockAssets, livePrices, recentPrice] = await Promise.all([
        supabase.from('polygon_assets').select('*', { count: 'exact', head: true }).eq('market', 'crypto'),
        supabase.from('polygon_assets').select('*', { count: 'exact', head: true }).eq('market', 'stocks'),
        supabase.from('live_prices').select('*', { count: 'exact', head: true }),
        supabase.from('live_prices').select('updated_at').order('updated_at', { ascending: false }).limit(1).single()
      ]);

      return {
        cryptoCount: cryptoAssets.count || 0,
        stockCount: stockAssets.count || 0,
        livePricesCount: livePrices.count || 0,
        lastUpdated: recentPrice.data?.updated_at
      };
    },
    refetchInterval: 30000
  });

  const formatLastUpdate = (timestamp: string | null | undefined) => {
    if (!timestamp) return 'Never';
    const date = new Date(timestamp);
    const diffMins = Math.floor((Date.now() - date.getTime()) / 1000 / 60);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
    return `${Math.floor(diffMins / 1440)}d ago`;
  };

  const handlePollCrypto = async () => {
    setPollingCrypto(true);
    try {
      const { data, error } = await supabase.functions.invoke('polygon-rest-poller');
      if (error) throw error;
      toast.success(`Crypto prices polled: ${data.processed || 0} updated`);
      refetch();
    } catch (error: any) {
      toast.error('Failed to poll crypto prices', { description: error.message });
    } finally {
      setPollingCrypto(false);
    }
  };

  const handlePollStocks = async () => {
    setPollingStocks(true);
    try {
      const { data, error } = await supabase.functions.invoke('polygon-stock-poller');
      if (error) throw error;
      toast.success(`Stock prices polled: ${data.processed || 0} updated`);
      refetch();
    } catch (error: any) {
      toast.error('Failed to poll stock prices', { description: error.message });
    } finally {
      setPollingStocks(false);
    }
  };

  const handleRefreshIndicators = async () => {
    setRefreshingIndicators(true);
    setProgress(0);
    try {
      const { data: tickers } = await supabase
        .from('polygon_assets')
        .select('assets!inner(symbol)')
        .eq('market', 'crypto')
        .eq('is_active', true);

      const symbols = tickers?.map((t: any) => t.assets?.symbol).filter(Boolean) || [];
      const batchSize = 50;
      const batches = [];
      for (let i = 0; i < symbols.length; i += batchSize) {
        batches.push(symbols.slice(i, i + batchSize));
      }

      for (let i = 0; i < batches.length; i++) {
        setProgressText(`Batch ${i + 1}/${batches.length}`);
        setProgress(Math.round((i / batches.length) * 100));
        await supabase.functions.invoke('polygon-technical-indicators', {
          body: { tickers: batches[i], indicators: ['rsi', 'macd', 'sma_50', 'ema_20'] }
        });
      }
      setProgress(100);
      toast.success(`Technical indicators refreshed for ${symbols.length} tickers`);
    } catch (error: any) {
      toast.error('Failed to refresh indicators', { description: error.message });
    } finally {
      setRefreshingIndicators(false);
      setTimeout(() => { setProgress(0); setProgressText(''); }, 2000);
    }
  };

  const handleFetchHistorical = async () => {
    setHistoricalLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('polygon-historical-data', {
        body: { ticker, timeframe, from: fromDate, to: toDate, asset_type: assetType }
      });
      if (error) throw error;
      toast.success(`Historical data fetched: ${data.bars_count} bars`);
    } catch (error: any) {
      toast.error('Failed to fetch historical data', { description: error.message });
    } finally {
      setHistoricalLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Stats Overview */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{stats?.cryptoCount.toLocaleString() || 0}</div>
            <p className="text-xs text-muted-foreground">Crypto Assets</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{stats?.stockCount.toLocaleString() || 0}</div>
            <p className="text-xs text-muted-foreground">Stock Assets</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{stats?.livePricesCount.toLocaleString() || 0}</div>
            <p className="text-xs text-muted-foreground">Live Prices</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-primary">{formatLastUpdate(stats?.lastUpdated)}</div>
            <p className="text-xs text-muted-foreground">Last Updated</p>
          </CardContent>
        </Card>
      </div>

      {/* Price Polling */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5" />
            Price Polling
          </CardTitle>
          <CardDescription>
            Cron: crypto every 2min, stocks every 5min (15-min delayed)
          </CardDescription>
        </CardHeader>
        <CardContent className="flex gap-4">
          <Button onClick={handlePollCrypto} disabled={pollingCrypto} className="flex-1">
            {pollingCrypto && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <Coins className="mr-2 h-4 w-4" />
            Poll Crypto
          </Button>
          <Button onClick={handlePollStocks} disabled={pollingStocks} className="flex-1" variant="outline">
            {pollingStocks && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <TrendingUp className="mr-2 h-4 w-4" />
            Poll Stocks
          </Button>
        </CardContent>
      </Card>

      {/* Technical Indicators */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Technical Indicators
          </CardTitle>
          <CardDescription>
            RSI, MACD, SMA, EMA for all active crypto tickers (hourly cron)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {refreshingIndicators && (
            <div className="space-y-2">
              <Progress value={progress} />
              <p className="text-sm text-center text-muted-foreground">{progressText}</p>
            </div>
          )}
          <Button onClick={handleRefreshIndicators} disabled={refreshingIndicators} className="w-full">
            {refreshingIndicators && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Refresh All Indicators
          </Button>
        </CardContent>
      </Card>

      {/* Historical Data */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Historical OHLC Data
          </CardTitle>
          <CardDescription>
            Fetch historical price bars for any ticker
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="space-y-2">
              <Label>Ticker</Label>
              <Input value={ticker} onChange={(e) => setTicker(e.target.value.toUpperCase())} placeholder="BTC" />
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={assetType} onValueChange={(v) => setAssetType(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="crypto">Crypto</SelectItem>
                  <SelectItem value="stock">Stock</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Timeframe</Label>
              <Select value={timeframe} onValueChange={(v) => setTimeframe(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1min">1 Min</SelectItem>
                  <SelectItem value="5min">5 Min</SelectItem>
                  <SelectItem value="1hour">1 Hour</SelectItem>
                  <SelectItem value="1day">1 Day</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>From</Label>
              <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>To</Label>
              <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
            </div>
          </div>
          <Button onClick={handleFetchHistorical} disabled={historicalLoading || !ticker} className="w-full">
            {historicalLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Fetch Historical Data
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

// ============= COINGECKO TAB =============
function CoinGeckoTab() {
  const [syncing, setSyncing] = useState(false);
  const [enriching, setEnriching] = useState(false);
  const [batchSize, setBatchSize] = useState(50);
  const { toast } = useToast();

  const { data: stats, refetch } = useQuery({
    queryKey: ['coingecko-stats'],
    queryFn: async () => {
      const [cgMaster, cgAssets] = await Promise.all([
        supabase.from('cg_master').select('enrichment_status'),
        supabase.from('coingecko_assets').select('*', { count: 'exact', head: true })
      ]);

      const statusCounts = { total: 0, enriched: 0, pending: 0, error: 0 };
      cgMaster.data?.forEach((row: any) => {
        statusCounts.total++;
        const status = row.enrichment_status || 'pending';
        if (status === 'enriched') statusCounts.enriched++;
        else if (status === 'error') statusCounts.error++;
        else statusCounts.pending++;
      });

      return { ...statusCounts, linkedAssets: cgAssets.count || 0 };
    },
    refetchInterval: 30000
  });

  const handleSync = async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('coingecko-sync');
      if (error) throw error;
      toast({ title: 'CoinGecko Sync Complete', description: `Synced ${data?.synced || 0} coins` });
      refetch();
    } catch (error: any) {
      toast({ title: 'Sync Failed', description: error.message, variant: 'destructive' });
    } finally {
      setSyncing(false);
    }
  };

  const handleEnrich = async () => {
    setEnriching(true);
    try {
      const { data, error } = await supabase.functions.invoke('coingecko-enrich', {
        body: { batch_size: batchSize, priority_mappings: true }
      });
      if (error) throw error;
      toast({ title: 'Enrichment Complete', description: `Enriched ${data.enriched} coins` });
      refetch();
    } catch (error: any) {
      toast({ title: 'Enrichment Failed', description: error.message, variant: 'destructive' });
    } finally {
      setEnriching(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{stats?.total.toLocaleString() || 0}</div>
            <p className="text-xs text-muted-foreground">Total in cg_master</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-green-600">{stats?.enriched.toLocaleString() || 0}</div>
            <p className="text-xs text-muted-foreground">Enriched</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-yellow-600">{stats?.pending.toLocaleString() || 0}</div>
            <p className="text-xs text-muted-foreground">Pending</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-blue-600">{stats?.linkedAssets.toLocaleString() || 0}</div>
            <p className="text-xs text-muted-foreground">Linked Assets</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            CoinGecko Sync
          </CardTitle>
          <CardDescription>
            Sync coin list from CoinGecko API to cg_master table
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={handleSync} disabled={syncing} className="w-full">
            {syncing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Sync CoinGecko
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Platform Data Enrichment
          </CardTitle>
          <CardDescription>
            Fetch platform/contract data for coins in cg_master
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Batch Size (1-100)</Label>
            <Input 
              type="number" 
              min="1" 
              max="100" 
              value={batchSize} 
              onChange={(e) => setBatchSize(Math.min(100, Math.max(1, parseInt(e.target.value) || 50)))} 
            />
          </div>
          <Button onClick={handleEnrich} disabled={enriching} className="w-full">
            {enriching && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Enrich Data
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

// ============= LUNARCRUSH TAB =============
function LunarCrushTab() {
  const [syncing, setSyncing] = useState(false);

  const { data: stats, refetch } = useQuery({
    queryKey: ['lunarcrush-stats'],
    queryFn: async () => {
      const { count } = await supabase
        .from('lunarcrush_assets')
        .select('*', { count: 'exact', head: true });

      const { data: topAssets } = await supabase
        .from('lunarcrush_assets')
        .select('assets!inner(symbol, name), galaxy_score, alt_rank')
        .order('galaxy_score', { ascending: false, nullsFirst: false })
        .limit(5);

      return { total: count || 0, topAssets: topAssets || [] };
    },
    refetchInterval: 30000
  });

  const handleSync = async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('lunarcrush-universe');
      if (error) throw error;
      toast.success(`LunarCrush synced: ${data?.count || 0} assets`);
      refetch();
    } catch (error: any) {
      toast.error('Sync failed', { description: error.message });
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{stats?.total.toLocaleString() || 0}</div>
            <p className="text-xs text-muted-foreground">Assets with Social Data</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm font-medium">Top by Galaxy Score</div>
            <div className="mt-2 space-y-1">
              {stats?.topAssets.slice(0, 3).map((asset: any, i: number) => (
                <div key={i} className="flex justify-between text-xs">
                  <span>{asset.assets?.symbol}</span>
                  <Badge variant="outline">{asset.galaxy_score?.toFixed(1)}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            LunarCrush Social Data
          </CardTitle>
          <CardDescription>
            Sync galaxy scores and alt ranks from LunarCrush API
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={handleSync} disabled={syncing} className="w-full">
            {syncing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Sync Social Data
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

// ============= EXCHANGES TAB =============
function ExchangesTab() {
  const [syncingPairs, setSyncingPairs] = useState(false);
  const [syncingPrices, setSyncingPrices] = useState(false);

  const { data: stats, refetch } = useQuery({
    queryKey: ['exchange-stats'],
    queryFn: async () => {
      const [pairsData, pricesData] = await Promise.all([
        supabase.from('exchange_pairs').select('synced_at').order('synced_at', { ascending: false }).limit(1).single(),
        supabase.from('exchange_ticker_data').select('last_updated').order('last_updated', { ascending: false }).limit(1).single()
      ]);
      
      const { count: pairsCount } = await supabase.from('exchange_pairs').select('*', { count: 'exact', head: true });
      const { count: pricesCount } = await supabase.from('exchange_ticker_data').select('*', { count: 'exact', head: true });

      return {
        pairsCount: pairsCount || 0,
        pricesCount: pricesCount || 0,
        lastPairsSync: pairsData.data?.synced_at,
        lastPricesSync: pricesData.data?.last_updated
      };
    },
    refetchInterval: 30000
  });

  const formatTime = (ts: string | undefined) => {
    if (!ts) return 'Never';
    const diff = Math.floor((Date.now() - new Date(ts).getTime()) / 60000);
    if (diff < 1) return 'Just now';
    if (diff < 60) return `${diff}m ago`;
    if (diff < 1440) return `${Math.floor(diff / 60)}h ago`;
    return `${Math.floor(diff / 1440)}d ago`;
  };

  const handleSyncPairs = async () => {
    setSyncingPairs(true);
    try {
      await supabase.functions.invoke('exchange-sync');
      toast.success('Exchange pairs synced');
      refetch();
    } catch (error: any) {
      toast.error('Sync failed', { description: error.message });
    } finally {
      setSyncingPairs(false);
    }
  };

  const handleSyncPrices = async () => {
    setSyncingPrices(true);
    try {
      const { data: symbols } = await supabase
        .from('assets')
        .select('symbol')
        .eq('type', 'crypto')
        .limit(50);
      
      await supabase.functions.invoke('exchange-data-aggregator', {
        body: { symbols: symbols?.map(s => s.symbol) || [] }
      });
      toast.success('Exchange prices synced');
      refetch();
    } catch (error: any) {
      toast.error('Sync failed', { description: error.message });
    } finally {
      setSyncingPrices(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{stats?.pairsCount.toLocaleString() || 0}</div>
            <p className="text-xs text-muted-foreground">Trading Pairs</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{stats?.pricesCount.toLocaleString() || 0}</div>
            <p className="text-xs text-muted-foreground">Price Records</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm font-bold">{formatTime(stats?.lastPairsSync)}</div>
            <p className="text-xs text-muted-foreground">Pairs Last Sync</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm font-bold">{formatTime(stats?.lastPricesSync)}</div>
            <p className="text-xs text-muted-foreground">Prices Last Sync</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ArrowUpDown className="h-5 w-5" />
              Trading Pairs
            </CardTitle>
            <CardDescription>Daily at 2 AM UTC</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={handleSyncPairs} disabled={syncingPairs} className="w-full">
              {syncingPairs && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Sync Trading Pairs
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5" />
              Price Data
            </CardTitle>
            <CardDescription>Every 15 minutes</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={handleSyncPrices} disabled={syncingPrices} className="w-full">
              {syncingPrices && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Sync Price Data
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ============= CONTRACTS TAB =============
function ContractsTab() {
  const [populating, setPopulating] = useState(false);

  const { data: stats, refetch } = useQuery({
    queryKey: ['contracts-stats'],
    queryFn: async () => {
      const { data } = await supabase
        .from('token_contracts')
        .select('chain');

      const chainCounts: Record<string, number> = {};
      data?.forEach((row: any) => {
        chainCounts[row.chain] = (chainCounts[row.chain] || 0) + 1;
      });

      return {
        total: data?.length || 0,
        byChain: chainCounts
      };
    },
    refetchInterval: 30000
  });

  const handlePopulate = async () => {
    setPopulating(true);
    try {
      const { data, error } = await supabase.functions.invoke('populate-token-addresses');
      if (error) throw error;
      toast.success(`Token addresses populated: ${data.stats?.updated || 0} updated`);
      refetch();
    } catch (error: any) {
      toast.error('Population failed', { description: error.message });
    } finally {
      setPopulating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{stats?.total.toLocaleString() || 0}</div>
            <p className="text-xs text-muted-foreground">Total Contracts</p>
          </CardContent>
        </Card>
        {Object.entries(stats?.byChain || {}).slice(0, 3).map(([chain, count]) => (
          <Card key={chain}>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">{(count as number).toLocaleString()}</div>
              <p className="text-xs text-muted-foreground capitalize">{chain}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5" />
            Populate Token Addresses
          </CardTitle>
          <CardDescription>
            Transfer enriched contract addresses from cg_master to token_contracts table
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={handlePopulate} disabled={populating} className="w-full">
            {populating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Populate Addresses
          </Button>
        </CardContent>
      </Card>

      {/* Chain breakdown */}
      {stats?.byChain && Object.keys(stats.byChain).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Contracts by Chain</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {Object.entries(stats.byChain).map(([chain, count]) => (
                <div key={chain} className="flex justify-between p-2 bg-muted/50 rounded">
                  <span className="capitalize text-sm">{chain}</span>
                  <Badge variant="secondary">{(count as number).toLocaleString()}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default DataSources;
