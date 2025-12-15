import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQuery } from '@tanstack/react-query';
import { 
  Loader2, RefreshCw, Database, TrendingUp, 
  Coins, Clock, CheckCircle, AlertTriangle
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export function DataSources() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Data Sources</h1>
        <p className="text-muted-foreground">
          Centralized token_cards master source health and manual sync triggers
        </p>
      </div>

      <Tabs defaultValue="token-cards" className="space-y-4">
        <TabsList className="grid grid-cols-4 w-full">
          <TabsTrigger value="token-cards">Token Cards</TabsTrigger>
          <TabsTrigger value="stocks">Stocks</TabsTrigger>
          <TabsTrigger value="forex">Forex</TabsTrigger>
          <TabsTrigger value="sync-triggers">Manual Syncs</TabsTrigger>
        </TabsList>

        <TabsContent value="token-cards">
          <TokenCardsTab />
        </TabsContent>

        <TabsContent value="stocks">
          <StocksTab />
        </TabsContent>

        <TabsContent value="forex">
          <ForexTab />
        </TabsContent>

        <TabsContent value="sync-triggers">
          <SyncTriggersTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ============= TOKEN CARDS TAB =============
function TokenCardsTab() {
  const { data: stats, isLoading, refetch } = useQuery({
    queryKey: ['token-cards-stats'],
    queryFn: async () => {
      const [
        totalCount,
        polygonSupported,
        withPrices,
        withSocial,
        recentUpdate
      ] = await Promise.all([
        supabase.from('token_cards').select('*', { count: 'exact', head: true }),
        supabase.from('token_cards').select('*', { count: 'exact', head: true }).eq('polygon_supported', true),
        supabase.from('token_cards').select('*', { count: 'exact', head: true }).not('price_usd', 'is', null),
        supabase.from('token_cards').select('*', { count: 'exact', head: true }).not('galaxy_score', 'is', null),
        supabase.from('token_cards').select('price_updated_at, social_updated_at').order('price_updated_at', { ascending: false }).limit(1).single()
      ]);

      return {
        total: totalCount.count || 0,
        polygonSupported: polygonSupported.count || 0,
        withPrices: withPrices.count || 0,
        withSocial: withSocial.count || 0,
        lastPriceUpdate: recentUpdate.data?.price_updated_at,
        lastSocialUpdate: recentUpdate.data?.social_updated_at
      };
    },
    refetchInterval: 30000
  });

  const getFreshnessStatus = (timestamp: string | null | undefined) => {
    if (!timestamp) return { status: 'critical', label: 'Never', color: 'destructive' };
    const diffMins = Math.floor((Date.now() - new Date(timestamp).getTime()) / 1000 / 60);
    if (diffMins < 5) return { status: 'fresh', label: formatDistanceToNow(new Date(timestamp), { addSuffix: true }), color: 'default' };
    if (diffMins < 30) return { status: 'stale', label: formatDistanceToNow(new Date(timestamp), { addSuffix: true }), color: 'secondary' };
    return { status: 'critical', label: formatDistanceToNow(new Date(timestamp), { addSuffix: true }), color: 'destructive' };
  };

  const priceStatus = getFreshnessStatus(stats?.lastPriceUpdate);
  const socialStatus = getFreshnessStatus(stats?.lastSocialUpdate);

  if (isLoading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  return (
    <div className="space-y-6">
      {/* Master Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{stats?.total.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Total Tokens</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-primary">{stats?.polygonSupported.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Polygon Live (1min)</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-green-600">{stats?.withPrices.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">With Price Data</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-blue-600">{stats?.withSocial.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">With Social Data</p>
          </CardContent>
        </Card>
      </div>

      {/* Freshness Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Data Freshness
          </CardTitle>
          <CardDescription>Last update timestamps for token_cards master source</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
            <div className="flex items-center gap-3">
              <Coins className="h-5 w-5 text-primary" />
              <div>
                <p className="font-medium">Price Data (Polygon)</p>
                <p className="text-sm text-muted-foreground">sync-token-cards-polygon (1min cron)</p>
              </div>
            </div>
            <Badge variant={priceStatus.color as any}>
              {priceStatus.status === 'fresh' && <CheckCircle className="h-3 w-3 mr-1" />}
              {priceStatus.status === 'critical' && <AlertTriangle className="h-3 w-3 mr-1" />}
              {priceStatus.label}
            </Badge>
          </div>
          
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
            <div className="flex items-center gap-3">
              <TrendingUp className="h-5 w-5 text-blue-500" />
              <div>
                <p className="font-medium">Social Data (LunarCrush)</p>
                <p className="text-sm text-muted-foreground">sync-token-cards-lunarcrush (3min cron)</p>
              </div>
            </div>
            <Badge variant={socialStatus.color as any}>
              {socialStatus.status === 'fresh' && <CheckCircle className="h-3 w-3 mr-1" />}
              {socialStatus.status === 'critical' && <AlertTriangle className="h-3 w-3 mr-1" />}
              {socialStatus.label}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Data Sources Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Centralized Architecture
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm space-y-2 text-muted-foreground">
            <p><strong>token_cards</strong> is the single source of truth for all cryptocurrency data.</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li><strong>Polygon:</strong> Live USD prices every 1 minute (~435 tokens)</li>
              <li><strong>LunarCrush:</strong> Social metrics every 3 minutes (~3,000 tokens)</li>
              <li><strong>CoinGecko:</strong> Metadata enrichment daily (descriptions, links, logos)</li>
            </ul>
            <p className="mt-3">All UI pages and ZombieDog AI query <strong>only</strong> token_cards.</p>
          </div>
        </CardContent>
      </Card>

      <Button onClick={() => refetch()} variant="outline" className="w-full">
        <RefreshCw className="mr-2 h-4 w-4" />
        Refresh Stats
      </Button>
    </div>
  );
}

// ============= STOCKS TAB =============
function StocksTab() {
  const { data: stats, isLoading, refetch } = useQuery({
    queryKey: ['stock-cards-stats'],
    queryFn: async () => {
      const [totalCount, recentUpdate] = await Promise.all([
        supabase.from('stock_cards').select('*', { count: 'exact', head: true }),
        supabase.from('stock_cards').select('price_updated_at').order('price_updated_at', { ascending: false }).limit(1).single()
      ]);

      return {
        total: totalCount.count || 0,
        lastUpdate: recentUpdate.data?.price_updated_at
      };
    },
    refetchInterval: 30000
  });

  if (isLoading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{stats?.total.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Stock Cards</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-primary">
              {stats?.lastUpdate ? formatDistanceToNow(new Date(stats.lastUpdate), { addSuffix: true }) : 'Never'}
            </div>
            <p className="text-xs text-muted-foreground">Last Updated</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Stock Data Source</CardTitle>
          <CardDescription>polygon-stock-snapshot runs every 5 minutes</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Stock prices are 15-minute delayed (Polygon Starter plan). Data includes price, volume, 
            market cap, sector, industry, and technical indicators.
          </p>
        </CardContent>
      </Card>

      <Button onClick={() => refetch()} variant="outline" className="w-full">
        <RefreshCw className="mr-2 h-4 w-4" />
        Refresh Stats
      </Button>
    </div>
  );
}

// ============= FOREX TAB =============
function ForexTab() {
  const { data: stats, isLoading, refetch } = useQuery({
    queryKey: ['forex-cards-stats'],
    queryFn: async () => {
      const [totalCount, majorCount, recentUpdate] = await Promise.all([
        supabase.from('forex_cards').select('*', { count: 'exact', head: true }),
        supabase.from('forex_cards').select('*', { count: 'exact', head: true }).eq('is_major', true),
        supabase.from('forex_cards').select('price_updated_at').order('price_updated_at', { ascending: false }).limit(1).single()
      ]);

      return {
        total: totalCount.count || 0,
        major: majorCount.count || 0,
        lastUpdate: recentUpdate.data?.price_updated_at
      };
    },
    refetchInterval: 30000
  });

  if (isLoading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{stats?.total.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Forex Pairs</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-primary">{stats?.major.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Major Pairs</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">
              {stats?.lastUpdate ? formatDistanceToNow(new Date(stats.lastUpdate), { addSuffix: true }) : 'Never'}
            </div>
            <p className="text-xs text-muted-foreground">Last Updated</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Forex Data Source</CardTitle>
          <CardDescription>sync-forex-cards-polygon runs every 1 minute</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            1,220 forex trading pairs from Polygon.io including bid/ask prices, spreads, 
            and 24h OHLC data. Data is real-time during market hours.
          </p>
        </CardContent>
      </Card>

      <Button onClick={() => refetch()} variant="outline" className="w-full">
        <RefreshCw className="mr-2 h-4 w-4" />
        Refresh Stats
      </Button>
    </div>
  );
}

// ============= SYNC TRIGGERS TAB =============
function SyncTriggersTab() {
  const [syncing, setSyncing] = useState<string | null>(null);

  const triggerSync = async (functionName: string, label: string) => {
    setSyncing(functionName);
    try {
      const { error } = await supabase.functions.invoke(functionName);
      if (error) throw error;
      toast.success(`${label} triggered successfully`);
    } catch (error: any) {
      toast.error(`Failed to trigger ${label}`, { description: error.message });
    } finally {
      setSyncing(null);
    }
  };

  const syncButtons = [
    { fn: 'sync-token-cards-polygon', label: 'Token Cards (Polygon)', desc: 'Sync live prices from Polygon' },
    { fn: 'sync-token-cards-lunarcrush', label: 'Token Cards (LunarCrush)', desc: 'Sync social metrics from LunarCrush' },
    { fn: 'sync-token-cards-coingecko', label: 'Token Cards (CoinGecko)', desc: 'Sync metadata from CoinGecko' },
    { fn: 'polygon-stock-snapshot', label: 'Stock Snapshot', desc: 'Update stock prices' },
    { fn: 'sync-forex-cards-polygon', label: 'Forex Cards', desc: 'Update forex rates' },
  ];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Manual Sync Triggers</CardTitle>
          <CardDescription>
            Trigger data syncs manually. Use sparingly - these run automatically via cron jobs.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {syncButtons.map(({ fn, label, desc }) => (
            <div key={fn} className="flex items-center justify-between p-3 rounded-lg border">
              <div>
                <p className="font-medium">{label}</p>
                <p className="text-sm text-muted-foreground">{desc}</p>
              </div>
              <Button 
                onClick={() => triggerSync(fn, label)} 
                disabled={syncing !== null}
                variant="outline"
                size="sm"
              >
                {syncing === fn && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Trigger
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
