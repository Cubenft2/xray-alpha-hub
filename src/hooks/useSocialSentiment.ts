import React from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface SocialAsset {
  name: string;
  symbol: string;
  galaxy_score: number;
  sentiment: number;
  social_volume: number;
  social_dominance?: number;
  fomo_score?: number;
  alt_rank?: number;
}

export function useSocialSentiment(marketData: any) {
  const primaryAssets = marketData?.content_sections?.market_data?.social_sentiment as SocialAsset[] | undefined;

  // Build immediate client-side fallback from brief
  const baseFromBrief = React.useMemo<SocialAsset[]>(() => {
    if (Array.isArray(primaryAssets) && primaryAssets.length > 0) {
      return primaryAssets.map((a) => ({
        name: a.name || (a.symbol || '').toUpperCase(),
        symbol: (a.symbol || '').toUpperCase(),
        galaxy_score: Number(a.galaxy_score || 0),
        sentiment: Number(a.sentiment || 0),
        social_volume: Number(a.social_volume || 0),
        social_dominance: Number(a.social_dominance || 0),
        fomo_score: Number(a.fomo_score || 0),
      }));
    }

    const sd = marketData?.content_sections?.social_data;
    const top = Array.isArray(sd?.top_social_assets) ? sd.top_social_assets : [];
    if (top.length > 0) {
      const avgScore = Math.round(sd?.avg_galaxy_score || 0);
      return top.slice(0, 10).map((sym: string) => ({
        name: String(sym).toUpperCase(),
        symbol: String(sym).toUpperCase(),
        galaxy_score: avgScore,
        sentiment: 0,
        social_volume: 0,
        social_dominance: 0,
        fomo_score: 0,
      }));
    }

    const md = marketData?.content_sections?.market_data;
    const movers = [ ...(md?.top_gainers || []), ...(md?.top_losers || []) ];
    return movers.slice(0, 6).map((a: any) => ({
      name: a.name || (a.symbol || '').toUpperCase(),
      symbol: String(a.symbol || '').toUpperCase(),
      galaxy_score: 0,
      sentiment: typeof a.change_24h === 'number' ? (a.change_24h > 0 ? 0.25 : -0.25) : 0,
      social_volume: 0,
      social_dominance: 0,
      fomo_score: typeof a.change_24h === 'number' ? Math.max(0, Math.min(100, 50 + a.change_24h)) : 0,
    }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(primaryAssets), JSON.stringify(marketData?.content_sections?.social_data), JSON.stringify(marketData?.content_sections?.market_data?.top_gainers), JSON.stringify(marketData?.content_sections?.market_data?.top_losers)]);

  const [assets, setAssets] = React.useState<SocialAsset[]>(baseFromBrief);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    setAssets(baseFromBrief);
  }, [baseFromBrief]);

  // Live refresh from edge function
  React.useEffect(() => {
    let active = true;
    if (Array.isArray(primaryAssets) && primaryAssets.length > 0) return; // already have real data

    setLoading(true);
    (async () => {
      try {
        const { data: resp, error } = await supabase.functions.invoke('social-sentiment', { body: {} });
        if (error) throw error;
        const arr = Array.isArray((resp as any)?.data) ? (resp as any).data : (Array.isArray(resp) ? resp : []);
        if (active && arr.length > 0) {
          setAssets(arr.map((a: any) => ({
            name: a.name || a.symbol,
            symbol: String(a.symbol || '').toUpperCase(),
            galaxy_score: Number(a.galaxy_score || 0),
            sentiment: Number(a.sentiment || 0),
            social_volume: Number(a.social_volume || 0),
            social_dominance: Number(a.social_dominance || 0),
            fomo_score: Number(a.fomo_score || 0),
          })));
        }
      } catch (e: any) {
        console.warn('useSocialSentiment: remote fetch failed', e);
        if (active) setError(String(e?.message || 'fetch_failed'));
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [JSON.stringify(primaryAssets)]);

  return { assets, loading, error };
}
