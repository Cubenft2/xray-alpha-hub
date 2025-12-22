import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQuery } from '@tanstack/react-query';
import { 
  Loader2, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  XCircle,
  Database,
  Activity,
  TrendingUp,
  MessageSquare,
  Image,
  Zap
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface DataSourceStatus {
  name: string;
  icon: React.ReactNode;
  status: 'healthy' | 'warning' | 'error' | 'unknown';
  lastUpdate: string | null;
  tokenCount: number;
  edgeFunction: string;
  details: string;
}

interface CoverageStats {
  total: number;
  withPrice: number;
  withPolygonPrice: number;
  withLunarcrushPrice: number;
  withCoingeckoPrice: number;
  withGalaxyScore: number;
  withTopPosts: number;
  withAISummary: number;
  withTechnicals: number;
  withLogo: number;
  withMarketCap: number;
  withContracts: number;
}

interface PipelineIssue {
  severity: 'error' | 'warning' | 'info';
  title: string;
  description: string;
  action?: {
    label: string;
    functionName: string;
  };
}

export function CryptoPipelineHealth() {
  const { toast } = useToast();
  const [triggeringFunction, setTriggeringFunction] = useState<string | null>(null);

  // Fetch comprehensive pipeline data
  const { data: pipelineData, isLoading, refetch } = useQuery({
    queryKey: ['crypto-pipeline-health'],
    queryFn: async () => {
      // Get total counts and freshness data
      const [
        totalResult,
        priceResult,
        polygonResult,
        lunarcrushResult,
        coingeckoResult,
        galaxyScoreResult,
        topPostsResult,
        aiSummaryResult,
        technicalsResult,
        logoResult,
        marketCapResult,
        contractsResult,
        freshPolygonResult,
        freshLunarcrushResult,
        freshCoingeckoResult
      ] = await Promise.all([
        // Total active tokens
        supabase.from('token_cards').select('*', { count: 'exact', head: true }).eq('is_active', true),
        // Tokens with any price
        supabase.from('token_cards').select('*', { count: 'exact', head: true }).eq('is_active', true).not('price_usd', 'is', null),
        // Polygon-supported tokens
        supabase.from('token_cards').select('*', { count: 'exact', head: true }).eq('is_active', true).eq('polygon_supported', true),
        // LunarCrush tokens (have lunarcrush_id)
        supabase.from('token_cards').select('*', { count: 'exact', head: true }).eq('is_active', true).not('lunarcrush_id', 'is', null),
        // CoinGecko tokens
        supabase.from('token_cards').select('*', { count: 'exact', head: true }).eq('is_active', true).not('coingecko_id', 'is', null),
        // Galaxy score
        supabase.from('token_cards').select('*', { count: 'exact', head: true }).eq('is_active', true).not('galaxy_score', 'is', null),
        // Top posts
        supabase.from('token_cards').select('*', { count: 'exact', head: true }).eq('is_active', true).not('top_posts', 'is', null),
        // AI summary
        supabase.from('token_cards').select('*', { count: 'exact', head: true }).eq('is_active', true).not('ai_summary', 'is', null),
        // Technicals (RSI)
        supabase.from('token_cards').select('*', { count: 'exact', head: true }).eq('is_active', true).not('rsi_14', 'is', null),
        // Logo
        supabase.from('token_cards').select('*', { count: 'exact', head: true }).eq('is_active', true).not('logo_url', 'is', null),
        // Market cap
        supabase.from('token_cards').select('*', { count: 'exact', head: true }).eq('is_active', true).not('market_cap', 'is', null),
        // Contracts
        supabase.from('token_cards').select('*', { count: 'exact', head: true }).eq('is_active', true).not('contracts', 'is', null),
        // Fresh Polygon data (last 5 min)
        supabase.from('token_cards').select('polygon_price_updated_at').eq('polygon_supported', true).order('polygon_price_updated_at', { ascending: false }).limit(1).maybeSingle(),
        // Fresh LunarCrush data
        supabase.from('token_cards').select('lunarcrush_price_updated_at').not('lunarcrush_id', 'is', null).order('lunarcrush_price_updated_at', { ascending: false }).limit(1).maybeSingle(),
        // Fresh CoinGecko data
        supabase.from('token_cards').select('coingecko_price_updated_at').not('coingecko_id', 'is', null).order('coingecko_price_updated_at', { ascending: false }).limit(1).maybeSingle(),
      ]);

      const coverage: CoverageStats = {
        total: totalResult.count || 0,
        withPrice: priceResult.count || 0,
        withPolygonPrice: polygonResult.count || 0,
        withLunarcrushPrice: lunarcrushResult.count || 0,
        withCoingeckoPrice: coingeckoResult.count || 0,
        withGalaxyScore: galaxyScoreResult.count || 0,
        withTopPosts: topPostsResult.count || 0,
        withAISummary: aiSummaryResult.count || 0,
        withTechnicals: technicalsResult.count || 0,
        withLogo: logoResult.count || 0,
        withMarketCap: marketCapResult.count || 0,
        withContracts: contractsResult.count || 0,
      };

      // Calculate data source statuses
      const getAgeStatus = (timestamp: string | null): { status: 'healthy' | 'warning' | 'error' | 'unknown', ageMinutes: number } => {
        if (!timestamp) return { status: 'unknown', ageMinutes: -1 };
        const ageMinutes = (Date.now() - new Date(timestamp).getTime()) / 60000;
        if (ageMinutes < 5) return { status: 'healthy', ageMinutes };
        if (ageMinutes < 15) return { status: 'warning', ageMinutes };
        return { status: 'error', ageMinutes };
      };

      const polygonStatus = getAgeStatus(freshPolygonResult.data?.polygon_price_updated_at);
      const lunarcrushStatus = getAgeStatus(freshLunarcrushResult.data?.lunarcrush_price_updated_at);
      const coingeckoStatus = getAgeStatus(freshCoingeckoResult.data?.coingecko_price_updated_at);

      const dataSources: DataSourceStatus[] = [
        {
          name: 'Polygon.io',
          icon: <Activity className="h-5 w-5 text-purple-500" />,
          status: polygonStatus.status,
          lastUpdate: freshPolygonResult.data?.polygon_price_updated_at || null,
          tokenCount: polygonResult.count || 0,
          edgeFunction: 'sync-token-cards-polygon',
          details: `${polygonResult.count || 0} tokens with live prices & technicals`
        },
        {
          name: 'LunarCrush',
          icon: <MessageSquare className="h-5 w-5 text-blue-500" />,
          status: lunarcrushStatus.status,
          lastUpdate: freshLunarcrushResult.data?.lunarcrush_price_updated_at || null,
          tokenCount: lunarcrushResult.count || 0,
          edgeFunction: 'sync-token-cards-lunarcrush',
          details: `${lunarcrushResult.count || 0} tokens with social metrics`
        },
        {
          name: 'CoinGecko',
          icon: <TrendingUp className="h-5 w-5 text-green-500" />,
          status: coingeckoStatus.status,
          lastUpdate: freshCoingeckoResult.data?.coingecko_price_updated_at || null,
          tokenCount: coingeckoResult.count || 0,
          edgeFunction: 'sync-token-cards-coingecko',
          details: `${coingeckoResult.count || 0} tokens with market data`
        }
      ];

      // Identify pipeline issues
      const issues: PipelineIssue[] = [];

      if (coverage.withAISummary === 0) {
        issues.push({
          severity: 'warning',
          title: 'AI Summaries Not Syncing',
          description: `0/${coverage.total} tokens have AI summaries. The enhanced sync may not be scheduled.`,
          action: { label: 'Trigger Enhanced Sync', functionName: 'sync-token-cards-lunarcrush-enhanced' }
        });
      }

      if (polygonStatus.status === 'error') {
        issues.push({
          severity: 'error',
          title: 'Polygon Data Stale',
          description: `Last update was ${Math.round(polygonStatus.ageMinutes)} minutes ago. Live prices may be outdated.`,
          action: { label: 'Trigger Polygon Sync', functionName: 'sync-token-cards-polygon' }
        });
      }

      if (lunarcrushStatus.status === 'error') {
        issues.push({
          severity: 'error',
          title: 'LunarCrush Data Stale',
          description: `Last update was ${Math.round(lunarcrushStatus.ageMinutes)} minutes ago. Social metrics outdated.`,
          action: { label: 'Trigger LunarCrush Sync', functionName: 'sync-token-cards-lunarcrush' }
        });
      }

      if (coverage.withTechnicals < coverage.withPolygonPrice * 0.5) {
        issues.push({
          severity: 'warning',
          title: 'Low Technical Indicators Coverage',
          description: `Only ${coverage.withTechnicals}/${coverage.withPolygonPrice} Polygon tokens have technicals.`,
        });
      }

      return { coverage, dataSources, issues };
    },
    refetchInterval: 30000
  });

  const triggerFunction = async (functionName: string) => {
    try {
      setTriggeringFunction(functionName);
      toast({ title: `Triggering ${functionName}...`, description: 'Please wait...' });
      
      const { data, error } = await supabase.functions.invoke(functionName);
      
      if (error) throw error;
      
      toast({
        title: 'Sync Complete',
        description: data?.message || `${functionName} completed successfully`,
      });
      
      refetch();
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to trigger sync',
        variant: 'destructive',
      });
    } finally {
      setTriggeringFunction(null);
    }
  };

  const getStatusIcon = (status: 'healthy' | 'warning' | 'error' | 'unknown') => {
    switch (status) {
      case 'healthy': return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'warning': return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      case 'error': return <XCircle className="h-4 w-4 text-red-500" />;
      default: return <AlertCircle className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: 'healthy' | 'warning' | 'error' | 'unknown') => {
    switch (status) {
      case 'healthy': return <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20">Live</Badge>;
      case 'warning': return <Badge variant="outline" className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20">Delayed</Badge>;
      case 'error': return <Badge variant="outline" className="bg-red-500/10 text-red-500 border-red-500/20">Stale</Badge>;
      default: return <Badge variant="outline">Unknown</Badge>;
    }
  };

  const formatPercent = (value: number, total: number) => {
    if (total === 0) return '0%';
    return `${Math.round((value / total) * 100)}%`;
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const { coverage, dataSources, issues } = pipelineData || { coverage: null, dataSources: [], issues: [] };

  return (
    <div className="space-y-4">
      {/* Data Sources Status */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Database className="h-5 w-5" />
              Crypto Data Sources
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {dataSources.map((source) => (
            <div key={source.name} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
              <div className="flex items-center gap-3">
                {source.icon}
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{source.name}</span>
                    {getStatusBadge(source.status)}
                  </div>
                  <p className="text-sm text-muted-foreground">{source.details}</p>
                  {source.lastUpdate && (
                    <p className="text-xs text-muted-foreground">
                      Updated {formatDistanceToNow(new Date(source.lastUpdate), { addSuffix: true })}
                    </p>
                  )}
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => triggerFunction(source.edgeFunction)}
                disabled={triggeringFunction === source.edgeFunction}
              >
                {triggeringFunction === source.edgeFunction ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Zap className="h-4 w-4" />
                )}
                <span className="ml-1 hidden sm:inline">Sync</span>
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Token Cards Coverage */}
      {coverage && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <TrendingUp className="h-5 w-5" />
              Token Cards Coverage
              <Badge variant="secondary" className="ml-2">{coverage.total.toLocaleString()} tokens</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Price Data */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Price Data</span>
                <span className="font-medium">{coverage.withPrice.toLocaleString()} ({formatPercent(coverage.withPrice, coverage.total)})</span>
              </div>
              <Progress value={(coverage.withPrice / coverage.total) * 100} className="h-2" />
              <div className="flex gap-4 text-xs text-muted-foreground">
                <span>Polygon: {coverage.withPolygonPrice.toLocaleString()}</span>
                <span>LunarCrush: {coverage.withLunarcrushPrice.toLocaleString()}</span>
                <span>CoinGecko: {coverage.withCoingeckoPrice.toLocaleString()}</span>
              </div>
            </div>

            {/* Social Data */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Galaxy Score</span>
                <span className="font-medium">{coverage.withGalaxyScore.toLocaleString()} ({formatPercent(coverage.withGalaxyScore, coverage.total)})</span>
              </div>
              <Progress value={(coverage.withGalaxyScore / coverage.total) * 100} className="h-2" />
            </div>

            {/* Technical Indicators */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Technical Indicators (RSI/MACD)</span>
                <span className="font-medium">{coverage.withTechnicals.toLocaleString()} ({formatPercent(coverage.withTechnicals, coverage.total)})</span>
              </div>
              <Progress value={(coverage.withTechnicals / coverage.total) * 100} className="h-2" />
            </div>

            {/* Metadata Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
              <div className="p-2 rounded bg-muted/50 text-center">
                <Image className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                <div className="text-sm font-medium">{formatPercent(coverage.withLogo, coverage.total)}</div>
                <div className="text-xs text-muted-foreground">Logos</div>
              </div>
              <div className="p-2 rounded bg-muted/50 text-center">
                <TrendingUp className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                <div className="text-sm font-medium">{formatPercent(coverage.withMarketCap, coverage.total)}</div>
                <div className="text-xs text-muted-foreground">Market Cap</div>
              </div>
              <div className="p-2 rounded bg-muted/50 text-center">
                <MessageSquare className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                <div className="text-sm font-medium">{formatPercent(coverage.withTopPosts, coverage.total)}</div>
                <div className="text-xs text-muted-foreground">Top Posts</div>
              </div>
              <div className="p-2 rounded bg-muted/50 text-center">
                <Database className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                <div className="text-sm font-medium">{formatPercent(coverage.withContracts, coverage.total)}</div>
                <div className="text-xs text-muted-foreground">Contracts</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Pipeline Issues */}
      {issues && issues.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <AlertCircle className="h-5 w-5 text-yellow-500" />
              Pipeline Issues
              <Badge variant="outline" className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20">
                {issues.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {issues.map((issue, idx) => (
              <div 
                key={idx} 
                className={`p-3 rounded-lg border ${
                  issue.severity === 'error' 
                    ? 'border-red-500/20 bg-red-500/5' 
                    : issue.severity === 'warning'
                    ? 'border-yellow-500/20 bg-yellow-500/5'
                    : 'border-blue-500/20 bg-blue-500/5'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      {issue.severity === 'error' ? (
                        <XCircle className="h-4 w-4 text-red-500" />
                      ) : issue.severity === 'warning' ? (
                        <AlertCircle className="h-4 w-4 text-yellow-500" />
                      ) : (
                        <AlertCircle className="h-4 w-4 text-blue-500" />
                      )}
                      <span className="font-medium">{issue.title}</span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">{issue.description}</p>
                  </div>
                  {issue.action && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => triggerFunction(issue.action!.functionName)}
                      disabled={triggeringFunction === issue.action.functionName}
                    >
                      {triggeringFunction === issue.action.functionName ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        issue.action.label
                      )}
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
