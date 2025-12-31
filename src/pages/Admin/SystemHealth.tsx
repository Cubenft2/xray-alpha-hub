import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  TrendingUp,
  DollarSign,
  Zap
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { APIRateLimitMonitor } from '@/components/admin/APIRateLimitMonitor';
import { CryptoPipelineHealth } from '@/components/admin/CryptoPipelineHealth';
import { LunarCrushCallBreakdown } from '@/components/admin/LunarCrushCallBreakdown';

interface QuickHealthStatus {
  name: string;
  table: string;
  status: 'healthy' | 'warning' | 'error' | 'unknown';
  lastUpdate: string | null;
  ageMinutes: number;
}

export function SystemHealth() {
  const { toast } = useToast();
  const [triggeringJob, setTriggeringJob] = useState<string | null>(null);

  // Quick health check for stocks and forex
  const { data: quickHealth, isLoading: healthLoading, refetch: refetchHealth } = useQuery({
    queryKey: ['quick-health'],
    queryFn: async () => {
      const [stockCards, forexCards, exchangeData, derivsCache, newsCache] = await Promise.all([
        supabase.from('stock_cards').select('updated_at').order('updated_at', { ascending: false }).limit(1).maybeSingle(),
        supabase.from('forex_cards').select('updated_at').order('updated_at', { ascending: false }).limit(1).maybeSingle(),
        supabase.from('exchange_ticker_data').select('updated_at').order('updated_at', { ascending: false }).limit(1).maybeSingle(),
        supabase.from('derivatives_cache').select('updated_at').order('updated_at', { ascending: false }).limit(1).maybeSingle(),
        supabase.from('news_cache').select('created_at').order('created_at', { ascending: false }).limit(1).maybeSingle(),
      ]);

      const getStatus = (timestamp: string | null, warningMins: number, errorMins: number): QuickHealthStatus['status'] => {
        if (!timestamp) return 'unknown';
        const ageMinutes = (Date.now() - new Date(timestamp).getTime()) / 60000;
        if (ageMinutes < warningMins) return 'healthy';
        if (ageMinutes < errorMins) return 'warning';
        return 'error';
      };

      const getAge = (timestamp: string | null): number => {
        if (!timestamp) return -1;
        return (Date.now() - new Date(timestamp).getTime()) / 60000;
      };

      return [
        {
          name: 'Stock Cards',
          table: 'stock_cards',
          status: getStatus(stockCards.data?.updated_at, 10, 30),
          lastUpdate: stockCards.data?.updated_at || null,
          ageMinutes: getAge(stockCards.data?.updated_at)
        },
        {
          name: 'Forex Cards',
          table: 'forex_cards',
          status: getStatus(forexCards.data?.updated_at, 5, 15),
          lastUpdate: forexCards.data?.updated_at || null,
          ageMinutes: getAge(forexCards.data?.updated_at)
        },
        {
          name: 'Exchange Data',
          table: 'exchange_ticker_data',
          status: getStatus(exchangeData.data?.updated_at, 30, 60),
          lastUpdate: exchangeData.data?.updated_at || null,
          ageMinutes: getAge(exchangeData.data?.updated_at)
        },
        {
          name: 'Derivatives Cache',
          table: 'derivatives_cache',
          status: getStatus(derivsCache.data?.updated_at, 10, 30),
          lastUpdate: derivsCache.data?.updated_at || null,
          ageMinutes: getAge(derivsCache.data?.updated_at)
        },
        {
          name: 'News Cache',
          table: 'news_cache',
          status: getStatus(newsCache.data?.created_at, 60, 120),
          lastUpdate: newsCache.data?.created_at || null,
          ageMinutes: getAge(newsCache.data?.created_at)
        },
      ] as QuickHealthStatus[];
    },
    refetchInterval: 60000
  });

  const triggerFunction = async (functionName: string, displayName: string) => {
    try {
      setTriggeringJob(functionName);
      toast({ title: `Triggering ${displayName}...`, description: 'Please wait...' });
      
      const { data, error } = await supabase.functions.invoke(functionName);
      
      if (error) throw error;
      
      toast({
        title: `${displayName} Complete`,
        description: data?.message || 'Operation completed successfully',
      });
      
      refetchHealth();
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : `Failed to trigger ${displayName}`,
        variant: 'destructive',
      });
    } finally {
      setTriggeringJob(null);
    }
  };

  const getStatusIcon = (status: QuickHealthStatus['status']) => {
    switch (status) {
      case 'healthy': return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'warning': return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      case 'error': return <XCircle className="h-4 w-4 text-red-500" />;
      default: return <AlertCircle className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: QuickHealthStatus['status']) => {
    switch (status) {
      case 'healthy': return <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20">Healthy</Badge>;
      case 'warning': return <Badge variant="outline" className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20">Warning</Badge>;
      case 'error': return <Badge variant="outline" className="bg-red-500/10 text-red-500 border-red-500/20">Error</Badge>;
      default: return <Badge variant="outline">Unknown</Badge>;
    }
  };

  const overallHealth = quickHealth?.length 
    ? quickHealth.some(h => h.status === 'error')
      ? 'error'
      : quickHealth.some(h => h.status === 'warning')
        ? 'warning'
        : 'healthy'
    : 'unknown';

  return (
    <div className="space-y-6">
      {/* API Rate Limit Monitor */}
      <APIRateLimitMonitor />

      {/* LunarCrush Call Breakdown */}
      <LunarCrushCallBreakdown />
      {/* Pipeline Health - Tabbed View */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Pipeline Health Monitor
              </CardTitle>
              <CardDescription>
                Data source status, coverage stats, and pipeline issues
              </CardDescription>
            </div>
            {getStatusBadge(overallHealth)}
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="crypto" className="w-full">
            <TabsList className="mb-4">
              <TabsTrigger value="crypto" className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Crypto
              </TabsTrigger>
              <TabsTrigger value="stocks" className="flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Stocks & Forex
              </TabsTrigger>
              <TabsTrigger value="other" className="flex items-center gap-2">
                <Database className="h-4 w-4" />
                Other Data
              </TabsTrigger>
            </TabsList>

            <TabsContent value="crypto">
              <CryptoPipelineHealth />
            </TabsContent>

            <TabsContent value="stocks">
              <div className="space-y-4">
                {/* Stocks & Forex Quick Status */}
                <div className="grid gap-3">
                  {quickHealth?.filter(h => ['Stock Cards', 'Forex Cards'].includes(h.name)).map((item) => (
                    <div
                      key={item.name}
                      className="flex items-center justify-between p-3 rounded-lg border bg-card"
                    >
                      <div className="flex items-center gap-3">
                        {getStatusIcon(item.status)}
                        <div>
                          <p className="font-medium">{item.name}</p>
                          {item.lastUpdate && (
                            <p className="text-xs text-muted-foreground">
                              Updated {formatDistanceToNow(new Date(item.lastUpdate), { addSuffix: true })}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">
                          {item.ageMinutes >= 0 ? `${Math.round(item.ageMinutes)} min old` : 'No data'}
                        </span>
                        {getStatusBadge(item.status)}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Manual Triggers for Stocks/Forex */}
                <Separator className="my-4" />
                <div className="grid grid-cols-2 gap-3">
                  <Button 
                    onClick={() => triggerFunction('polygon-stock-snapshot', 'Stock Snapshot')} 
                    variant="outline"
                    disabled={triggeringJob === 'polygon-stock-snapshot'}
                  >
                    {triggeringJob === 'polygon-stock-snapshot' ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Zap className="mr-2 h-4 w-4" />
                    )}
                    Sync Stock Cards
                  </Button>
                  <Button 
                    onClick={() => triggerFunction('sync-forex-cards-polygon', 'Forex Cards')} 
                    variant="outline"
                    disabled={triggeringJob === 'sync-forex-cards-polygon'}
                  >
                    {triggeringJob === 'sync-forex-cards-polygon' ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Zap className="mr-2 h-4 w-4" />
                    )}
                    Sync Forex Cards
                  </Button>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="other">
              <div className="space-y-4">
                {/* Other Data Sources */}
                <div className="grid gap-3">
                  {quickHealth?.filter(h => ['Exchange Data', 'Derivatives Cache', 'News Cache'].includes(h.name)).map((item) => (
                    <div
                      key={item.name}
                      className="flex items-center justify-between p-3 rounded-lg border bg-card"
                    >
                      <div className="flex items-center gap-3">
                        {getStatusIcon(item.status)}
                        <div>
                          <p className="font-medium">{item.name}</p>
                          {item.lastUpdate && (
                            <p className="text-xs text-muted-foreground">
                              Updated {formatDistanceToNow(new Date(item.lastUpdate), { addSuffix: true })}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">
                          {item.ageMinutes >= 0 ? `${Math.round(item.ageMinutes)} min old` : 'No data'}
                        </span>
                        {getStatusBadge(item.status)}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Manual Triggers for Other Data */}
                <Separator className="my-4" />
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <Button 
                    onClick={() => triggerFunction('exchange-data-aggregator', 'Exchange Aggregator')} 
                    variant="outline"
                    disabled={triggeringJob === 'exchange-data-aggregator'}
                  >
                    {triggeringJob === 'exchange-data-aggregator' ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Zap className="mr-2 h-4 w-4" />
                    )}
                    Exchange Data
                  </Button>
                  <Button 
                    onClick={() => triggerFunction('warm-derivs-cache', 'Derivatives Cache')} 
                    variant="outline"
                    disabled={triggeringJob === 'warm-derivs-cache'}
                  >
                    {triggeringJob === 'warm-derivs-cache' ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Zap className="mr-2 h-4 w-4" />
                    )}
                    Derivatives Cache
                  </Button>
                  <Button 
                    onClick={() => triggerFunction('warm-news-cache', 'News Cache')} 
                    variant="outline"
                    disabled={triggeringJob === 'warm-news-cache'}
                  >
                    {triggeringJob === 'warm-news-cache' ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Zap className="mr-2 h-4 w-4" />
                    )}
                    News Cache
                  </Button>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
