import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RefreshCw, DollarSign, MessageSquare, Clock, TrendingUp, Zap, AlertTriangle, Database } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/hooks/use-toast';

interface UsageStats {
  totalRequests: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCostUSD: number;
  avgLatencyMs: number;
  fallbackRate: number;
  providerBreakdown: { provider: string; count: number; cost: number }[];
  topAssets: { asset: string; count: number }[];
  recentLogs: {
    id: string;
    created_at: string;
    provider: string;
    model: string;
    input_tokens: number;
    output_tokens: number;
    estimated_cost_millicents: number;
    latency_ms: number;
    assets_queried: string[];
    fallback_used: boolean;
  }[];
}

export function ZombieDogAnalytics() {
  const [stats, setStats] = useState<UsageStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<'today' | '7days' | '30days'>('today');

  const fetchStats = async () => {
    setLoading(true);
    try {
      const now = new Date();
      let startDate: Date;
      
      switch (dateRange) {
        case 'today':
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          break;
        case '7days':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case '30days':
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
      }

      // Fetch usage logs
      const { data: logs, error } = await supabase
        .from('ai_usage_logs')
        .select('*')
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: false })
        .limit(500);

      if (error) throw error;

      if (!logs || logs.length === 0) {
        setStats({
          totalRequests: 0,
          totalInputTokens: 0,
          totalOutputTokens: 0,
          totalCostUSD: 0,
          avgLatencyMs: 0,
          fallbackRate: 0,
          providerBreakdown: [],
          topAssets: [],
          recentLogs: [],
        });
        return;
      }

      // Calculate aggregations
      const totalRequests = logs.length;
      const totalInputTokens = logs.reduce((sum, l) => sum + (l.input_tokens || 0), 0);
      const totalOutputTokens = logs.reduce((sum, l) => sum + (l.output_tokens || 0), 0);
      const totalCostMillicents = logs.reduce((sum, l) => sum + (l.estimated_cost_millicents || 0), 0);
      const totalCostUSD = totalCostMillicents / 100000;
      
      const latencies = logs.filter(l => l.latency_ms).map(l => l.latency_ms);
      const avgLatencyMs = latencies.length > 0 
        ? latencies.reduce((a, b) => a + b, 0) / latencies.length 
        : 0;
      
      const fallbackCount = logs.filter(l => l.fallback_used).length;
      const fallbackRate = totalRequests > 0 ? (fallbackCount / totalRequests) * 100 : 0;

      // Provider breakdown
      const providerMap = new Map<string, { count: number; cost: number }>();
      logs.forEach(l => {
        const existing = providerMap.get(l.provider) || { count: 0, cost: 0 };
        existing.count++;
        existing.cost += (l.estimated_cost_millicents || 0) / 100000;
        providerMap.set(l.provider, existing);
      });
      const providerBreakdown = Array.from(providerMap.entries()).map(([provider, data]) => ({
        provider,
        ...data
      })).sort((a, b) => b.count - a.count);

      // Top assets
      const assetCounts = new Map<string, number>();
      logs.forEach(l => {
        if (l.assets_queried) {
          l.assets_queried.forEach((asset: string) => {
            assetCounts.set(asset, (assetCounts.get(asset) || 0) + 1);
          });
        }
      });
      const topAssets = Array.from(assetCounts.entries())
        .map(([asset, count]) => ({ asset, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      setStats({
        totalRequests,
        totalInputTokens,
        totalOutputTokens,
        totalCostUSD,
        avgLatencyMs,
        fallbackRate,
        providerBreakdown,
        topAssets,
        recentLogs: logs.slice(0, 20),
      });
    } catch (err) {
      console.error('Failed to fetch usage stats:', err);
      toast({
        title: 'Error',
        description: 'Failed to load AI usage analytics',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, [dateRange]);

  const formatCost = (cost: number) => {
    if (cost < 0.01) return `$${(cost * 100).toFixed(3)}¢`;
    return `$${cost.toFixed(4)}`;
  };

  const formatTokens = (tokens: number) => {
    if (tokens >= 1000000) return `${(tokens / 1000000).toFixed(2)}M`;
    if (tokens >= 1000) return `${(tokens / 1000).toFixed(1)}K`;
    return tokens.toString();
  };

  const getProviderColor = (provider: string) => {
    switch (provider) {
      case 'lovable': return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'openai': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'anthropic': return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            🧟🐕 ZombieDog AI Analytics
          </h2>
          <p className="text-muted-foreground">Track token usage, costs, and provider performance</p>
        </div>
        
        <div className="flex items-center gap-2">
          <div className="flex gap-1 bg-muted rounded-lg p-1">
            {(['today', '7days', '30days'] as const).map(range => (
              <Button
                key={range}
                variant={dateRange === range ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setDateRange(range)}
              >
                {range === 'today' ? 'Today' : range === '7days' ? '7 Days' : '30 Days'}
              </Button>
            ))}
          </div>
          <Button variant="outline" size="sm" onClick={fetchStats} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-20" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : stats ? (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-primary" />
                  Total Cost
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCost(stats.totalCostUSD)}</div>
                <p className="text-xs text-muted-foreground">
                  {stats.totalInputTokens + stats.totalOutputTokens > 0 
                    ? `${formatCost(stats.totalCostUSD / (stats.totalInputTokens + stats.totalOutputTokens) * 1000)}/1K tokens avg`
                    : 'No data'}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-primary" />
                  Requests
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.totalRequests.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">
                  {formatTokens(stats.totalInputTokens)} in / {formatTokens(stats.totalOutputTokens)} out
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Clock className="h-4 w-4 text-primary" />
                  Avg Latency
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{Math.round(stats.avgLatencyMs).toLocaleString()}ms</div>
                <p className="text-xs text-muted-foreground">
                  {stats.avgLatencyMs < 2000 ? '✅ Fast' : stats.avgLatencyMs < 5000 ? '⚡ Normal' : '🐢 Slow'}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-primary" />
                  Fallback Rate
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.fallbackRate.toFixed(1)}%</div>
                <p className="text-xs text-muted-foreground">
                  {stats.fallbackRate < 5 ? '✅ Primary provider healthy' : '⚠️ Check primary provider'}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Provider Breakdown & Top Assets */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Zap className="h-5 w-5" />
                  Provider Usage
                </CardTitle>
                <CardDescription>Requests and cost by AI provider</CardDescription>
              </CardHeader>
              <CardContent>
                {stats.providerBreakdown.length > 0 ? (
                  <div className="space-y-3">
                    {stats.providerBreakdown.map(p => (
                      <div key={p.provider} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className={getProviderColor(p.provider)}>
                            {p.provider}
                          </Badge>
                          <span className="text-sm text-muted-foreground">
                            {p.count} requests
                          </span>
                        </div>
                        <div className="text-sm font-medium">{formatCost(p.cost)}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-sm">No provider data yet</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Top Queried Assets
                </CardTitle>
                <CardDescription>Most asked-about assets</CardDescription>
              </CardHeader>
              <CardContent>
                {stats.topAssets.length > 0 ? (
                  <div className="grid grid-cols-2 gap-2">
                    {stats.topAssets.map((a, i) => (
                      <div key={a.asset} className="flex items-center justify-between text-sm">
                        <span className="font-medium">
                          {i + 1}. {a.asset}
                        </span>
                        <span className="text-muted-foreground">{a.count}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-sm">No asset data yet</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Recent Logs Table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Database className="h-5 w-5" />
                Recent Requests
              </CardTitle>
              <CardDescription>Latest ZombieDog AI interactions</CardDescription>
            </CardHeader>
            <CardContent>
              {stats.recentLogs.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left">
                        <th className="pb-2 font-medium">Time</th>
                        <th className="pb-2 font-medium">Provider</th>
                        <th className="pb-2 font-medium">Tokens</th>
                        <th className="pb-2 font-medium">Cost</th>
                        <th className="pb-2 font-medium">Latency</th>
                        <th className="pb-2 font-medium">Assets</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.recentLogs.map(log => (
                        <tr key={log.id} className="border-b border-border/50">
                          <td className="py-2 text-muted-foreground">
                            {new Date(log.created_at).toLocaleTimeString()}
                          </td>
                          <td className="py-2">
                            <Badge variant="outline" className={`${getProviderColor(log.provider)} text-xs`}>
                              {log.provider}
                              {log.fallback_used && ' (fallback)'}
                            </Badge>
                          </td>
                          <td className="py-2">
                            {formatTokens(log.input_tokens)} / {formatTokens(log.output_tokens)}
                          </td>
                          <td className="py-2">
                            {formatCost(log.estimated_cost_millicents / 100000)}
                          </td>
                          <td className="py-2">{log.latency_ms ? `${log.latency_ms}ms` : '-'}</td>
                          <td className="py-2 max-w-[150px] truncate">
                            {log.assets_queried?.join(', ') || '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">No requests logged yet. Start chatting with ZombieDog!</p>
              )}
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}
