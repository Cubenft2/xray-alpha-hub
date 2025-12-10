import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQuery } from '@tanstack/react-query';
import { 
  Loader2, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  XCircle,
  Activity,
  Database,
  Wifi,
  Clock,
  Calendar
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface HealthStatus {
  name: string;
  status: 'healthy' | 'warning' | 'error' | 'unknown';
  lastUpdate: string | null;
  details?: string;
}

interface CronJob {
  jobid: number;
  schedule: string;
  command: string;
  nodename: string;
  nodeport: number;
  database: string;
  username: string;
  active: boolean;
  jobname: string | null;
}

// Expected cron jobs based on config.toml
const EXPECTED_CRON_JOBS = [
  { name: 'polygon-rest-poller', schedule: '*/2 * * * *', description: 'Crypto prices every 2 min' },
  { name: 'polygon-stock-poller', schedule: '*/5 * * * *', description: 'Stock prices every 5 min' },
  { name: 'polygon-indicators-refresh', schedule: '0 * * * *', description: 'Technical indicators hourly' },
  { name: 'exchange-sync', schedule: '0 2 * * *', description: 'Exchange pairs daily 2 AM' },
  { name: 'exchange-data-aggregator', schedule: '*/15 * * * *', description: 'Exchange prices every 15 min' },
  { name: 'coingecko-sync', schedule: '0 3 * * *', description: 'CoinGecko sync daily 3 AM' },
  { name: 'lunarcrush-universe', schedule: '*/5 * * * *', description: 'LunarCrush every 5 min' },
];

export function SystemHealth() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [healthData, setHealthData] = useState<HealthStatus[]>([]);

  // Query cron jobs - will return null if function doesn't exist
  const { data: cronJobs, isLoading: cronLoading, refetch: refetchCron } = useQuery({
    queryKey: ['cron-jobs'],
    queryFn: async () => {
      try {
        // Try to call the RPC function - it may not exist yet
        const { data, error } = await supabase.rpc('get_cron_jobs' as any);
        if (error) {
          console.log('get_cron_jobs function not available:', error.message);
          return null;
        }
        return data as CronJob[] | null;
      } catch (err) {
        console.log('Cron jobs query failed:', err);
        return null;
      }
    },
    refetchInterval: 60000
  });

  const checkHealth = async () => {
    setLoading(true);
    const statuses: HealthStatus[] = [];

    try {
      // Check live_prices freshness
      const { data: livePrices } = await supabase
        .from('live_prices')
        .select('updated_at')
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (livePrices) {
        const lastUpdate = new Date(livePrices.updated_at);
        const ageMs = Date.now() - lastUpdate.getTime();
        const ageMinutes = ageMs / 60000;

        statuses.push({
          name: 'Live Prices',
          status: ageMinutes < 2 ? 'healthy' : ageMinutes < 10 ? 'warning' : 'error',
          lastUpdate: livePrices.updated_at,
          details: `${Math.round(ageMinutes)} minutes old`,
        });
      } else {
        statuses.push({
          name: 'Live Prices',
          status: 'error',
          lastUpdate: null,
          details: 'No data found',
        });
      }

      // Check exchange_ticker_data freshness per exchange
      const exchanges = ['binance', 'bybit', 'okx', 'kucoin', 'coinbase'];
      for (const exchange of exchanges) {
        const { data: exchangeData } = await supabase
          .from('exchange_ticker_data')
          .select('updated_at')
          .eq('exchange', exchange)
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (exchangeData) {
          const lastUpdate = new Date(exchangeData.updated_at);
          const ageHours = (Date.now() - lastUpdate.getTime()) / 3600000;

          statuses.push({
            name: `Exchange: ${exchange.charAt(0).toUpperCase() + exchange.slice(1)}`,
            status: ageHours < 1 ? 'healthy' : ageHours < 24 ? 'warning' : 'error',
            lastUpdate: exchangeData.updated_at,
            details: ageHours < 1 ? `${Math.round(ageHours * 60)} min ago` : `${Math.round(ageHours)} hours old`,
          });
        } else {
          statuses.push({
            name: `Exchange: ${exchange.charAt(0).toUpperCase() + exchange.slice(1)}`,
            status: 'unknown',
            lastUpdate: null,
            details: 'No data',
          });
        }
      }

      // Check assets count
      const { count: assetCount } = await supabase
        .from('assets')
        .select('*', { count: 'exact', head: true });

      statuses.push({
        name: 'Assets',
        status: (assetCount || 0) > 100 ? 'healthy' : 'warning',
        lastUpdate: null,
        details: `${assetCount || 0} total assets`,
      });

      // Check technical_indicators freshness
      const { data: indicators } = await supabase
        .from('technical_indicators')
        .select('created_at')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (indicators) {
        const lastUpdate = new Date(indicators.created_at);
        const ageHours = (Date.now() - lastUpdate.getTime()) / 3600000;

        statuses.push({
          name: 'Technical Indicators',
          status: ageHours < 2 ? 'healthy' : ageHours < 24 ? 'warning' : 'error',
          lastUpdate: indicators.created_at,
          details: `${Math.round(ageHours)} hours old`,
        });
      } else {
        statuses.push({
          name: 'Technical Indicators',
          status: 'unknown',
          lastUpdate: null,
          details: 'No data',
        });
      }

      // Check price_sync_leader (WebSocket relay)
      const { data: leader } = await supabase
        .from('price_sync_leader')
        .select('heartbeat_at, instance_id')
        .eq('id', 'singleton')
        .maybeSingle();

      if (leader) {
        const lastHeartbeat = new Date(leader.heartbeat_at);
        const ageSeconds = (Date.now() - lastHeartbeat.getTime()) / 1000;

        statuses.push({
          name: 'Price Relay (Legacy WS)',
          status: ageSeconds < 60 ? 'healthy' : ageSeconds < 300 ? 'warning' : 'error',
          lastUpdate: leader.heartbeat_at,
          details: ageSeconds < 60 ? 'Active' : `Stale (${Math.round(ageSeconds)}s)`,
        });
      } else {
        statuses.push({
          name: 'Price Relay (Legacy WS)',
          status: 'unknown',
          lastUpdate: null,
          details: 'No leader registered',
        });
      }

      setHealthData(statuses);
    } catch (error) {
      console.error('Health check error:', error);
      toast({
        title: 'Error',
        description: 'Failed to check system health',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkHealth();
    const interval = setInterval(checkHealth, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, []);

  const getStatusIcon = (status: HealthStatus['status']) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case 'warning':
        return <AlertCircle className="h-5 w-5 text-yellow-500" />;
      case 'error':
        return <XCircle className="h-5 w-5 text-red-500" />;
      default:
        return <Clock className="h-5 w-5 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: HealthStatus['status']) => {
    switch (status) {
      case 'healthy':
        return <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20">Healthy</Badge>;
      case 'warning':
        return <Badge variant="outline" className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20">Warning</Badge>;
      case 'error':
        return <Badge variant="outline" className="bg-red-500/10 text-red-500 border-red-500/20">Error</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  const triggerRestPoller = async () => {
    try {
      toast({ title: 'Triggering REST Poller...', description: 'Please wait...' });
      
      const { data, error } = await supabase.functions.invoke('polygon-rest-poller');
      
      if (error) throw error;
      
      toast({
        title: 'REST Poller Complete',
        description: `Updated ${data?.prices_updated || 0} prices in ${data?.duration_ms || 0}ms`,
      });
      
      checkHealth();
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to trigger poller',
        variant: 'destructive',
      });
    }
  };

  const triggerExchangeSync = async () => {
    try {
      toast({ title: 'Triggering Exchange Sync...', description: 'Please wait...' });
      
      const { data, error } = await supabase.functions.invoke('exchange-sync');
      
      if (error) throw error;
      
      toast({
        title: 'Exchange Sync Complete',
        description: `Synced exchanges successfully`,
      });
      
      checkHealth();
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to sync exchanges',
        variant: 'destructive',
      });
    }
  };

  // Check which expected jobs are actually scheduled
  const getCronJobStatus = (expectedName: string) => {
    if (!cronJobs) return 'unknown';
    const found = cronJobs.find(job => 
      job.command?.includes(expectedName) || job.jobname?.includes(expectedName)
    );
    if (!found) return 'missing';
    return found.active ? 'active' : 'inactive';
  };

  const overallHealth = healthData.length > 0
    ? healthData.some(h => h.status === 'error')
      ? 'error'
      : healthData.some(h => h.status === 'warning')
        ? 'warning'
        : 'healthy'
    : 'unknown';

  const scheduledCount = cronJobs?.filter(j => j.active).length || 0;
  const missingCount = EXPECTED_CRON_JOBS.filter(e => getCronJobStatus(e.name) === 'missing').length;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                System Health Monitor
              </CardTitle>
              <CardDescription>
                Real-time status of data sync services and API connections
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {getStatusBadge(overallHealth)}
              <Button variant="outline" size="sm" onClick={checkHealth} disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4">
            {healthData.map((item, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-3 rounded-lg border bg-card"
              >
                <div className="flex items-center gap-3">
                  {getStatusIcon(item.status)}
                  <div>
                    <p className="font-medium">{item.name}</p>
                    {item.lastUpdate && (
                      <p className="text-xs text-muted-foreground">
                        Last update: {formatDistanceToNow(new Date(item.lastUpdate), { addSuffix: true })}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">{item.details}</span>
                  {getStatusBadge(item.status)}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Cron Jobs Status */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Cron Jobs Status
              </CardTitle>
              <CardDescription>
                Scheduled jobs in pg_cron vs expected from config
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={missingCount > 0 ? 'destructive' : 'default'}>
                {scheduledCount} scheduled
              </Badge>
              {missingCount > 0 && (
                <Badge variant="outline" className="bg-red-500/10 text-red-500">
                  {missingCount} missing
                </Badge>
              )}
              <Button variant="outline" size="sm" onClick={() => refetchCron()} disabled={cronLoading}>
                {cronLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {cronJobs === null ? (
            <div className="p-4 border rounded-lg bg-yellow-500/10 border-yellow-500/20">
              <p className="text-sm text-yellow-600 dark:text-yellow-400">
                <strong>Note:</strong> Cannot query cron.job table. You need to create a database function to expose cron job data.
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                Run this SQL in Supabase SQL Editor to enable cron job monitoring:
              </p>
              <pre className="mt-2 p-2 bg-muted rounded text-xs overflow-x-auto">
{`CREATE OR REPLACE FUNCTION public.get_cron_jobs()
RETURNS TABLE (
  jobid bigint,
  schedule text,
  command text,
  nodename text,
  nodeport integer,
  database text,
  username text,
  active boolean,
  jobname text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jobid, schedule, command, nodename, nodeport, database, username, active, jobname
  FROM cron.job;
$$;`}
              </pre>
            </div>
          ) : (
            <div className="space-y-3">
              {EXPECTED_CRON_JOBS.map((expected) => {
                const status = getCronJobStatus(expected.name);
                const actualJob = cronJobs?.find(j => 
                  j.command?.includes(expected.name) || j.jobname?.includes(expected.name)
                );
                
                return (
                  <div
                    key={expected.name}
                    className="flex items-center justify-between p-3 rounded-lg border bg-card"
                  >
                    <div className="flex items-center gap-3">
                      {status === 'active' ? (
                        <CheckCircle2 className="h-5 w-5 text-green-500" />
                      ) : status === 'inactive' ? (
                        <AlertCircle className="h-5 w-5 text-yellow-500" />
                      ) : (
                        <XCircle className="h-5 w-5 text-red-500" />
                      )}
                      <div>
                        <p className="font-medium font-mono text-sm">{expected.name}</p>
                        <p className="text-xs text-muted-foreground">{expected.description}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <code className="text-xs bg-muted px-2 py-1 rounded">
                        {actualJob?.schedule || expected.schedule}
                      </code>
                      <Badge 
                        variant="outline" 
                        className={
                          status === 'active' 
                            ? 'bg-green-500/10 text-green-500 border-green-500/20'
                            : status === 'inactive'
                              ? 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20'
                              : 'bg-red-500/10 text-red-500 border-red-500/20'
                        }
                      >
                        {status === 'active' ? 'Scheduled' : status === 'inactive' ? 'Inactive' : 'Not Scheduled'}
                      </Badge>
                    </div>
                  </div>
                );
              })}

              {/* Show any additional jobs not in expected list */}
              {cronJobs?.filter(job => 
                !EXPECTED_CRON_JOBS.some(e => job.command?.includes(e.name) || job.jobname?.includes(e.name))
              ).map((job) => (
                <div
                  key={job.jobid}
                  className="flex items-center justify-between p-3 rounded-lg border bg-muted/50"
                >
                  <div className="flex items-center gap-3">
                    {job.active ? (
                      <CheckCircle2 className="h-5 w-5 text-blue-500" />
                    ) : (
                      <AlertCircle className="h-5 w-5 text-muted-foreground" />
                    )}
                    <div>
                      <p className="font-medium font-mono text-sm">{job.jobname || `Job #${job.jobid}`}</p>
                      <p className="text-xs text-muted-foreground truncate max-w-md">
                        {job.command?.substring(0, 80)}...
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <code className="text-xs bg-muted px-2 py-1 rounded">{job.schedule}</code>
                    <Badge variant="outline" className="bg-blue-500/10 text-blue-500">
                      Custom
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wifi className="h-5 w-5" />
            Manual Triggers
          </CardTitle>
          <CardDescription>
            Manually trigger sync operations if automated jobs are not running
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Button onClick={triggerRestPoller} variant="outline" className="w-full">
              <Database className="mr-2 h-4 w-4" />
              Trigger REST Price Poller
            </Button>
            <Button onClick={triggerExchangeSync} variant="outline" className="w-full">
              <RefreshCw className="mr-2 h-4 w-4" />
              Trigger Exchange Sync
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            <strong>Note:</strong> REST Poller uses Polygon's unlimited REST API (recommended). 
            The legacy WebSocket relay has connection limits and is being deprecated.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
