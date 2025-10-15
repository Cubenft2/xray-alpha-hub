import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, RefreshCw } from 'lucide-react';
import { SocialSentimentShareCard } from '@/components/SocialSentimentShareCard';

interface SocialAsset {
  name: string;
  symbol: string;
  galaxy_score: number;
  fomo_score?: number;
  sentiment?: number;
  social_volume?: number;
  social_dominance?: number;
  price?: number;
  price_btc?: number;
  percent_change_24h?: number;
}

export function SocialSentimentCard() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [socialAssets, setSocialAssets] = useState<SocialAsset[]>([]);
  const [lastUpdated, setLastUpdated] = useState<string>('');

  const fetchSocialData = async () => {
    setLoading(true);
    try {
      console.log('📸 Fetching LunarCrush social data...');
      
      const { data, error } = await supabase.functions.invoke('lunarcrush-universe', {
        body: { 
          sort: 'galaxy_score',
          limit: 25 
        }
      });

      if (error) throw error;

      if (data?.data) {
        const assets = data.data.map((asset: any) => ({
          name: asset.name || asset.s || 'Unknown',
          symbol: asset.s || asset.symbol || '',
          galaxy_score: asset.gs || asset.galaxy_score || 0,
          fomo_score: asset.fomo_score || 0,
          sentiment: asset.sentiment || 0,
          social_volume: asset.social_volume || 0,
          social_dominance: asset.social_dominance || 0,
          price: asset.price || asset.p || 0,
          price_btc: asset.price_btc || asset.pb || 0,
          percent_change_24h: asset.percent_change_24h || asset.pc || 0,
        }));

        setSocialAssets(assets);
        setLastUpdated(new Date().toISOString());
        
        toast({
          title: "✅ Data Loaded",
          description: `Loaded ${assets.length} social assets from LunarCrush`,
        });
      }
    } catch (error: any) {
      console.error('❌ Failed to fetch social data:', error);
      toast({
        title: "❌ Error",
        description: error.message || "Failed to fetch social data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>📸 Social Sentiment Share Card Generator</CardTitle>
          <CardDescription>
            Generate shareable social sentiment cards for Twitter/X. Fetch live LunarCrush data, preview the card, and export as image.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <Button 
              onClick={fetchSocialData} 
              disabled={loading}
              size="lg"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Fetching Data...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Fetch LunarCrush Data (Top 25)
                </>
              )}
            </Button>
            
            {socialAssets.length > 0 && (
              <div className="text-sm text-muted-foreground">
                {socialAssets.length} assets loaded • Last updated: {new Date(lastUpdated).toLocaleTimeString()}
              </div>
            )}
          </div>

          {socialAssets.length > 0 && (
            <div className="pt-6 border-t">
              <h3 className="text-lg font-semibold mb-4">Preview & Export</h3>
              <SocialSentimentShareCard
                socialAssets={socialAssets}
                totalTracked={socialAssets.length}
                avgGalaxyScore={
                  socialAssets.reduce((acc, asset) => acc + asset.galaxy_score, 0) / socialAssets.length
                }
                generatedAt={lastUpdated}
              />
            </div>
          )}

          {socialAssets.length === 0 && !loading && (
            <div className="text-center py-12 text-muted-foreground">
              <p className="text-lg">No data loaded yet.</p>
              <p className="text-sm mt-2">Click "Fetch LunarCrush Data" to generate a social sentiment card.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
