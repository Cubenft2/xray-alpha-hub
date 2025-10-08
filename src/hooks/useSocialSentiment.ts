import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface SocialAsset {
  name: string;
  symbol: string;
  galaxy_score: number;
  sentiment: number;
  social_volume: number;
  social_dominance: number;
  fomo_score: number;
  alt_rank?: number;
}

export interface SocialSentimentMetadata {
  source: string;
  last_updated: string | null;
  count: number;
}

export function useSocialSentiment() {
  const [assets, setAssets] = useState<SocialAsset[]>([]);
  const [metadata, setMetadata] = useState<SocialSentimentMetadata | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSocialData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      console.log('🔄 Fetching social sentiment data...');
      
      const { data, error: err } = await supabase.functions.invoke('social-sentiment', {
        body: {}
      });

      if (err) throw err;

      const socialData = Array.isArray(data?.data) ? data.data : [];
      const metaData = data?.metadata || null;
      
      console.log(`✅ Loaded ${socialData.length} social assets from ${metaData?.source || 'unknown'}`);
      
      setAssets(socialData.map((asset: any) => ({
        name: asset.name || asset.symbol,
        symbol: String(asset.symbol || '').toUpperCase(),
        galaxy_score: Number(asset.galaxy_score || 0),
        sentiment: Number(asset.sentiment || 0),
        social_volume: Number(asset.social_volume || 0),
        social_dominance: Number(asset.social_dominance || 0),
        fomo_score: Number(asset.fomo_score || asset.alt_rank || 0),
        alt_rank: Number(asset.alt_rank || 999)
      })));
      
      setMetadata(metaData);
      setLoading(false);
    } catch (err: any) {
      console.error('❌ Failed to fetch social sentiment:', err);
      setError(err.message || 'Failed to load social sentiment data');
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSocialData();
  }, [fetchSocialData]);

  return { assets, metadata, loading, error, refetch: fetchSocialData };
}
