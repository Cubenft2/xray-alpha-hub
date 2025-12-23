import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useWebSocket } from '@/contexts/WebSocketContext';
import { supabase } from '@/integrations/supabase/client';
import { 
  Activity, 
  Wifi, 
  WifiOff, 
  Database, 
  RefreshCw, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  Zap,
  Server,
  ArrowDown,
  Clock
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface WorkerHealth {
  status: string;
  polygonConnected: boolean;
  totalPairsAvailable?: number;
  subscribedSymbols?: number;
  cachedPrices: number;
  messageCount: number;
  lastPriceAt: string | null;
  allTokensSubscribed?: boolean;
  uptime?: number;
}

interface DbStats {
  total_tokens: number;
  ws_prices: number;
  ws_fresh: number;
  polygon_tokens: number;
  last_ws_sync: string | null;
  polygon_prices: number;
  lunarcrush_prices: number;
  coingecko_prices: number;
}

interface SampleToken {
  canonical_symbol: string;
  ws_price_usd: number | null;
  ws_price_updated_at: string | null;
  polygon_price_usd: number | null;
  polygon_price_updated_at: string | null;
  lunarcrush_price_usd: number | null;
  lunarcrush_price_updated_at: string | null;
  price_source: string | null;
  price_usd: number | null;
}

const WORKER_URL = 'https://crypto-stream.xrprat.workers.dev';

export function WebSocketDiagnostics() {
  const { 
    isConnected, 
    isFallbackMode, 
    priceCount, 
    messageCount, 
    lastUpdateTime, 
    activeSymbols, 
    error,
    prices,
    subscribe,
    unsubscribe
  } = useWebSocket();

  const [workerHealth, setWorkerHealth] = useState<WorkerHealth | null>(null);
  const [workerLoading, setWorkerLoading] = useState(true);
  const [workerError, setWorkerError] = useState<string | null>(null);
  
  const [dbStats, setDbStats] = useState<DbStats | null>(null);
  const [dbLoading, setDbLoading] = useState(true);
  
  const [sampleTokens, setSampleTokens] = useState<SampleToken[]>([]);
  const [sampleLoading, setSampleLoading] = useState(true);
  
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [syncing, setSyncing] = useState(false);

  const fetchWorkerHealth = useCallback(async () => {
    try {
      setWorkerLoading(true);
      const response = await fetch(`${WORKER_URL}/health`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      setWorkerHealth(data);
      setWorkerError(null);
    } catch (err) {
      setWorkerError(err instanceof Error ? err.message : 'Failed to fetch');
      setWorkerHealth(null);
    } finally {
      setWorkerLoading(false);
    }
  }, []);

  const fetchDbStats = useCallback(async () => {
    try {
      setDbLoading(true);
      const { data, error } = await supabase.rpc('get_token_cards_ws_stats' as any);
      
      if (error) {
        // Fallback to manual query if RPC doesn't exist
        const { data: tokens, error: queryError } = await supabase
          .from('token_cards')
          .select('ws_price_usd, ws_price_updated_at, in_polygon, polygon_price_usd, lunarcrush_price_usd, coingecko_price_usd');
        
        if (queryError) throw queryError;
        
        const now = new Date();
        const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
        
        const stats: DbStats = {
          total_tokens: tokens?.length || 0,
          ws_prices: tokens?.filter(t => t.ws_price_usd !== null).length || 0,
          ws_fresh: tokens?.filter(t => t.ws_price_updated_at && new Date(t.ws_price_updated_at) > fiveMinutesAgo).length || 0,
          polygon_tokens: tokens?.filter(t => t.in_polygon === true).length || 0,
          last_ws_sync: tokens?.reduce((latest, t) => {
            if (!t.ws_price_updated_at) return latest;
            return !latest || new Date(t.ws_price_updated_at) > new Date(latest) ? t.ws_price_updated_at : latest;
          }, null as string | null) || null,
          polygon_prices: tokens?.filter(t => t.polygon_price_usd !== null).length || 0,
          lunarcrush_prices: tokens?.filter(t => t.lunarcrush_price_usd !== null).length || 0,
          coingecko_prices: tokens?.filter(t => t.coingecko_price_usd !== null).length || 0,
        };
        setDbStats(stats);
      } else {
        setDbStats(data?.[0] || null);
      }
    } catch (err) {
      console.error('Failed to fetch DB stats:', err);
    } finally {
      setDbLoading(false);
    }
  }, []);

  const fetchSampleTokens = useCallback(async () => {
    try {
      setSampleLoading(true);
      const { data, error } = await supabase
        .from('token_cards')
        .select('canonical_symbol, ws_price_usd, ws_price_updated_at, polygon_price_usd, polygon_price_updated_at, lunarcrush_price_usd, lunarcrush_price_updated_at, price_source, price_usd')
        .not('ws_price_usd', 'is', null)
        .order('market_cap', { ascending: false, nullsFirst: false })
        .limit(10);
      
      if (error) throw error;
      setSampleTokens((data as SampleToken[]) || []);
    } catch (err) {
      console.error('Failed to fetch sample tokens:', err);
    } finally {
      setSampleLoading(false);
    }
  }, []);

  const handleTriggerSync = async () => {
    try {
      setSyncing(true);
      const { error } = await supabase.functions.invoke('sync-token-cards-websocket');
      if (error) throw error;
      toast.success('DB sync triggered successfully');
      setTimeout(() => {
        fetchDbStats();
        fetchSampleTokens();
      }, 2000);
    } catch (err) {
      toast.error('Failed to trigger sync: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setSyncing(false);
    }
  };

  const handleTestWorker = async () => {
    await fetchWorkerHealth();
    toast.success('Worker health check complete');
  };

  // Auto-refresh
  useEffect(() => {
    fetchWorkerHealth();
    fetchDbStats();
    fetchSampleTokens();
    
    const workerInterval = setInterval(fetchWorkerHealth, 10000);
    const dbInterval = setInterval(() => {
      fetchDbStats();
      fetchSampleTokens();
      setLastRefresh(new Date());
    }, 30000);
    
    return () => {
      clearInterval(workerInterval);
      clearInterval(dbInterval);
    };
  }, [fetchWorkerHealth, fetchDbStats, fetchSampleTokens]);

  const formatTime = (timestamp: string | number | null): string => {
    if (!timestamp) return 'Never';
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    
    if (diffSec < 60) return `${diffSec}s ago`;
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
    return date.toLocaleTimeString();
  };

  const formatPrice = (price: number | null): string => {
    if (price === null) return '-';
    if (price < 0.01) return `$${price.toFixed(6)}`;
    if (price < 1) return `$${price.toFixed(4)}`;
    return `$${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const StatusBadge = ({ ok, label }: { ok: boolean; label: string }) => (
    <Badge variant="outline" className={cn(
      ok ? 'bg-success/10 text-success border-success/30' : 'bg-destructive/10 text-destructive border-destructive/30'
    )}>
      {ok ? <CheckCircle className="w-3 h-3 mr-1" /> : <XCircle className="w-3 h-3 mr-1" />}
      {label}
    </Badge>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">WebSocket Diagnostics</h2>
          <p className="text-muted-foreground">Real-time data flow monitoring</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Clock className="w-4 h-4" />
          Last refresh: {formatTime(lastRefresh.getTime())}
        </div>
      </div>

      {/* Data Flow Visualization */}
      <Card className="bg-gradient-to-br from-background to-muted/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="w-5 h-5" />
            Data Flow Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center gap-2 py-4 font-mono text-sm">
            {/* Polygon API */}
            <div className="flex items-center gap-3 p-3 rounded-lg border bg-card w-full max-w-md">
              <Server className="w-5 h-5 text-primary" />
              <span className="font-semibold">Polygon.io API</span>
              <Badge variant="outline" className="ml-auto bg-success/10 text-success">Source</Badge>
            </div>
            
            <ArrowDown className="w-5 h-5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">(WebSocket)</span>
            
            {/* Cloudflare Worker */}
            <div className={cn(
              "flex items-center gap-3 p-3 rounded-lg border w-full max-w-md",
              workerHealth?.polygonConnected ? "bg-success/5 border-success/30" : "bg-destructive/5 border-destructive/30"
            )}>
              <Zap className="w-5 h-5 text-amber-500" />
              <div className="flex-1">
                <span className="font-semibold">Cloudflare Worker</span>
                <div className="text-xs text-muted-foreground">
                  {workerHealth ? `Cached: ${workerHealth.cachedPrices} | Msgs: ${workerHealth.messageCount.toLocaleString()}` : 'Loading...'}
                </div>
              </div>
              <StatusBadge ok={workerHealth?.polygonConnected || false} label={workerHealth?.status || 'Unknown'} />
            </div>
            
            <ArrowDown className="w-5 h-5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">(WebSocket)</span>
            
            {/* Browser Hook */}
            <div className={cn(
              "flex items-center gap-3 p-3 rounded-lg border w-full max-w-md",
              isConnected ? "bg-success/5 border-success/30" : isFallbackMode ? "bg-amber-500/5 border-amber-500/30" : "bg-destructive/5 border-destructive/30"
            )}>
              {isConnected ? <Wifi className="w-5 h-5 text-success" /> : <WifiOff className="w-5 h-5 text-destructive" />}
              <div className="flex-1">
                <span className="font-semibold">Browser Hook</span>
                <div className="text-xs text-muted-foreground">
                  Prices: {priceCount} | Msgs: {messageCount.toLocaleString()}
                </div>
              </div>
              <StatusBadge 
                ok={isConnected} 
                label={isConnected ? 'Live' : isFallbackMode ? 'Fallback' : 'Disconnected'} 
              />
            </div>
            
            <ArrowDown className="w-5 h-5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">(REST sync every 1 min)</span>
            
            {/* Supabase */}
            <div className={cn(
              "flex items-center gap-3 p-3 rounded-lg border w-full max-w-md",
              dbStats && dbStats.ws_fresh > 0 ? "bg-success/5 border-success/30" : "bg-amber-500/5 border-amber-500/30"
            )}>
              <Database className="w-5 h-5 text-blue-500" />
              <div className="flex-1">
                <span className="font-semibold">Supabase token_cards</span>
                <div className="text-xs text-muted-foreground">
                  {dbStats ? `WS Prices: ${dbStats.ws_prices} | Fresh: ${dbStats.ws_fresh}` : 'Loading...'}
                </div>
              </div>
              <StatusBadge 
                ok={dbStats ? dbStats.ws_fresh > 0 : false} 
                label={dbStats ? `${dbStats.ws_fresh} fresh` : 'Loading'} 
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Cloudflare Worker Health */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-amber-500" />
              Cloudflare Worker Health
            </CardTitle>
            <CardDescription>External WebSocket proxy status</CardDescription>
          </CardHeader>
          <CardContent>
            {workerLoading && !workerHealth ? (
              <div className="space-y-3">
                {[...Array(6)].map((_, i) => (
                  <Skeleton key={i} className="h-6 w-full" />
                ))}
              </div>
            ) : workerError ? (
              <div className="flex items-center gap-2 text-destructive">
                <XCircle className="w-5 h-5" />
                <span>Error: {workerError}</span>
              </div>
            ) : workerHealth && (
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Status</span>
                  <StatusBadge ok={workerHealth.status === 'healthy' || workerHealth.status === 'ok'} label={workerHealth.status} />
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Polygon Connected</span>
                  <StatusBadge ok={workerHealth.polygonConnected} label={workerHealth.polygonConnected ? 'Yes' : 'No'} />
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Total Pairs Available</span>
                  <span className="font-mono">{workerHealth.totalPairsAvailable ?? '-'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Subscribed Symbols</span>
                  <span className="font-mono">{workerHealth.subscribedSymbols ?? '-'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Cached Prices</span>
                  <span className="font-mono">{workerHealth.cachedPrices}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Message Count</span>
                  <span className="font-mono">{workerHealth.messageCount.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Last Price Update</span>
                  <span className="font-mono text-sm">{formatTime(workerHealth.lastPriceAt)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">All Tokens Subscribed</span>
                  {workerHealth.allTokensSubscribed !== undefined ? (
                    <StatusBadge ok={workerHealth.allTokensSubscribed} label={workerHealth.allTokensSubscribed ? 'Yes' : 'No'} />
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Frontend WebSocket Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {isConnected ? <Wifi className="w-5 h-5 text-success" /> : <WifiOff className="w-5 h-5 text-destructive" />}
              Frontend WebSocket Status
            </CardTitle>
            <CardDescription>Browser connection state</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Connected</span>
                <StatusBadge ok={isConnected} label={isConnected ? 'Yes' : 'No'} />
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Fallback Mode</span>
                <Badge variant="outline" className={cn(
                  isFallbackMode 
                    ? 'bg-amber-500/10 text-amber-500 border-amber-500/30' 
                    : 'bg-muted/30 text-muted-foreground'
                )}>
                  {isFallbackMode ? <AlertTriangle className="w-3 h-3 mr-1" /> : null}
                  {isFallbackMode ? 'Active' : 'Inactive'}
                </Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Prices in Memory</span>
                <span className="font-mono">{priceCount}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Message Count</span>
                <span className="font-mono">{messageCount.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Last Update</span>
                <span className="font-mono text-sm">{formatTime(lastUpdateTime)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Active Symbols</span>
                <span className="font-mono">{activeSymbols.length}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Error</span>
                {error ? (
                  <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/30">
                    {error}
                  </Badge>
                ) : (
                  <span className="text-success">None</span>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Database Sync Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="w-5 h-5 text-blue-500" />
            Database Sync Status
          </CardTitle>
          <CardDescription>token_cards table statistics</CardDescription>
        </CardHeader>
        <CardContent>
          {dbLoading && !dbStats ? (
            <Skeleton className="h-24 w-full" />
          ) : dbStats ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 rounded-lg bg-muted/30 text-center">
                <div className="text-2xl font-bold">{dbStats.total_tokens.toLocaleString()}</div>
                <div className="text-sm text-muted-foreground">Total Tokens</div>
              </div>
              <div className="p-4 rounded-lg bg-muted/30 text-center">
                <div className="text-2xl font-bold text-success">{dbStats.ws_prices}</div>
                <div className="text-sm text-muted-foreground">WS Prices</div>
              </div>
              <div className="p-4 rounded-lg bg-muted/30 text-center">
                <div className="text-2xl font-bold text-success">{dbStats.ws_fresh}</div>
                <div className="text-sm text-muted-foreground">WS Fresh (&lt;5m)</div>
              </div>
              <div className="p-4 rounded-lg bg-muted/30 text-center">
                <div className="text-2xl font-bold text-blue-500">{dbStats.polygon_tokens}</div>
                <div className="text-sm text-muted-foreground">In Polygon</div>
              </div>
              <div className="p-4 rounded-lg bg-muted/30 text-center">
                <div className="text-2xl font-bold">{dbStats.polygon_prices}</div>
                <div className="text-sm text-muted-foreground">Polygon Prices</div>
              </div>
              <div className="p-4 rounded-lg bg-muted/30 text-center">
                <div className="text-2xl font-bold">{dbStats.lunarcrush_prices}</div>
                <div className="text-sm text-muted-foreground">LunarCrush Prices</div>
              </div>
              <div className="p-4 rounded-lg bg-muted/30 text-center">
                <div className="text-2xl font-bold">{dbStats.coingecko_prices}</div>
                <div className="text-sm text-muted-foreground">CoinGecko Prices</div>
              </div>
              <div className="p-4 rounded-lg bg-muted/30 text-center">
                <div className="text-lg font-mono">{formatTime(dbStats.last_ws_sync)}</div>
                <div className="text-sm text-muted-foreground">Last WS Sync</div>
              </div>
            </div>
          ) : (
            <div className="text-muted-foreground">No data available</div>
          )}
        </CardContent>
      </Card>

      {/* Sample Live Prices */}
      <Card>
        <CardHeader>
          <CardTitle>Sample Live Prices</CardTitle>
          <CardDescription>Top 10 tokens with WebSocket data</CardDescription>
        </CardHeader>
        <CardContent>
          {sampleLoading ? (
            <Skeleton className="h-48 w-full" />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Symbol</TableHead>
                    <TableHead>WS Price (Hook)</TableHead>
                    <TableHead>DB WS Price</TableHead>
                    <TableHead>DB Polygon</TableHead>
                    <TableHead>DB LunarCrush</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>WS Updated</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sampleTokens.map((token) => {
                    const livePrice = prices[token.canonical_symbol.toUpperCase()];
                    return (
                      <TableRow key={token.canonical_symbol}>
                        <TableCell className="font-semibold">{token.canonical_symbol}</TableCell>
                        <TableCell className={cn("font-mono", livePrice ? "text-success" : "text-muted-foreground")}>
                          {livePrice ? formatPrice(livePrice.price) : '-'}
                        </TableCell>
                        <TableCell className="font-mono">{formatPrice(token.ws_price_usd)}</TableCell>
                        <TableCell className="font-mono">{formatPrice(token.polygon_price_usd)}</TableCell>
                        <TableCell className="font-mono">{formatPrice(token.lunarcrush_price_usd)}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {token.price_source || 'N/A'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatTime(token.ws_price_updated_at)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Manual Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Manual Actions</CardTitle>
          <CardDescription>Debug and control operations</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" onClick={handleTestWorker}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Test Worker Connection
            </Button>
            <Button variant="outline" onClick={() => {
              unsubscribe(activeSymbols);
              toast.info('Forced REST fallback mode');
            }}>
              <WifiOff className="w-4 h-4 mr-2" />
              Force REST Fallback
            </Button>
            <Button variant="outline" onClick={() => {
              subscribe(['BTC', 'ETH', 'SOL', 'XRP']);
              toast.info('Reconnection triggered');
            }}>
              <Wifi className="w-4 h-4 mr-2" />
              Reconnect WebSocket
            </Button>
            <Button variant="default" onClick={handleTriggerSync} disabled={syncing}>
              {syncing ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Database className="w-4 h-4 mr-2" />}
              Trigger DB Sync
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
