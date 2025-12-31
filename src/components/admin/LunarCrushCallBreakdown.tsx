import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { Loader2, RefreshCw, ListTree, Clock } from 'lucide-react';
import { format, startOfDay, subHours } from 'date-fns';

interface FunctionCallBreakdown {
  function_name: string;
  call_count: number;
  success_count: number;
  error_count: number;
  last_call: string;
}

export function LunarCrushCallBreakdown() {
  const { data: breakdown, isLoading, refetch } = useQuery({
    queryKey: ['lunarcrush-call-breakdown'],
    queryFn: async () => {
      const todayStart = startOfDay(new Date()).toISOString();
      
      const { data, error } = await supabase
        .from('external_api_calls')
        .select('function_name, call_count, success, created_at')
        .eq('api_name', 'lunarcrush')
        .gte('created_at', todayStart)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      // Aggregate by function_name
      const aggregated: Record<string, FunctionCallBreakdown> = {};
      
      for (const row of data || []) {
        const fn = row.function_name;
        if (!aggregated[fn]) {
          aggregated[fn] = {
            function_name: fn,
            call_count: 0,
            success_count: 0,
            error_count: 0,
            last_call: row.created_at,
          };
        }
        aggregated[fn].call_count += row.call_count || 1;
        if (row.success) {
          aggregated[fn].success_count += row.call_count || 1;
        } else {
          aggregated[fn].error_count += row.call_count || 1;
        }
        // Keep the most recent call time
        if (row.created_at > aggregated[fn].last_call) {
          aggregated[fn].last_call = row.created_at;
        }
      }
      
      return Object.values(aggregated).sort((a, b) => b.call_count - a.call_count);
    },
    refetchInterval: 30000,
  });

  const { data: recentCalls } = useQuery({
    queryKey: ['lunarcrush-recent-calls'],
    queryFn: async () => {
      const oneHourAgo = subHours(new Date(), 1).toISOString();
      
      const { data, error } = await supabase
        .from('external_api_calls')
        .select('function_name, call_count, success, error_message, created_at')
        .eq('api_name', 'lunarcrush')
        .gte('created_at', oneHourAgo)
        .order('created_at', { ascending: false })
        .limit(15);
      
      if (error) throw error;
      return data;
    },
    refetchInterval: 30000,
  });

  const totalCalls = breakdown?.reduce((sum, fn) => sum + fn.call_count, 0) || 0;
  const totalErrors = breakdown?.reduce((sum, fn) => sum + fn.error_count, 0) || 0;

  const formatTime = (isoString: string) => {
    try {
      return format(new Date(isoString), 'HH:mm:ss');
    } catch {
      return '-';
    }
  };

  const getTimeSince = (isoString: string) => {
    try {
      const diff = Date.now() - new Date(isoString).getTime();
      const mins = Math.floor(diff / 60000);
      if (mins < 1) return 'just now';
      if (mins < 60) return `${mins}m ago`;
      const hrs = Math.floor(mins / 60);
      return `${hrs}h ${mins % 60}m ago`;
    } catch {
      return '-';
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ListTree className="h-5 w-5" />
              LunarCrush Calls by Function
            </CardTitle>
            <CardDescription>
              Today's breakdown • {totalCalls} total calls • {totalErrors} errors
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isLoading}>
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Function breakdown table */}
            <div className="rounded-md border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left p-2 font-medium">Function</th>
                    <th className="text-right p-2 font-medium">Calls</th>
                    <th className="text-right p-2 font-medium">Success</th>
                    <th className="text-right p-2 font-medium">Errors</th>
                    <th className="text-right p-2 font-medium">Last Call</th>
                  </tr>
                </thead>
                <tbody>
                  {breakdown?.map((fn) => (
                    <tr key={fn.function_name} className="border-t">
                      <td className="p-2 font-mono text-xs">{fn.function_name}</td>
                      <td className="p-2 text-right font-medium">{fn.call_count}</td>
                      <td className="p-2 text-right text-green-500">{fn.success_count}</td>
                      <td className="p-2 text-right text-red-500">{fn.error_count > 0 ? fn.error_count : '-'}</td>
                      <td className="p-2 text-right text-muted-foreground text-xs">{getTimeSince(fn.last_call)}</td>
                    </tr>
                  ))}
                  {(!breakdown || breakdown.length === 0) && (
                    <tr>
                      <td colSpan={5} className="p-4 text-center text-muted-foreground">
                        No LunarCrush calls today
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Recent calls log */}
            <div>
              <h4 className="text-sm font-medium mb-2 flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Recent Activity (Last Hour)
              </h4>
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {recentCalls?.map((call, idx) => (
                  <div 
                    key={idx} 
                    className="flex items-center justify-between text-xs py-1 px-2 rounded bg-muted/30"
                  >
                    <span className="font-mono truncate flex-1">{call.function_name}</span>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-muted-foreground">{formatTime(call.created_at)}</span>
                      {call.success ? (
                        <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20 text-[10px] px-1">
                          OK
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-red-500/10 text-red-500 border-red-500/20 text-[10px] px-1" title={call.error_message || ''}>
                          ERR
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
                {(!recentCalls || recentCalls.length === 0) && (
                  <div className="text-center text-muted-foreground text-xs py-2">
                    No calls in the last hour
                  </div>
                )}
              </div>
            </div>

            {/* Expected calls reference */}
            <div className="pt-2 border-t text-xs text-muted-foreground space-y-1">
              <div className="font-medium">Expected calls per run:</div>
              <div className="grid grid-cols-2 gap-x-4">
                <span>• tier1: 1 call</span>
                <span>• tier2: 1 call</span>
                <span>• full-sync: 3 calls</span>
                <span>• enhanced: 8 calls (2×4 endpoints)</span>
                <span>• news: 6 calls (4 tokens + 2 topics)</span>
                <span>• coin-detail: 1 call (on-demand)</span>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
