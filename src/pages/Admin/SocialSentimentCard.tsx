import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, RefreshCw, FileJson, AlertCircle } from 'lucide-react';
import { SocialSentimentShareCard } from '@/components/SocialSentimentShareCard';
import { Textarea } from '@/components/ui/textarea';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';

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
  token_address?: string;
  alt_rank?: number;
}

export function SocialSentimentCard() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [socialAssets, setSocialAssets] = useState<SocialAsset[]>([]);
  const [lastUpdated, setLastUpdated] = useState<string>('');
  const [importMode, setImportMode] = useState<'api' | 'json'>('json');
  const [jsonInput, setJsonInput] = useState('');
  const [validationError, setValidationError] = useState('');

  const enrichWithTokenAddresses = async (assets: any[]) => {
    const symbols = assets.map(a => a.symbol);
    
    const { data: mappings } = await supabase
      .from('ticker_mappings')
      .select('symbol, coingecko_id, dex_platforms')
      .in('symbol', symbols);
    
    const cgIds = mappings?.map(m => m.coingecko_id).filter(Boolean) || [];
    
    const { data: cgData } = cgIds.length > 0 ? await supabase
      .from('cg_master')
      .select('cg_id, platforms')
      .in('cg_id', cgIds) : { data: null };
    
    const platformsMap = new Map();
    cgData?.forEach(cg => {
      if (cg.platforms) {
        platformsMap.set(cg.cg_id, cg.platforms);
      }
    });
    
    return assets.map(asset => {
      const mapping = mappings?.find(m => m.symbol === asset.symbol);
      const platforms = mapping?.coingecko_id 
        ? platformsMap.get(mapping.coingecko_id) 
        : null;
      
      let tokenAddress = null;
      if (platforms && typeof platforms === 'object') {
        tokenAddress = platforms.ethereum || 
                       platforms['binance-smart-chain'] || 
                       platforms.polygon || 
                       Object.values(platforms)[0];
      }
      
      return {
        name: asset.name,
        symbol: asset.symbol,
        galaxy_score: asset.galaxy_score || 0,
        fomo_score: asset.fomo_score || 0,
        sentiment: asset.sentiment || 0,
        social_volume: asset.social_volume || 0,
        social_dominance: asset.social_dominance || 0,
        alt_rank: asset.alt_rank || 0,
        token_address: tokenAddress,
      };
    });
  };

  const parseImportedJson = async (jsonText: string) => {
    setValidationError('');
    setLoading(true);
    try {
      const parsed = JSON.parse(jsonText);
      
      if (!parsed.data || !Array.isArray(parsed.data)) {
        throw new Error('Invalid format: missing "data" array');
      }
      
      if (parsed.data.length === 0) {
        throw new Error('No assets found in JSON');
      }
      
      const enriched = await enrichWithTokenAddresses(parsed.data);
      
      setSocialAssets(enriched);
      setLastUpdated(parsed.generated_at || new Date().toISOString());
      
      toast({
        title: "✅ Data Imported",
        description: `Loaded ${enriched.length} assets from JSON`,
      });
    } catch (error: any) {
      console.error('❌ JSON parse error:', error);
      setValidationError(error.message);
      toast({
        title: "❌ Parse Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

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

        const enriched = await enrichWithTokenAddresses(assets);
        setSocialAssets(enriched);
        setLastUpdated(new Date().toISOString());
        
        toast({
          title: "✅ Data Loaded",
          description: `Loaded ${enriched.length} social assets from LunarCrush`,
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
          {/* Mode Toggle */}
          <div className="flex items-center gap-4 p-4 bg-muted rounded-lg">
            <Label className="font-semibold">Data Source:</Label>
            <ToggleGroup type="single" value={importMode} onValueChange={(value) => value && setImportMode(value as 'api' | 'json')}>
              <ToggleGroupItem value="json">📋 Import JSON</ToggleGroupItem>
              <ToggleGroupItem value="api">🔄 Fetch API</ToggleGroupItem>
            </ToggleGroup>
          </div>

          {/* JSON Import Mode */}
          {importMode === 'json' && (
            <div className="space-y-3">
              <Label htmlFor="json-input" className="text-base font-semibold">
                Paste Social Sentiment JSON (from email)
              </Label>
              <Textarea
                id="json-input"
                placeholder='{ "data": [...], "generated_at": "...", "total_assets": 25 }'
                value={jsonInput}
                onChange={(e) => setJsonInput(e.target.value)}
                className="font-mono text-sm min-h-[200px]"
              />
              {validationError && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{validationError}</AlertDescription>
                </Alert>
              )}
              <Button 
                onClick={() => parseImportedJson(jsonInput)}
                disabled={!jsonInput.trim() || loading}
                size="lg"
                className="w-full"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <FileJson className="mr-2 h-5 w-5" />
                    Parse & Load Data
                  </>
                )}
              </Button>
            </div>
          )}

          {/* API Fetch Mode */}
          {importMode === 'api' && (
            <div className="space-y-3">
              <Button 
                onClick={fetchSocialData} 
                disabled={loading}
                size="lg"
                className="w-full"
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
            </div>
          )}

          {socialAssets.length > 0 && (
            <div className="text-sm text-muted-foreground text-center">
              {socialAssets.length} assets loaded • Updated: {new Date(lastUpdated).toLocaleString('en-US', { 
                month: 'short', 
                day: 'numeric', 
                year: 'numeric',
                hour: 'numeric', 
                minute: '2-digit',
                hour12: true 
              })}
            </div>
          )}

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
