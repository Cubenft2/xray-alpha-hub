import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PendingTickerMappings } from './PendingTickerMappings';
import { Loader2 } from 'lucide-react';

export function SymbolAdmin() {
  const [syncing, setSyncing] = useState({
    coingecko: false,
    exchange: false,
  });

  const handleCoinGeckoSync = async () => {
    setSyncing({ ...syncing, coingecko: true });
    try {
      const { data, error } = await supabase.functions.invoke('coingecko-sync');
      
      if (error) throw error;
      
      toast.success(`CoinGecko sync complete! Synced ${data.synced} coins`);
    } catch (error) {
      console.error('CoinGecko sync error:', error);
      toast.error('Failed to sync CoinGecko data');
    } finally {
      setSyncing({ ...syncing, coingecko: false });
    }
  };

  const handleExchangeSync = async () => {
    setSyncing({ ...syncing, exchange: true });
    try {
      const { data, error } = await supabase.functions.invoke('exchange-sync');
      
      if (error) throw error;
      
      toast.success(
        `Exchange sync complete! Binance: ${data.results.binance.synced}, Coinbase: ${data.results.coinbase.synced}`
      );
    } catch (error) {
      console.error('Exchange sync error:', error);
      toast.error('Failed to sync exchange data');
    } finally {
      setSyncing({ ...syncing, exchange: false });
    }
  };

  return (
    <div className="container mx-auto p-8">
      <h1 className="text-3xl font-bold mb-8">Symbol Intelligence Admin</h1>
      
      <Tabs defaultValue="sync" className="space-y-6">
        <TabsList>
          <TabsTrigger value="sync">Data Sync</TabsTrigger>
          <TabsTrigger value="pending">Pending Mappings</TabsTrigger>
        </TabsList>

        <TabsContent value="sync">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>CoinGecko Master Sync</CardTitle>
                <CardDescription>
                  Sync the complete CoinGecko coin list into the cg_master table
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button 
                  onClick={handleCoinGeckoSync} 
                  disabled={syncing.coingecko}
                  className="w-full"
                >
                  {syncing.coingecko && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {syncing.coingecko ? 'Syncing...' : 'Sync CoinGecko'}
                </Button>
                <p className="text-sm text-muted-foreground mt-4">
                  This will download the full list of coins from CoinGecko's API and store them locally for symbol resolution.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Exchange Universe Sync</CardTitle>
                <CardDescription>
                  Sync trading pairs from Binance and Coinbase
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button 
                  onClick={handleExchangeSync} 
                  disabled={syncing.exchange}
                  className="w-full"
                >
                  {syncing.exchange && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {syncing.exchange ? 'Syncing...' : 'Sync Exchanges'}
                </Button>
                <p className="text-sm text-muted-foreground mt-4">
                  This will fetch the list of active trading pairs from major exchanges to validate TradingView support.
                </p>
              </CardContent>
            </Card>
          </div>

          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Automation</CardTitle>
              <CardDescription>
                Set up automated syncing
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                To run these syncs automatically on a schedule, set up cron jobs in Supabase:
              </p>
              <pre className="bg-muted p-4 rounded-lg mt-4 text-xs overflow-x-auto">
{`-- Run CoinGecko sync nightly at 2 AM
SELECT cron.schedule(
  'coingecko-nightly-sync',
  '0 2 * * *',
  $$
  SELECT net.http_post(
    url:='https://odncvfiuzliyohxrsigc.supabase.co/functions/v1/coingecko-sync',
    headers:='{"Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb
  );
  $$
);

-- Run exchange sync every 6 hours
SELECT cron.schedule(
  'exchange-sync-6hourly',
  '0 */6 * * *',
  $$
  SELECT net.http_post(
    url:='https://odncvfiuzliyohxrsigc.supabase.co/functions/v1/exchange-sync',
    headers:='{"Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb
  );
  $$
);`}
              </pre>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pending">
          <PendingTickerMappings />
        </TabsContent>
      </Tabs>
    </div>
  );
}
