import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, Zap, RefreshCw, CheckCircle, TrendingUp, Coins, Clock, Database } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

interface StockSyncStats {
  totalStocks: number;
  existingMappings: number;
}

interface CryptoSyncStats {
  totalCgCoins: number;
  existingCryptoMappings: number;
}

interface LivePricesStats {
  totalPrices: number;
  cryptoPrices: number;
  stockPrices: number;
  lastUpdated: string | null;
}

export function PolygonSync() {
  const [mapping, setMapping] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncingStocks, setSyncingStocks] = useState(false);
  const [syncingCrypto, setSyncingCrypto] = useState(false);
  const [pollingCrypto, setPollingCrypto] = useState(false);
  const [pollingStocks, setPollingStocks] = useState(false);
  const [stockStats, setStockStats] = useState<StockSyncStats | null>(null);
  const [cryptoStats, setCryptoStats] = useState<CryptoSyncStats | null>(null);
  const [livePricesStats, setLivePricesStats] = useState<LivePricesStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAllStats();
    const interval = setInterval(fetchLivePricesStats, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchAllStats = async () => {
    await Promise.all([
      fetchStockStats(),
      fetchCryptoStats(),
      fetchLivePricesStats()
    ]);
    setLoading(false);
  };

  const fetchLivePricesStats = async () => {
    try {
      // Get total prices count
      const { count: totalPrices } = await supabase
        .from('live_prices')
        .select('*', { count: 'exact', head: true });

      // Get crypto prices count
      const { count: cryptoPrices } = await supabase
        .from('live_prices')
        .select('*', { count: 'exact', head: true })
        .like('ticker', 'X:%');

      // Get most recent update
      const { data: recentPrice } = await supabase
        .from('live_prices')
        .select('updated_at')
        .order('updated_at', { ascending: false })
        .limit(1)
        .single();

      setLivePricesStats({
        totalPrices: totalPrices || 0,
        cryptoPrices: cryptoPrices || 0,
        stockPrices: (totalPrices || 0) - (cryptoPrices || 0),
        lastUpdated: recentPrice?.updated_at || null
      });
    } catch (error) {
      console.error('Error fetching live prices stats:', error);
    }
  };

  const fetchCryptoStats = async () => {
    try {
      const { count: totalCgCoins } = await supabase
        .from('cg_master')
        .select('*', { count: 'exact', head: true });

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
      const { count: totalStocks } = await supabase
        .from('poly_tickers')
        .select('*', { count: 'exact', head: true })
        .eq('market', 'stocks')
        .eq('active', true)
        .eq('type', 'CS');

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

  const handlePollCryptoPrices = async () => {
    setPollingCrypto(true);
    try {
      const { data, error } = await supabase.functions.invoke('polygon-rest-poller');
      
      if (error) throw error;
      
      toast.success('Crypto prices polled', {
        description: `Updated: ${data.processed || 0} prices`
      });
      
      fetchLivePricesStats();
    } catch (error: any) {
      console.error('Error polling crypto prices:', error);
      toast.error('Failed to poll crypto prices', {
        description: error.message
      });
    } finally {
      setPollingCrypto(false);
    }
  };

  const handlePollStockPrices = async () => {
    setPollingStocks(true);
    try {
      const { data, error } = await supabase.functions.invoke('polygon-stock-poller');
      
      if (error) throw error;
      
      toast.success('Stock prices polled', {
        description: `Updated: ${data.processed || 0} prices (15-min delayed)`
      });
      
      fetchLivePricesStats();
    } catch (error: any) {
      console.error('Error polling stock prices:', error);
      toast.error('Failed to poll stock prices', {
        description: error.message
      });
    } finally {
      setPollingStocks(false);
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
      
      fetchLivePricesStats();
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

  const formatLastUpdate = (timestamp: string | null) => {
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
      {/* Live Prices Status Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Live Prices Status
          </CardTitle>
          <CardDescription>
            REST API polling updates live_prices table (cron: crypto every 2min, stocks every 5min)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Loading stats...</span>
            </div>
          ) : livePricesStats ? (
            <>
              <div className="grid grid-cols-3 gap-4">
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-xs text-muted-foreground">Total Prices</p>
                  <p className="text-2xl font-bold">{livePricesStats.totalPrices.toLocaleString()}</p>
                </div>
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-xs text-muted-foreground">Crypto (X:*USD)</p>
                  <p className="text-2xl font-bold text-primary">{livePricesStats.cryptoPrices.toLocaleString()}</p>
                </div>
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-xs text-muted-foreground">Stocks</p>
                  <p className="text-2xl font-bold">{livePricesStats.stockPrices.toLocaleString()}</p>
                </div>
              </div>
              
              <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <div className="flex-1">
                  <p className="font-medium text-green-700 dark:text-green-300">REST Polling Active</p>
                  <p className="text-sm text-muted-foreground">
                    Last update: {formatLastUpdate(livePricesStats.lastUpdated)}
                  </p>
                </div>
                <Badge variant="secondary">
                  <Clock className="h-3 w-3 mr-1" />
                  UNLIMITED API
                </Badge>
              </div>

              <div className="bg-muted/50 p-3 rounded-lg text-xs space-y-1">
                <p><strong>✅ Architecture:</strong> REST polling (unlimited calls) replaces WebSocket (limited connections)</p>
                <p>• Crypto: polygon-rest-poller runs every 2 minutes</p>
                <p>• Stocks: polygon-stock-poller runs every 5 minutes (15-min delayed data)</p>
                <p>• Frontend reads from live_prices table via useCentralizedPrices hook</p>
              </div>

              <div className="flex gap-2">
                <Button 
                  onClick={handlePollCryptoPrices}
                  disabled={pollingCrypto}
                  variant="outline"
                  className="flex-1"
                >
                  {pollingCrypto && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  <RefreshCw className="mr-2 h-4 w-4" />
                  {pollingCrypto ? 'Polling...' : 'Poll Crypto Now'}
                </Button>
                <Button 
                  onClick={handlePollStockPrices}
                  disabled={pollingStocks}
                  variant="outline"
                  className="flex-1"
                >
                  {pollingStocks && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  <RefreshCw className="mr-2 h-4 w-4" />
                  {pollingStocks ? 'Polling...' : 'Poll Stocks Now'}
                </Button>
              </div>
            </>
          ) : (
            <p className="text-muted-foreground">Unable to fetch stats</p>
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
            Map crypto symbols to Polygon.io ticker format (X:SYMBOLUSD)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            This will update ticker_mappings with the correct polygon_ticker values for valid crypto symbols.
            Validates symbols to prevent emoji/special character mappings.
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
