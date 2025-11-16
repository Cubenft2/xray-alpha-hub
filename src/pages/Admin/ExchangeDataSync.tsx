import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, Clock, CheckCircle, XCircle, ArrowUpDown } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQuery } from '@tanstack/react-query';

export function ExchangeDataSync() {
  const [syncing, setSyncing] = useState<{ pairs: boolean; prices: boolean }>({
    pairs: false,
    prices: false,
  });
  const { toast } = useToast();

  // Fetch last sync timestamps
  const { data: syncStatus, refetch } = useQuery({
    queryKey: ['exchange-sync-status'],
    queryFn: async () => {
      const [pairsData, pricesData] = await Promise.all([
        supabase
          .from('exchange_pairs')
          .select('synced_at')
          .order('synced_at', { ascending: false })
          .limit(1)
          .single(),
        supabase
          .from('exchange_ticker_data')
          .select('last_updated')
          .order('last_updated', { ascending: false })
          .limit(1)
          .single(),
      ]);

      return {
        lastPairsSync: pairsData.data?.synced_at,
        lastPricesSync: pricesData.data?.last_updated,
      };
    },
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  const syncExchangePairs = async () => {
    setSyncing((prev) => ({ ...prev, pairs: true }));
    try {
      const { error } = await supabase.functions.invoke('exchange-sync');

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Exchange pairs synced successfully',
      });
      refetch();
    } catch (error) {
      console.error('Error syncing exchange pairs:', error);
      toast({
        title: 'Error',
        description: 'Failed to sync exchange pairs',
        variant: 'destructive',
      });
    } finally {
      setSyncing((prev) => ({ ...prev, pairs: false }));
    }
  };

  const syncExchangePrices = async () => {
    setSyncing((prev) => ({ ...prev, prices: true }));
    try {
      // Get top 50 symbols to sync
      const { data: symbols } = await supabase
        .from('ticker_mappings')
        .select('symbol')
        .eq('type', 'crypto')
        .eq('is_active', true)
        .limit(50);

      if (!symbols || symbols.length === 0) {
        throw new Error('No symbols found to sync');
      }

      const { error } = await supabase.functions.invoke('exchange-data-aggregator', {
        body: { symbols: symbols.map((s) => s.symbol) },
      });

      if (error) throw error;

      toast({
        title: 'Success',
        description: `Exchange prices synced for ${symbols.length} symbols`,
      });
      refetch();
    } catch (error) {
      console.error('Error syncing exchange prices:', error);
      toast({
        title: 'Error',
        description: 'Failed to sync exchange prices',
        variant: 'destructive',
      });
    } finally {
      setSyncing((prev) => ({ ...prev, prices: false }));
    }
  };

  const getTimeSince = (timestamp: string | null | undefined) => {
    if (!timestamp) return 'Never';
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 0) return `${diffDays}d ago`;
    if (diffHours > 0) return `${diffHours}h ago`;
    if (diffMins > 0) return `${diffMins}m ago`;
    return 'Just now';
  };

  const getFreshnessColor = (timestamp: string | null | undefined) => {
    if (!timestamp) return 'destructive';
    const date = new Date(timestamp);
    const now = new Date();
    const diffHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffHours < 1) return 'default';
    if (diffHours < 6) return 'secondary';
    return 'destructive';
  };

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Exchange Data Sync</h1>
        <p className="text-muted-foreground">
          Manage automated syncing of exchange trading pairs and price data
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ArrowUpDown className="h-5 w-5" />
              Exchange Trading Pairs
            </CardTitle>
            <CardDescription>
              Sync available trading pairs from all supported exchanges (runs daily at 2 AM UTC)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Last Sync:</span>
              </div>
              <Badge variant={getFreshnessColor(syncStatus?.lastPairsSync)}>
                {getTimeSince(syncStatus?.lastPairsSync)}
              </Badge>
            </div>
            <Button
              onClick={syncExchangePairs}
              disabled={syncing.pairs}
              className="w-full"
            >
              {syncing.pairs ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Syncing...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Sync Trading Pairs
                </>
              )}
            </Button>
            <div className="text-xs text-muted-foreground space-y-1">
              <p>• Syncs from Binance, Coinbase, Kraken, Bybit, and more</p>
              <p>• Updates exchange_pairs table</p>
              <p>• Runs automatically daily</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5" />
              Exchange Price Data
            </CardTitle>
            <CardDescription>
              Fetch live prices and volumes from exchanges (runs every 15 minutes)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Last Sync:</span>
              </div>
              <Badge variant={getFreshnessColor(syncStatus?.lastPricesSync)}>
                {getTimeSince(syncStatus?.lastPricesSync)}
              </Badge>
            </div>
            <Button
              onClick={syncExchangePrices}
              disabled={syncing.prices}
              className="w-full"
            >
              {syncing.prices ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Syncing...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Sync Price Data
                </>
              )}
            </Button>
            <div className="text-xs text-muted-foreground space-y-1">
              <p>• Aggregates prices from multiple exchanges</p>
              <p>• Updates exchange_ticker_data table</p>
              <p>• Runs automatically every 15 minutes</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Automation Status</CardTitle>
          <CardDescription>
            Cron job schedules for automated data synchronization
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-success" />
                <span className="font-medium">Exchange Pairs Sync</span>
              </div>
              <Badge variant="outline">Daily at 2 AM UTC</Badge>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-success" />
                <span className="font-medium">Price Data Sync</span>
              </div>
              <Badge variant="outline">Every 15 minutes</Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
