import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, Hash, Activity } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface TrendingCoin {
  asset_symbol: string;
  asset_name: string;
  social_volume?: number;
  trending_rank?: number;
  sentiment_score?: number;
}

interface TrendingCoinsWidgetProps {
  className?: string;
  limit?: number;
}

export function TrendingCoinsWidget({ className = "", limit = 5 }: TrendingCoinsWidgetProps) {
  const { data: trendingCoins, isLoading } = useQuery({
    queryKey: ['trending_coins'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('social_sentiment')
        .select('asset_symbol, asset_name, social_volume, trending_rank, sentiment_score')
        .not('trending_rank', 'is', null)
        .order('trending_rank', { ascending: true })
        .limit(limit);
      
      if (error) throw error;
      return data as TrendingCoin[];
    },
    refetchInterval: 30000 // Refresh every 30 seconds
  });

  return (
    <Card className={`xr-card ${className}`}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Hash className="h-5 w-5 text-accent" />
          Word on the Docks
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: limit }).map((_, i) => (
              <div key={i} className="flex items-center justify-between p-2 rounded border animate-pulse">
                <div className="h-4 bg-muted rounded w-16"></div>
                <div className="h-4 bg-muted rounded w-8"></div>
              </div>
            ))}
          </div>
        ) : trendingCoins && trendingCoins.length > 0 ? (
          <div className="space-y-2">
            {trendingCoins.map((coin, index) => (
              <div key={coin.asset_symbol} className="flex items-center justify-between p-2 rounded border bg-background/50 hover:bg-background/80 transition-colors">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs w-6 h-6 rounded-full p-0 flex items-center justify-center">
                    {index + 1}
                  </Badge>
                  <div>
                    <div className="font-semibold text-sm">{coin.asset_symbol}</div>
                    <div className="text-xs text-muted-foreground truncate max-w-24">{coin.asset_name}</div>
                  </div>
                </div>
                
                <div className="flex items-center gap-2 text-right">
                  {coin.social_volume && (
                    <div className="text-xs text-muted-foreground">
                      {coin.social_volume > 1000 ? `${(coin.social_volume / 1000).toFixed(1)}k` : coin.social_volume}
                    </div>
                  )}
                  {coin.sentiment_score && (
                    <Badge 
                      variant={coin.sentiment_score > 0 ? 'default' : 'destructive'} 
                      className="text-xs"
                    >
                      {coin.sentiment_score > 0 ? '+' : ''}{coin.sentiment_score.toFixed(1)}
                    </Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-4 text-sm text-muted-foreground">
            <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No trending data available</p>
            <p className="text-xs">LunarCrush API required</p>
          </div>
        )}
        
        <div className="mt-3 text-center">
          <Badge variant="outline" className="text-xs font-pixel">
            LunarCrush Social Volume
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}