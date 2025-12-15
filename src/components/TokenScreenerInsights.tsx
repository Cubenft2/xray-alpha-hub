import { TrendingUp, TrendingDown, DollarSign, Activity, Star, BarChart3, Coins } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface TokenScreenerInsightsProps {
  isLoading?: boolean;
}

interface InsightsData {
  totalMarketCap: number;
  totalVolume: number;
  avgGalaxyScore: number;
  avgSentiment: number;
  totalTokens: number;
}

interface TopMover {
  canonical_symbol: string;
  name: string | null;
  logo_url: string | null;
  change_24h_pct: number | null;
}

function useTokenInsights() {
  return useQuery({
    queryKey: ['token-insights'],
    queryFn: async (): Promise<InsightsData> => {
      const { data, error } = await supabase
        .from('token_cards')
        .select('market_cap, volume_24h_usd, galaxy_score, sentiment')
        .not('market_cap', 'is', null);

      if (error) throw error;

      const totalMarketCap = data?.reduce((sum, t) => sum + (t.market_cap || 0), 0) || 0;
      const totalVolume = data?.reduce((sum, t) => sum + (t.volume_24h_usd || 0), 0) || 0;
      
      const galaxyScores = data?.filter(t => t.galaxy_score).map(t => t.galaxy_score!) || [];
      const avgGalaxyScore = galaxyScores.length ? galaxyScores.reduce((a, b) => a + b, 0) / galaxyScores.length : 0;
      
      const sentiments = data?.filter(t => t.sentiment).map(t => t.sentiment!) || [];
      const avgSentiment = sentiments.length ? sentiments.reduce((a, b) => a + b, 0) / sentiments.length : 0;

      return {
        totalMarketCap,
        totalVolume,
        avgGalaxyScore,
        avgSentiment,
        totalTokens: data?.length || 0,
      };
    },
    staleTime: 60000,
  });
}

function useTopGainers(limit = 5) {
  return useQuery({
    queryKey: ['token-top-gainers', limit],
    queryFn: async (): Promise<TopMover[]> => {
      // Only show tokens updated in last 30 minutes to avoid stale data
      const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
      
      const { data, error } = await supabase
        .from('token_cards')
        .select('canonical_symbol, name, logo_url, change_24h_pct')
        .not('change_24h_pct', 'is', null)
        .gt('change_24h_pct', 0)
        .gte('updated_at', thirtyMinutesAgo)
        .order('change_24h_pct', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data || [];
    },
    staleTime: 30000,
  });
}

function useTopLosers(limit = 5) {
  return useQuery({
    queryKey: ['token-top-losers', limit],
    queryFn: async (): Promise<TopMover[]> => {
      // Only show tokens updated in last 30 minutes to avoid stale data
      const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
      
      const { data, error } = await supabase
        .from('token_cards')
        .select('canonical_symbol, name, logo_url, change_24h_pct')
        .not('change_24h_pct', 'is', null)
        .lt('change_24h_pct', 0)
        .gte('updated_at', thirtyMinutesAgo)
        .order('change_24h_pct', { ascending: true })
        .limit(limit);

      if (error) throw error;
      return data || [];
    },
    staleTime: 30000,
  });
}

export function TokenScreenerInsights({ isLoading: parentLoading }: TokenScreenerInsightsProps) {
  const { data: insights, isLoading: insightsLoading } = useTokenInsights();
  const { data: topGainers = [], isLoading: gainersLoading } = useTopGainers(5);
  const { data: topLosers = [], isLoading: losersLoading } = useTopLosers(5);

  const isLoading = parentLoading || insightsLoading;

  const formatCurrency = (value: number) => {
    if (value >= 1e12) return `$${(value / 1e12).toFixed(2)}T`;
    if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
    if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
    return `$${value.toFixed(2)}`;
  };

  const getSentimentLabel = (score: number) => {
    if (score >= 60) return { label: 'Bullish', color: 'text-green-500' };
    if (score >= 40) return { label: 'Neutral', color: 'text-yellow-500' };
    return { label: 'Bearish', color: 'text-red-500' };
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="pt-4">
              <Skeleton className="h-4 w-20 mb-2" />
              <Skeleton className="h-8 w-24" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const sentimentInfo = insights?.avgSentiment 
    ? getSentimentLabel(insights.avgSentiment)
    : { label: '—', color: 'text-muted-foreground' };

  return (
    <div className="space-y-4">
      {/* Global Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-3 px-4">
            <CardTitle className="text-xs font-medium text-muted-foreground">Total Market Cap</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="pb-3 px-4">
            <div className="text-xl font-bold">
              {insights ? formatCurrency(insights.totalMarketCap) : '—'}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-3 px-4">
            <CardTitle className="text-xs font-medium text-muted-foreground">24h Volume</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="pb-3 px-4">
            <div className="text-xl font-bold">
              {insights ? formatCurrency(insights.totalVolume) : '—'}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-3 px-4">
            <CardTitle className="text-xs font-medium text-muted-foreground">Avg Galaxy Score</CardTitle>
            <Star className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent className="pb-3 px-4">
            <div className="text-xl font-bold">
              {insights?.avgGalaxyScore?.toFixed(1) || '—'}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-3 px-4">
            <CardTitle className="text-xs font-medium text-muted-foreground">Market Sentiment</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="pb-3 px-4">
            <div className={`text-xl font-bold ${sentimentInfo.color}`}>
              {sentimentInfo.label}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-3 px-4">
            <CardTitle className="text-xs font-medium text-muted-foreground">Tokens Tracked</CardTitle>
            <Coins className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="pb-3 px-4">
            <div className="text-xl font-bold">
              {insights?.totalTokens?.toLocaleString() || '—'}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top Movers */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Top Gainers */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-3 px-4">
            <CardTitle className="text-sm font-medium">🚀 Top Gainers (24h)</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent className="pb-3 px-4">
            {gainersLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-6 w-full" />
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {topGainers.map((token) => (
                  <div key={token.canonical_symbol} className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      {token.logo_url ? (
                        <img src={token.logo_url} alt={token.canonical_symbol} className="w-5 h-5 rounded-full" />
                      ) : (
                        <div className="w-5 h-5 rounded-full bg-muted flex items-center justify-center text-xs">
                          {token.canonical_symbol?.charAt(0)}
                        </div>
                      )}
                      <span className="text-sm font-medium">{token.canonical_symbol}</span>
                    </div>
                    <span className="text-sm text-green-500 font-semibold">
                      +{token.change_24h_pct?.toFixed(2)}%
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top Losers */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-3 px-4">
            <CardTitle className="text-sm font-medium">📉 Top Losers (24h)</CardTitle>
            <TrendingDown className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent className="pb-3 px-4">
            {losersLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-6 w-full" />
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {topLosers.map((token) => (
                  <div key={token.canonical_symbol} className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      {token.logo_url ? (
                        <img src={token.logo_url} alt={token.canonical_symbol} className="w-5 h-5 rounded-full" />
                      ) : (
                        <div className="w-5 h-5 rounded-full bg-muted flex items-center justify-center text-xs">
                          {token.canonical_symbol?.charAt(0)}
                        </div>
                      )}
                      <span className="text-sm font-medium">{token.canonical_symbol}</span>
                    </div>
                    <span className="text-sm text-red-500 font-semibold">
                      {token.change_24h_pct?.toFixed(2)}%
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
