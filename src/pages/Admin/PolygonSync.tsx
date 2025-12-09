import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, Zap, Radio, StopCircle, RefreshCw, AlertCircle, CheckCircle, TrendingUp, Coins } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

interface RelayHealth {
  isActive: boolean;
  lastHeartbeat: string | null;
  instanceId: string | null;
  minutesStale: number | null;
}

interface StockSyncStats {
  totalStocks: number;
  existingMappings: number;
}

interface CryptoSyncStats {
  totalCgCoins: number;
  existingCryptoMappings: number;
}

export function PolygonSync() {
  const [mapping, setMapping] = useState(false);
  const [relaying, setRelaying] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [restarting, setRestarting] = useState(false);
  const [syncingStocks, setSyncingStocks] = useState(false);
  const [syncingCrypto, setSyncingCrypto] = useState(false);
  const [stockStats, setStockStats] = useState<StockSyncStats | null>(null);
  const [cryptoStats, setCryptoStats] = useState<CryptoSyncStats | null>(null);
  const [relayHealth, setRelayHealth] = useState<RelayHealth | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkRelayHealth();
    fetchStockStats();
    fetchCryptoStats();
    const interval = setInterval(checkRelayHealth, 10000);
    return () => clearInterval(interval);
  }, []);

  const fetchCryptoStats = async () => {
    try {
      // Get total coins in cg_master
      const { count: totalCgCoins } = await supabase
        .from('cg_master')
        .select('*', { count: 'exact', head: true });

      // Get existing crypto mappings
      const { count: existingCryptoMappings } = await supabase
        .from('ticker_mappings')
        .select('*', { count: 'exact', head: true })
        .eq('type', 'crypto');

      setCryptoStats({
        totalCgCoins: totalCgCoins || 0,
        existingCryptoMappings: existingCryptoMappings || 0
      });
    } catch (error) {
      console.error('Error fetching crypto stats:', error);
    }
  };

  const fetchStockStats = async () => {
    try {
      // Get total common stocks in poly_tickers
      const { count: totalStocks } = await supabase
        .from('poly_tickers')
        .select('*', { count: 'exact', head: true })
        .eq('market', 'stocks')
        .eq('active', true)
        .eq('type', 'CS');

      // Get existing stock mappings
      const { count: existingMappings } = await supabase
        .from('ticker_mappings')
        .select('*', { count: 'exact', head: true })
        .eq('type', 'stock');

      setStockStats({
        totalStocks: totalStocks || 0,
        existingMappings: existingMappings || 0
      });
    } catch (error) {
      console.error('Error fetching stock stats:', error);
    }
  };

  const checkRelayHealth = async () => {
    try {
      const { data, error } = await supabase
        .from('price_sync_leader')
        .select('*')
        .eq('id', 'singleton')
        .maybeSingle();
      
      if (error) throw error;

      if (!data) {
        setRelayHealth({
          isActive: false,
          lastHeartbeat: null,
          instanceId: null,
          minutesStale: null
        });
      } else {
        const heartbeatTime = new Date(data.heartbeat_at).getTime();
        const now = Date.now();
        const secondsStale = Math.floor((now - heartbeatTime) / 1000);
        const minutesStale = Math.floor(secondsStale / 60);
        const isActive = secondsStale < 30; // Consider active if heartbeat within 30 seconds

        setRelayHealth({
          isActive,
          lastHeartbeat: data.heartbeat_at,
          instanceId: data.instance_id,
          minutesStale
        });
      }
    } catch (error: any) {
      console.error('Error checking relay health:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleMapTickers = async () => {
    setMapping(true);
    try {
      const { data, error } = await supabase.functions.invoke('map-polygon-tickers');
      
      if (error) throw error;
      
      toast.success('Polygon tickers mapped successfully', {
        description: `Mapped: ${data.mapped}, Skipped: ${data.skipped}, Not Found: ${data.notFound}`
      });
    } catch (error: any) {
      console.error('Error mapping tickers:', error);
      toast.error('Failed to map tickers', {
        description: error.message
      });
    } finally {
      setMapping(false);
    }
  };

  const handleStartRelay = async () => {
    setRelaying(true);
    try {
      const { data, error } = await supabase.functions.invoke('polygon-price-relay');
      
      if (error) throw error;
      
      toast.success('Price relay started', {
        description: data.message || 'WebSocket connection established'
      });
    } catch (error: any) {
      console.error('Error starting relay:', error);
      toast.error('Failed to start relay', {
        description: error.message
      });
    } finally {
      setRelaying(false);
    }
  };

  const handleStopRelay = async () => {
    setStopping(true);
    try {
      const { error } = await supabase
        .from('price_sync_leader')
        .delete()
        .eq('id', 'singleton');
      
      if (error) throw error;
      
      toast.success('Price relay stopped', {
        description: 'Leadership released. Wait 30 seconds for cleanup, then restart if needed.'
      });
    } catch (error: any) {
      console.error('Error stopping relay:', error);
      toast.error('Failed to stop relay', {
        description: error.message
      });
    } finally {
      setStopping(false);
    }
  };

  const handleForceRestart = async () => {
    setRestarting(true);
    try {
      // Step 1: Clear stale leader
      const { error: deleteError } = await supabase
        .from('price_sync_leader')
        .delete()
        .eq('id', 'singleton');
      
      if (deleteError) throw deleteError;

      // Step 2: Wait a moment for cleanup
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Step 3: Start fresh relay
      const { data, error: invokeError } = await supabase.functions.invoke('polygon-price-relay');
      
      if (invokeError) throw invokeError;
      
      toast.success('Price relay restarted successfully', {
        description: data.message || 'Fresh WebSocket connection established'
      });

      // Step 4: Check health immediately
      setTimeout(() => checkRelayHealth(), 2000);
    } catch (error: any) {
      console.error('Error restarting relay:', error);
      toast.error('Failed to restart relay', {
        description: error.message
      });
    } finally {
      setRestarting(false);
    }
  };

  const handleSyncPrices = async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('manual-price-sync');
      
      if (error) throw error;
      
      const breakdown = data.match_breakdown || {};
      const breakdownText = `by coingecko_id: ${breakdown.coingecko_id || 0}, symbol: ${breakdown.symbol || 0}, alias: ${breakdown.alias || 0}, forced: ${breakdown.forced_anchor || 0}`;
      
      toast.success('Prices synced successfully', {
        description: `Synced ${data.synced} prices from ${data.source}. Matched ${breakdownText}`
      });
    } catch (error: any) {
      console.error('Error syncing prices:', error);
      toast.error('Failed to sync prices', {
        description: error.message
      });
    } finally {
      setSyncing(false);
    }
  };

  const handleSyncStocks = async () => {
    setSyncingStocks(true);
    try {
      const { data, error } = await supabase.functions.invoke('sync-stock-mappings');
      
      if (error) throw error;
      
      toast.success('Stock sync complete!', {
        description: `Inserted: ${data.inserted}, Skipped: ${data.skipped}, Errors: ${data.errors}`
      });
      
      // Refresh stats
      fetchStockStats();
    } catch (error: any) {
      console.error('Error syncing stocks:', error);
      toast.error('Failed to sync stocks', {
        description: error.message
      });
    } finally {
      setSyncingStocks(false);
    }
  };

  const handleSyncCrypto = async () => {
    setSyncingCrypto(true);
    try {
      const { data, error } = await supabase.functions.invoke('sync-crypto-mappings');
      
      if (error) throw error;
      
      toast.success('Crypto sync complete!', {
        description: `Inserted: ${data.newMappingsInserted?.toLocaleString()}, Skipped: ${data.skippedExisting?.toLocaleString()}, TradingView: ${data.tradingviewSupported?.toLocaleString()}`
      });
      
      // Refresh stats
      fetchCryptoStats();
    } catch (error: any) {
      console.error('Error syncing crypto:', error);
      toast.error('Failed to sync crypto', {
        description: error.message
      });
    } finally {
      setSyncingCrypto(false);
    }
  };

  const formatLastHeartbeat = (timestamp: string | null) => {
    if (!timestamp) return 'Never';
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 1000 / 60);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins === 1) return '1 minute ago';
    if (diffMins < 60) return `${diffMins} minutes ago`;
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours === 1) return '1 hour ago';
    if (diffHours < 24) return `${diffHours} hours ago`;
    
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  };

  return (
    <div className="space-y-6">
      {/* Health Status Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Radio className="h-5 w-5" />
            Price Relay Health Status
          </CardTitle>
          <CardDescription>
            Real-time monitoring of the Polygon.io WebSocket price relay
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Checking relay status...</span>
            </div>
          ) : relayHealth ? (
            <>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {relayHealth.isActive ? (
                    <>
                      <CheckCircle className="h-6 w-6 text-green-500" />
                      <div>
                        <p className="font-semibold text-green-500">Active & Healthy</p>
                        <p className="text-sm text-muted-foreground">
                          Last heartbeat: {formatLastHeartbeat(relayHealth.lastHeartbeat)}
                        </p>
                      </div>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="h-6 w-6 text-destructive" />
                      <div>
                        <p className="font-semibold text-destructive">
                          {relayHealth.lastHeartbeat ? 'Stale / Dead' : 'Not Running'}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {relayHealth.lastHeartbeat 
                            ? `Last heartbeat: ${formatLastHeartbeat(relayHealth.lastHeartbeat)}`
                            : 'No active relay instance found'}
                        </p>
                      </div>
                    </>
                  )}
                </div>
                <Badge variant={relayHealth.isActive ? "default" : "destructive"}>
                  {relayHealth.isActive ? 'LIVE' : 'DOWN'}
                </Badge>
              </div>

              {!relayHealth.isActive && (
                <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 text-sm">
                  <p className="font-semibold text-destructive mb-1">⚠️ CRITICAL: Price Relay is DOWN</p>
                  <p className="text-muted-foreground">
                    Real-time prices are NOT updating. The ticker tape shows stale data. 
                    Click "Force Restart" below to restore live WebSocket streaming.
                  </p>
                </div>
              )}

              {relayHealth.isActive && (
                <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg p-3 text-sm">
                  <p className="font-semibold text-green-700 dark:text-green-300 mb-1">✅ Live & Streaming</p>
                  <p className="text-muted-foreground">
                    WebSocket connected to Polygon.io. Auto-restart via cron every 5 minutes to maintain connection.
                  </p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4 pt-2 border-t">
                <div>
                  <p className="text-xs text-muted-foreground">Instance ID</p>
                  <p className="text-sm font-mono">{relayHealth.instanceId || 'None'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Minutes Since Heartbeat</p>
                  <p className="text-sm font-mono">
                    {relayHealth.minutesStale !== null ? relayHealth.minutesStale : 'N/A'}
                  </p>
                </div>
              </div>

              <Button 
                onClick={handleForceRestart}
                disabled={restarting}
                variant={relayHealth.isActive ? "outline" : "default"}
                className="w-full"
              >
                {restarting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <RefreshCw className="mr-2 h-4 w-4" />
                {restarting ? 'Restarting...' : 'Force Restart Relay'}
              </Button>
            </>
          ) : (
            <p className="text-muted-foreground">Unable to fetch relay status</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Sync Prices Now
          </CardTitle>
          <CardDescription>
            Manually sync current prices from Polygon.io and CoinGecko to populate live_prices table
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            This will fetch current prices for the top 100 cryptocurrencies and update the live_prices table.
            Uses Polygon.io as primary source, with CoinGecko and exchange data as fallbacks.
          </p>
          <div className="bg-muted/50 p-3 rounded-lg text-xs space-y-1">
            <p><strong>💡 Use this when:</strong></p>
            <p>• Brief generation is failing due to missing price data</p>
            <p>• The automated price relay is not running</p>
            <p>• You need fresh prices immediately</p>
          </div>
          <Button 
            onClick={handleSyncPrices} 
            disabled={syncing}
            className="w-full"
          >
            {syncing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {syncing ? 'Syncing Prices...' : 'Sync Prices Now'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Map Polygon Tickers
          </CardTitle>
          <CardDescription>
            Map the 71 target crypto symbols to Polygon.io ticker format (X:SYMBOLUSD)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            This will query the poly_tickers table and update ticker_mappings with the correct polygon_ticker values
            for all target cryptocurrencies (BTC, ETH, SOL, etc.).
          </p>
          <Button 
            onClick={handleMapTickers} 
            disabled={mapping}
            className="w-full"
          >
            {mapping && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {mapping ? 'Mapping Tickers...' : 'Map Polygon Tickers'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Radio className="h-5 w-5" />
            Price Relay Control
          </CardTitle>
          <CardDescription>
            Start or stop the centralized WebSocket connection to stream live prices
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            This will establish a single WebSocket connection to Polygon.io and subscribe to all mapped crypto tickers.
            Prices will be buffered and upserted to the live_prices table every second.
          </p>
          <div className="bg-muted/50 p-3 rounded-lg text-xs space-y-1">
            <p><strong>⚠️ Important:</strong> Run "Map Polygon Tickers" first!</p>
            <p>The relay will automatically subscribe to all tickers with polygon_ticker values in ticker_mappings.</p>
            <p><strong>⏰ Auto-Restart:</strong> Cron job runs every 5 minutes to keep the relay alive and maintain the WebSocket connection.</p>
            <p><strong>🛑 If stuck:</strong> Use "Force Stop" to clear leadership and wait 30 seconds before restarting.</p>
          </div>
          <div className="flex gap-2">
            <Button 
              onClick={handleStartRelay} 
              disabled={relaying || stopping}
              className="flex-1"
              variant="default"
            >
              {relaying && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {relaying ? 'Starting...' : 'Start Relay'}
            </Button>
            <Button 
              onClick={handleStopRelay} 
              disabled={stopping || relaying}
              className="flex-1"
              variant="destructive"
            >
              {stopping && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <StopCircle className="mr-2 h-4 w-4" />
              {stopping ? 'Stopping...' : 'Force Stop'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Stock Sync Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Sync All Stocks to ticker_mappings
          </CardTitle>
          <CardDescription>
            Import all {stockStats?.totalStocks?.toLocaleString() || '~11,000'} common stocks from poly_tickers into ticker_mappings
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {stockStats && (
            <div className="grid grid-cols-2 gap-4 p-3 bg-muted/50 rounded-lg">
              <div>
                <p className="text-xs text-muted-foreground">Total Common Stocks</p>
                <p className="text-lg font-semibold">{stockStats.totalStocks.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Already in ticker_mappings</p>
                <p className="text-lg font-semibold">{stockStats.existingMappings.toLocaleString()}</p>
              </div>
              <div className="col-span-2">
                <p className="text-xs text-muted-foreground mb-1">Coverage</p>
                <Progress 
                  value={stockStats.totalStocks > 0 ? (stockStats.existingMappings / stockStats.totalStocks) * 100 : 0} 
                  className="h-2"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {((stockStats.existingMappings / stockStats.totalStocks) * 100).toFixed(1)}% synced
                </p>
              </div>
            </div>
          )}
          
          <p className="text-sm text-muted-foreground">
            This will sync all common stocks (type: CS) from Polygon.io's poly_tickers table into ticker_mappings 
            with proper TradingView symbol formatting (e.g., NYSE:AAPL, NASDAQ:GOOGL).
          </p>
          
          <div className="bg-muted/50 p-3 rounded-lg text-xs space-y-1">
            <p><strong>📊 What gets synced:</strong></p>
            <p>• Common Stocks (CS) only - excludes warrants, units, rights, preferred shares</p>
            <p>• TradingView symbol format: EXCHANGE:TICKER (NYSE, NASDAQ, AMEX, etc.)</p>
            <p>• Skips existing mappings to avoid duplicates</p>
            <p>• Enables ZombieDog AI research on all US stocks</p>
          </div>
          
          <Button 
            onClick={handleSyncStocks}
            disabled={syncingStocks}
            className="w-full"
          >
            {syncingStocks && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <TrendingUp className="mr-2 h-4 w-4" />
            {syncingStocks ? 'Syncing Stocks...' : `Sync All ${stockStats?.totalStocks?.toLocaleString() || ''} Stocks`}
          </Button>
        </CardContent>
      </Card>

      {/* Crypto Sync Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Coins className="h-5 w-5" />
            Sync All CoinGecko Coins to ticker_mappings
          </CardTitle>
          <CardDescription>
            Import all {cryptoStats?.totalCgCoins?.toLocaleString() || '~19,000'} CoinGecko coins for maximum ZombieDog coverage
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {cryptoStats && (
            <div className="grid grid-cols-2 gap-4 p-3 bg-muted/50 rounded-lg">
              <div>
                <p className="text-xs text-muted-foreground">Total CoinGecko Coins</p>
                <p className="text-lg font-semibold">{cryptoStats.totalCgCoins.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Already in ticker_mappings</p>
                <p className="text-lg font-semibold">{cryptoStats.existingCryptoMappings.toLocaleString()}</p>
              </div>
              <div className="col-span-2">
                <p className="text-xs text-muted-foreground mb-1">Coverage</p>
                <Progress 
                  value={cryptoStats.totalCgCoins > 0 ? (cryptoStats.existingCryptoMappings / cryptoStats.totalCgCoins) * 100 : 0} 
                  className="h-2"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {((cryptoStats.existingCryptoMappings / cryptoStats.totalCgCoins) * 100).toFixed(1)}% synced
                </p>
              </div>
            </div>
          )}
          
          <p className="text-sm text-muted-foreground">
            This will import ALL cryptocurrencies from CoinGecko's master list into ticker_mappings, 
            including obscure tokens. Enables ZombieDog to research any coin users ask about.
          </p>
          
          <div className="bg-muted/50 p-3 rounded-lg text-xs space-y-1">
            <p><strong>🪙 What gets synced:</strong></p>
            <p>• All 19,276 CoinGecko coins with coingecko_id for price lookups</p>
            <p>• TradingView symbols for coins with exchange pairs (Coinbase, Binance, etc.)</p>
            <p>• DEX platforms/contract addresses for on-chain tokens</p>
            <p>• Skips existing mappings to avoid duplicates</p>
          </div>
          
          <Button 
            onClick={handleSyncCrypto}
            disabled={syncingCrypto}
            className="w-full"
          >
            {syncingCrypto && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <Coins className="mr-2 h-4 w-4" />
            {syncingCrypto ? 'Syncing Crypto (this may take a minute)...' : `Sync All ${cryptoStats?.totalCgCoins?.toLocaleString() || ''} Crypto`}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
