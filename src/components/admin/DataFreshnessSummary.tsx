import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQuery } from '@tanstack/react-query';
import { Loader2, RefreshCw, CheckCircle2, AlertCircle, XCircle, Database, Zap } from 'lucide-react';

interface DataSource {
  name: string;
  table: string;
  syncFunction: string;
  thresholds: { fresh: number; stale: number }; // minutes
}

const DATA_SOURCES: DataSource[] = [
  { name: 'Crypto (All)', table: 'token_cards', syncFunction: 'sync-token-cards-lunarcrush', thresholds: { fresh: 10, stale: 60 } },
  { name: 'Crypto (Polygon)', table: 'token_cards', syncFunction: 'sync-token-cards-polygon', thresholds: { fresh: 5, stale: 30 } },
  { name: 'Stocks', table: 'stock_snapshot', syncFunction: 'polygon-stock-snapshot', thresholds: { fresh: 10, stale: 60 } },
  { name: 'Forex', table: 'forex_cards', syncFunction: 'sync-forex-cards-polygon', thresholds: { fresh: 5, stale: 30 } },
];

export function DataFreshnessSummary() {
  const { toast } = useToast();
  const [triggeringSync, setTriggeringSync] = useState<string | null>(null);

  const { data: freshnessData, isLoading, refetch } = useQuery({
    queryKey: ['data-freshness-summary'],
    queryFn: async () => {
      const results = await Promise.all([
        // Crypto (All) - token_cards total
        supabase.from('token_cards').select('updated_at', { count: 'exact', head: false })
          .order('updated_at', { ascending: false }).limit(1),
        // Crypto (Polygon) - token_cards where polygon_supported = true
        supabase.from('token_cards').select('updated_at', { count: 'exact', head: false })
          .eq('polygon_supported', true).order('updated_at', { ascending: false }).limit(1),
        // Stocks - stock_snapshot
        supabase.from('stock_snapshot').select('updated_at', { count: 'exact', head: false })
          .order('updated_at', { ascending: false }).limit(1),
        // Forex - forex_cards
        supabase.from('forex_cards').select('updated_at', { count: 'exact', head: false })
          .order('updated_at', { ascending: false }).limit(1),
      ]);

      return results.map((result, index) => {
        const count = result.count || 0;
        const latestUpdate = result.data?.[0]?.updated_at;
        const ageMinutes = latestUpdate 
          ? (Date.now() - new Date(latestUpdate).getTime()) / 60000 
          : Infinity;
        
        const source = DATA_SOURCES[index];
        let status: 'fresh' | 'stale' | 'critical' = 'critical';
        if (ageMinutes < source.thresholds.fresh) status = 'fresh';
        else if (ageMinutes < source.thresholds.stale) status = 'stale';

        return {
          ...source,
          count,
          latestUpdate,
          ageMinutes,
          status,
        };
      });
    },
    refetchInterval: 30000, // Auto-refresh every 30 seconds
  });

  const formatFreshness = (ageMinutes: number): string => {
    if (!isFinite(ageMinutes)) return 'No data';
    if (ageMinutes < 1) return '<1 min';
    if (ageMinutes < 60) return `~${Math.round(ageMinutes)} min`;
    const hours = ageMinutes / 60;
    if (hours < 24) return `~${Math.round(hours)} hr`;
    return `~${Math.round(hours / 24)} days`;
  };

  const getStatusBadge = (status: 'fresh' | 'stale' | 'critical') => {
    switch (status) {
      case 'fresh':
        return <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20"><CheckCircle2 className="h-3 w-3 mr-1" />Fresh</Badge>;
      case 'stale':
        return <Badge variant="outline" className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20"><AlertCircle className="h-3 w-3 mr-1" />Stale</Badge>;
      case 'critical':
        return <Badge variant="outline" className="bg-red-500/10 text-red-500 border-red-500/20"><XCircle className="h-3 w-3 mr-1" />Critical</Badge>;
    }
  };

  const triggerSync = async (syncFunction: string, displayName: string) => {
    try {
      setTriggeringSync(syncFunction);
      toast({ title: `Triggering ${displayName}...`, description: 'Please wait...' });
      
      const { data, error } = await supabase.functions.invoke(syncFunction);
      
      if (error) throw error;
      
      toast({
        title: `${displayName} Complete`,
        description: data?.message || `Synced successfully`,
      });
      
      refetch();
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : `Failed to trigger ${displayName}`,
        variant: 'destructive',
      });
    } finally {
      setTriggeringSync(null);
    }
  };

  const overallStatus = freshnessData?.some(d => d.status === 'critical')
    ? 'critical'
    : freshnessData?.some(d => d.status === 'stale')
      ? 'stale'
      : 'fresh';

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Data Freshness Summary
            </CardTitle>
            <CardDescription>
              Overview of data sources with counts, freshness, and manual triggers
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {getStatusBadge(overallStatus)}
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
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data Type</TableHead>
                <TableHead>Table</TableHead>
                <TableHead className="text-right">Count</TableHead>
                <TableHead className="text-right">Freshness</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead className="text-right">Trigger</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {freshnessData?.map((source) => (
                <TableRow key={source.name}>
                  <TableCell className="font-medium">{source.name}</TableCell>
                  <TableCell>
                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{source.table}</code>
                  </TableCell>
                  <TableCell className="text-right font-mono">{source.count.toLocaleString()}</TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {formatFreshness(source.ageMinutes)}
                  </TableCell>
                  <TableCell className="text-center">{getStatusBadge(source.status)}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => triggerSync(source.syncFunction, source.name)}
                      disabled={triggeringSync === source.syncFunction}
                    >
                      {triggeringSync === source.syncFunction ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Zap className="h-3 w-3" />
                      )}
                      <span className="ml-1">Sync</span>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
