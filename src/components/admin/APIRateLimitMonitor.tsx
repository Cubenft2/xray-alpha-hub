import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { Loader2, RefreshCw, Gauge, AlertTriangle, Clock } from 'lucide-react';
import { format, startOfDay, differenceInHours, differenceInMinutes } from 'date-fns';

interface APILimit {
  api_name: string;
  daily_limit: number;
  warning_threshold: number;
  critical_threshold: number;
  description: string;
  reset_hour: number;
}

interface APIUsage {
  api_name: string;
  call_count: number;
}

export function APIRateLimitMonitor() {
  const { data: limits, isLoading: limitsLoading } = useQuery({
    queryKey: ['api-rate-limits'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('api_rate_limits')
        .select('*')
        .order('api_name');
      if (error) throw error;
      return data as APILimit[];
    },
    refetchInterval: 60000,
  });

  const { data: usage, isLoading: usageLoading, refetch } = useQuery({
    queryKey: ['api-usage-today'],
    queryFn: async () => {
      // Get today's start (UTC midnight)
      const todayStart = startOfDay(new Date()).toISOString();
      
      const { data, error } = await supabase
        .from('external_api_calls')
        .select('api_name, call_count')
        .gte('created_at', todayStart);
      
      if (error) throw error;
      
      // Aggregate by api_name
      const aggregated: Record<string, number> = {};
      for (const row of data || []) {
        aggregated[row.api_name] = (aggregated[row.api_name] || 0) + (row.call_count || 1);
      }
      
      return Object.entries(aggregated).map(([api_name, call_count]) => ({
        api_name,
        call_count,
      })) as APIUsage[];
    },
    refetchInterval: 30000,
  });

  const isLoading = limitsLoading || usageLoading;

  const getUsageForApi = (apiName: string): number => {
    return usage?.find(u => u.api_name === apiName)?.call_count || 0;
  };

  const getUsagePercent = (apiName: string, limit: number): number => {
    const used = getUsageForApi(apiName);
    return Math.min((used / limit) * 100, 100);
  };

  const getStatusColor = (percent: number, warning: number, critical: number): string => {
    if (percent >= critical * 100) return 'bg-red-500';
    if (percent >= warning * 100) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const getStatusBadge = (percent: number, warning: number, critical: number) => {
    if (percent >= critical * 100) {
      return <Badge variant="outline" className="bg-red-500/10 text-red-500 border-red-500/20"><AlertTriangle className="h-3 w-3 mr-1" />Critical</Badge>;
    }
    if (percent >= warning * 100) {
      return <Badge variant="outline" className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20"><AlertTriangle className="h-3 w-3 mr-1" />Warning</Badge>;
    }
    return <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20">OK</Badge>;
  };

  const getTimeUntilReset = (): string => {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    tomorrow.setUTCHours(0, 0, 0, 0);
    
    const hours = differenceInHours(tomorrow, now);
    const minutes = differenceInMinutes(tomorrow, now) % 60;
    
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const overallStatus = limits?.some(l => {
    const percent = getUsagePercent(l.api_name, l.daily_limit);
    return percent >= l.critical_threshold * 100;
  }) ? 'critical' : limits?.some(l => {
    const percent = getUsagePercent(l.api_name, l.daily_limit);
    return percent >= l.warning_threshold * 100;
  }) ? 'warning' : 'healthy';

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Gauge className="h-5 w-5" />
              API Rate Limits
            </CardTitle>
            <CardDescription>
              Daily API usage tracking • Resets in {getTimeUntilReset()}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {overallStatus === 'critical' && (
              <Badge variant="outline" className="bg-red-500/10 text-red-500 border-red-500/20">
                <AlertTriangle className="h-3 w-3 mr-1" />Critical
              </Badge>
            )}
            {overallStatus === 'warning' && (
              <Badge variant="outline" className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20">
                <AlertTriangle className="h-3 w-3 mr-1" />Warning
              </Badge>
            )}
            {overallStatus === 'healthy' && (
              <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20">
                OK
              </Badge>
            )}
            <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isLoading}>
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">
            {limits?.map((limit) => {
              const used = getUsageForApi(limit.api_name);
              const percent = getUsagePercent(limit.api_name, limit.daily_limit);
              const statusColor = getStatusColor(percent, limit.warning_threshold, limit.critical_threshold);
              
              return (
                <div key={limit.api_name} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-medium capitalize">{limit.api_name}</span>
                      <span className="text-xs text-muted-foreground ml-2">{limit.description}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-mono">
                        {used.toLocaleString()} / {limit.daily_limit.toLocaleString()}
                      </span>
                      {getStatusBadge(percent, limit.warning_threshold, limit.critical_threshold)}
                    </div>
                  </div>
                  <div className="relative">
                    <Progress value={percent} className="h-2" />
                    <div 
                      className={`absolute top-0 left-0 h-2 rounded-full transition-all ${statusColor}`}
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{Math.round(percent)}% used</span>
                    <span>{(limit.daily_limit - used).toLocaleString()} remaining</span>
                  </div>
                </div>
              );
            })}
            
            {(!limits || limits.length === 0) && (
              <div className="text-center py-4 text-muted-foreground">
                No API limits configured
              </div>
            )}
            
            <div className="pt-2 border-t text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Daily limits reset at midnight UTC
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}