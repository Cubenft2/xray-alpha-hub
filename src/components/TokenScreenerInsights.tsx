import { TrendingUp, TrendingDown, DollarSign, Activity, Star, BarChart3, Coins } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Link } from 'react-router-dom';

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
    if (value >= 1e12) return `$${(value / 1e12).toFixed(1)}T`;
    if (value >= 1e9) return `$${(value / 1e9).toFixed(1)}B`;
    if (value >= 1e6) return `$${(value / 1e6).toFixed(1)}M`;
    return `$${value.toFixed(0)}`;
  };

  const getSentimentLabel = (score: number) => {
    if (score >= 60) return { label: 'Bullish', color: 'text-green-500', emoji: '📈' };
    if (score >= 40) return { label: 'Neutral', color: 'text-yellow-500', emoji: '➡️' };
    return { label: 'Bearish', color: 'text-red-500', emoji: '📉' };
  };

  const sentimentInfo = insights?.avgSentiment 
    ? getSentimentLabel(insights.avgSentiment)
    : { label: '—', color: 'text-muted-foreground', emoji: '' };

  return (
    <div className="space-y-3">
      {/* Compact Stat Pills */}
      <div className="flex flex-wrap gap-2">
        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-card/50 border border-border/50 rounded-md">
          <DollarSign className="h-3 w-3 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">MCap</span>
          {isLoading ? (
            <Skeleton className="h-4 w-14" />
          ) : (
            <span className="text-sm font-bold">{formatCurrency(insights?.totalMarketCap || 0)}</span>
          )}
        </div>

        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-card/50 border border-border/50 rounded-md">
          <BarChart3 className="h-3 w-3 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">Vol</span>
          {isLoading ? (
            <Skeleton className="h-4 w-14" />
          ) : (
            <span className="text-sm font-bold">{formatCurrency(insights?.totalVolume || 0)}</span>
          )}
        </div>

        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-card/50 border border-border/50 rounded-md">
          <Star className="h-3 w-3 text-yellow-500" />
          <span className="text-xs text-muted-foreground">Galaxy</span>
          {isLoading ? (
            <Skeleton className="h-4 w-8" />
          ) : (
            <span className="text-sm font-bold">{insights?.avgGalaxyScore?.toFixed(1) || '—'}</span>
          )}
        </div>

        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-card/50 border border-border/50 rounded-md">
          <Activity className="h-3 w-3 text-muted-foreground" />
          {isLoading ? (
            <Skeleton className="h-4 w-16" />
          ) : (
            <span className={`text-sm font-bold ${sentimentInfo.color}`}>
              {sentimentInfo.emoji} {sentimentInfo.label}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-card/50 border border-border/50 rounded-md">
          <Coins className="h-3 w-3 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">Tracked</span>
          {isLoading ? (
            <Skeleton className="h-4 w-10" />
          ) : (
            <span className="text-sm font-bold">{insights?.totalTokens?.toLocaleString() || '—'}</span>
          )}
        </div>
      </div>

      {/* Compact Gainers & Losers */}
      <div className="flex flex-wrap gap-3">
        <Card className="bg-card/50 border-border/50 w-[280px]">
          <CardHeader className="pb-1 px-3 pt-2">
            <CardTitle className="text-xs font-medium flex items-center gap-1.5">
              <TrendingUp className="h-3 w-3 text-green-500" />
              Top Gainers
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-2">
            {gainersLoading ? (
              <div className="space-y-1">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-5 w-full" />
                ))}
              </div>
            ) : topGainers.length > 0 ? (
              <div className="space-y-0.5">
                {topGainers.map((token) => (
                  <Link 
                    key={token.canonical_symbol} 
                    to={`/crypto-universe/${token.canonical_symbol}`}
                    className="flex items-center justify-between py-0.5 hover:bg-muted/30 rounded px-1 -mx-1 transition-colors"
                  >
                    <div className="flex items-center gap-1.5">
                      {token.logo_url ? (
                        <img src={token.logo_url} alt={token.canonical_symbol} className="w-4 h-4 rounded-full" />
                      ) : (
                        <div className="w-4 h-4 rounded-full bg-muted flex items-center justify-center text-[8px]">
                          {token.canonical_symbol?.charAt(0)}
                        </div>
                      )}
                      <span className="font-medium text-xs">{token.canonical_symbol}</span>
                    </div>
                    <span className="text-green-500 font-bold text-xs">
                      +{token.change_24h_pct?.toFixed(1)}%
                    </span>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">No data</p>
            )}
          </CardContent>
        </Card>

        <Card className="bg-card/50 border-border/50 w-[280px]">
          <CardHeader className="pb-1 px-3 pt-2">
            <CardTitle className="text-xs font-medium flex items-center gap-1.5">
              <TrendingDown className="h-3 w-3 text-red-500" />
              Top Losers
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-2">
            {losersLoading ? (
              <div className="space-y-1">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-5 w-full" />
                ))}
              </div>
            ) : topLosers.length > 0 ? (
              <div className="space-y-0.5">
                {topLosers.map((token) => (
                  <Link 
                    key={token.canonical_symbol} 
                    to={`/crypto-universe/${token.canonical_symbol}`}
                    className="flex items-center justify-between py-0.5 hover:bg-muted/30 rounded px-1 -mx-1 transition-colors"
                  >
                    <div className="flex items-center gap-1.5">
                      {token.logo_url ? (
                        <img src={token.logo_url} alt={token.canonical_symbol} className="w-4 h-4 rounded-full" />
                      ) : (
                        <div className="w-4 h-4 rounded-full bg-muted flex items-center justify-center text-[8px]">
                          {token.canonical_symbol?.charAt(0)}
                        </div>
                      )}
                      <span className="font-medium text-xs">{token.canonical_symbol}</span>
                    </div>
                    <span className="text-red-500 font-bold text-xs">
                      {token.change_24h_pct?.toFixed(1)}%
                    </span>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">No data</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
