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
    polygon: false,
    tickerMappings: false,
    tokenAddresses: false,
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
      
      const binanceLabel = data.results.binance.fallback 
        ? `Binance: ${data.results.binance.synced} (CG fallback)` 
        : `Binance: ${data.results.binance.synced}`;
      
      const binanceUSLabel = data.results.binance_us?.synced > 0 
        ? ` | Binance.US: ${data.results.binance_us.synced}` 
        : '';
      
      const bybitLabel = data.results.bybit.fallback 
        ? `Bybit: ${data.results.bybit.synced} (CG fallback)` 
        : `Bybit: ${data.results.bybit.synced}`;
      
      toast.success(
        `Exchange sync complete!\n${binanceLabel}${binanceUSLabel} | Coinbase: ${data.results.coinbase.synced}\n${bybitLabel} | MEXC: ${data.results.mexc.synced} | Gate.io: ${data.results.gateio.synced}\nKraken: ${data.results.kraken.synced} | KuCoin: ${data.results.kucoin.synced} | OKX: ${data.results.okx.synced}\nBitget: ${data.results.bitget.synced} | HTX: ${data.results.htx.synced}`
      );
    } catch (error) {
      console.error('Exchange sync error:', error);
      toast.error('Failed to sync exchange data');
    } finally {
      setSyncing({ ...syncing, exchange: false });
    }
  };

  const handlePolygonSync = async () => {
    setSyncing({ ...syncing, polygon: true });
    try {
      const { data, error } = await supabase.functions.invoke('polygon-sync');
      
      if (error) throw error;
      
      toast.success(
        `Polygon sync complete! Synced ${data.synced} tickers (${data.fx_pairs} FX pairs)`
      );
    } catch (error) {
      console.error('Polygon sync error:', error);
      toast.error('Failed to sync Polygon data');
    } finally {
      setSyncing({ ...syncing, polygon: false });
    }
  };

  const handleTickerMappingsSync = async () => {
    setSyncing({ ...syncing, tickerMappings: true });
    try {
      const { data, error } = await supabase.functions.invoke('sync-ticker-mappings');
      
      if (error) throw error;
      
      toast.success(
        `Ticker mappings sync complete! ${data.stats.mapped} mapped, ${data.stats.pending} pending review, ${data.stats.skipped} skipped`
      );
    } catch (error) {
      console.error('Ticker mappings sync error:', error);
      toast.error('Failed to sync ticker mappings');
    } finally {
      setSyncing({ ...syncing, tickerMappings: false });
    }
  };

  const handleTokenAddressesPopulate = async () => {
    setSyncing({ ...syncing, tokenAddresses: true });
    try {
      const { data, error } = await supabase.functions.invoke('populate-token-addresses');
      
      if (error) throw error;
      
      toast.success(
        `Token addresses populated! Updated: ${data.stats.updated}, Skipped: ${data.stats.skipped}`
      );
    } catch (error) {
      console.error('Token address population error:', error);
      toast.error('Failed to populate token addresses');
    } finally {
      setSyncing({ ...syncing, tokenAddresses: false });
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
          <div className="mb-6 p-4 bg-muted/50 rounded-lg border border-primary/20">
            <h3 className="font-semibold text-sm mb-2">📋 Recommended Sync Order:</h3>
            <ol className="text-sm text-muted-foreground space-y-1 ml-4 list-decimal">
              <li><strong>CoinGecko Sync</strong> - Gets platform data and coin list</li>
              <li><strong>Ticker Mappings Sync</strong> - Creates mappings with CoinGecko IDs</li>
              <li><strong>Populate Token Addresses</strong> - Fills in blockchain addresses</li>
            </ol>
          </div>

          <Card className="mb-6 border-primary/50">
            <CardHeader>
              <CardTitle className="text-xl">🎯 Ticker Mappings Sync</CardTitle>
              <CardDescription>
                Intelligently populate ticker_mappings from exchange_pairs and cg_master
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                onClick={handleTickerMappingsSync} 
                disabled={syncing.tickerMappings}
                className="w-full"
                size="lg"
              >
                {syncing.tickerMappings && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {syncing.tickerMappings ? 'Syncing Mappings...' : 'Sync Ticker Mappings'}
              </Button>
              <div className="mt-4 space-y-2 text-sm text-muted-foreground">
                <p className="font-medium">This will:</p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li>Analyze 4,700+ unique base assets from exchange pairs</li>
                  <li>Match with 19,000+ CoinGecko coins</li>
                  <li>Auto-map high-confidence symbols (≥80%) to ticker_mappings</li>
                  <li>Queue medium-confidence (50-79%) for manual review</li>
                  <li>Prioritize exchanges: Kraken → KuCoin → Gate.io</li>
                  <li>Generate TradingView symbols and aliases</li>
                </ul>
                <p className="text-xs italic mt-3">
                  Expected to add 3,000-4,000 new mappings automatically
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="mb-6 border-green-500/50">
            <CardHeader>
              <CardTitle className="text-xl">🔗 Populate Token Addresses</CardTitle>
              <CardDescription>
                Auto-fill blockchain addresses for crypto tokens from CoinGecko platform data
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                onClick={handleTokenAddressesPopulate} 
                disabled={syncing.tokenAddresses}
                className="w-full"
                size="lg"
                variant="secondary"
              >
                {syncing.tokenAddresses && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {syncing.tokenAddresses ? 'Populating Addresses...' : 'Populate Token Addresses'}
              </Button>
              <div className="mt-4 space-y-2 text-sm text-muted-foreground">
                <p className="font-medium">This will:</p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li>Find all crypto tokens with a CoinGecko ID in ticker_mappings</li>
                  <li>Retrieve blockchain platform data from cg_master table</li>
                  <li>Prioritize: Ethereum → BSC → Polygon → Arbitrum → Base → Solana</li>
                  <li>Automatically fill dex_address and dex_chain fields</li>
                  <li>Skip tokens that already have addresses or are native coins</li>
                </ul>
                <p className="text-xs italic mt-3 text-green-600 dark:text-green-400">
                  ⚠️ Run this AFTER CoinGecko Sync and Ticker Mappings Sync for best results
                </p>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-6 md:grid-cols-3">
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
                  Sync trading pairs from 11 exchanges: Binance, Coinbase, Bybit, MEXC, Gate.io, Kraken, KuCoin, OKX, Bitget, and HTX
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
                <p className="text-xs text-muted-foreground mt-2 italic">
                  Note: Some exchanges are geo-restricted in the US. Fallbacks to CoinGecko or regional APIs (e.g., Binance.US) are applied automatically.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Polygon Market Sync</CardTitle>
                <CardDescription>
                  Sync stocks, ETFs, crypto, and FX pairs from Polygon.io
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button 
                  onClick={handlePolygonSync} 
                  disabled={syncing.polygon}
                  className="w-full"
                >
                  {syncing.polygon && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {syncing.polygon ? 'Syncing...' : 'Sync Polygon'}
                </Button>
                <p className="text-sm text-muted-foreground mt-4">
                  Fetches reference data for stocks, crypto, FX, and ETFs from Polygon.io API with real-time capabilities.
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
);

-- Run Polygon sync nightly at 3 AM
SELECT cron.schedule(
  'polygon-nightly-sync',
  '0 3 * * *',
  $$
  SELECT net.http_post(
    url:='https://odncvfiuzliyohxrsigc.supabase.co/functions/v1/polygon-sync',
    headers:='{"Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb
  );
  $$
);

-- Run Polygon hourly sync for FX and crypto
SELECT cron.schedule(
  'polygon-hourly-fx-crypto',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url:='https://odncvfiuzliyohxrsigc.supabase.co/functions/v1/polygon-sync',
    headers:='{"Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb,
    body:='{"markets": ["crypto", "fx"]}'::jsonb
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
