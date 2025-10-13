import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AssetSentimentCard } from './AssetSentimentCard';
import { Skeleton } from './ui/skeleton';

interface AssetSentiment {
  asset_symbol: string;
  asset_name: string;
  sentiment_score: number;
  sentiment_label: 'bullish' | 'bearish' | 'neutral';
  positive_count: number;
  negative_count: number;
  neutral_count: number;
  total_articles: number;
  trend_direction?: 'up' | 'down' | 'stable';
  score_change?: number;
  timestamp: string;
}

export function TopAssetsSentiment() {
  const [assets, setAssets] = useState<AssetSentiment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [showLiveIndicator, setShowLiveIndicator] = useState(false);

  const fetchLatestAssetSentiments = async () => {
    try {
      // Get most recent timestamp
      const { data: latest, error: latestError } = await supabase
        .from('asset_sentiment_snapshots')
        .select('timestamp')
        .order('timestamp', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (latestError) throw latestError;
      if (!latest) {
        setIsLoading(false);
        return;
      }

      // Get all assets from that timestamp (top 10)
      const { data: assetsData, error: assetsError } = await supabase
        .from('asset_sentiment_snapshots')
        .select('*')
        .eq('timestamp', latest.timestamp)
        .order('total_articles', { ascending: false });

      if (assetsError) throw assetsError;

      setAssets((assetsData || []) as AssetSentiment[]);
      setLastUpdate(new Date(latest.timestamp));
      setIsLoading(false);
    } catch (error) {
      console.error('Error fetching asset sentiments:', error);
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLatestAssetSentiments();

    // Auto-refresh every 5 minutes
    const interval = setInterval(fetchLatestAssetSentiments, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // Real-time subscription
  useEffect(() => {
    const channel = supabase
      .channel('asset-sentiment-updates')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'asset_sentiment_snapshots'
      }, () => {
        console.log('New asset sentiment data received');
        fetchLatestAssetSentiments();
        setShowLiveIndicator(true);
        setTimeout(() => setShowLiveIndicator(false), 3000);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {Array.from({ length: 10 }).map((_, i) => (
          <Skeleton key={i} className="h-32 w-full" />
        ))}
      </div>
    );
  }

  if (assets.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p>No asset sentiment data available yet.</p>
        <p className="text-sm mt-2">Sentiment data will appear after the next news refresh cycle.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full transition-all ${showLiveIndicator ? 'bg-success animate-pulse' : 'bg-success/50'}`} />
          <span className={`text-xs font-medium transition-colors ${showLiveIndicator ? 'text-success' : 'text-muted-foreground'}`}>
            LIVE
          </span>
        </div>
        {lastUpdate && (
          <span className="text-xs text-muted-foreground">
            Updated {lastUpdate.toLocaleTimeString()}
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {assets.map((asset) => (
          <AssetSentimentCard
            key={asset.asset_symbol}
            symbol={asset.asset_symbol}
            name={asset.asset_name}
            score={asset.sentiment_score}
            label={asset.sentiment_label}
            positive={asset.positive_count}
            negative={asset.negative_count}
            neutral={asset.neutral_count}
            total={asset.total_articles}
            trend={asset.trend_direction}
            scoreChange={asset.score_change}
          />
        ))}
      </div>
    </div>
  );
}
