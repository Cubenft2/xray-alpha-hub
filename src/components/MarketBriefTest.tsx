import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2, RefreshCw, TrendingUp, Zap } from 'lucide-react';
import { MiniChart } from './MiniChart';
import { useTheme } from 'next-themes';
import { triggerMarketBrief } from '@/utils/marketBriefTrigger';

export function MarketBriefTest() {
  const [loading, setLoading] = useState(false);
  const [newsData, setNewsData] = useState<any>(null);
  const [briefData, setBriefData] = useState<any>(null);
  const { toast } = useToast();
  const { theme } = useTheme();

  // Test the news-fetch edge function
  const testNewsFetch = async () => {
    console.log('🐕 XRay: Testing news-fetch function...');
    setLoading(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('news-fetch', {
        body: { limit: 10 }
      });

      console.log('🐕 XRay: News fetch response:', { data, error });

      if (error) {
        console.error('🐕 XRay: News fetch error:', error);
        toast({
          title: 'News Fetch Failed',
          description: error.message || 'Failed to fetch news data',
          variant: 'destructive'
        });
        return;
      }

      setNewsData(data);
      toast({
        title: 'News Fetch Success',
        description: `Fetched crypto: ${data?.crypto?.length || 0}, stocks: ${data?.stocks?.length || 0}, trump: ${data?.trump?.length || 0}`,
      });

    } catch (error) {
      console.error('🐕 XRay: News fetch exception:', error);
      toast({
        title: 'News Fetch Error',
        description: 'Unexpected error during news fetch',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  // Test the Cloudflare worker market brief generation
  const testMarketBrief = async () => {
    console.log('🐕 XRay: Testing market brief generation...');
    setLoading(true);
    
    try {
      // Try to get the latest market brief
      const workerBase = 'https://xraycrypto-news.xrprat.workers.dev/';
      const cacheParam = `?cb=${Date.now()}`;
      
      const response = await fetch(`${workerBase}marketbrief/latest.json${cacheParam}`, {
        cache: 'no-store',
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'XRayDog-MarketBrief-Test/1.0'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const brief = await response.json();
      console.log('🐕 XRay: Market brief response:', brief);

      setBriefData(brief);
      toast({
        title: 'Market Brief Success',
        description: `Loaded brief: "${brief.title?.substring(0, 50)}..."`,
      });

    } catch (error) {
      console.error('🐕 XRay: Market brief error:', error);
      toast({
        title: 'Market Brief Error',
        description: error instanceof Error ? error.message : 'Failed to fetch market brief',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  // Generate a new market brief
  const generateNewBrief = async () => {
    console.log('🐕 XRay: Generating new market brief...');
    setLoading(true);
    
    try {
      const workerBase = 'https://xraycrypto-news.xrprat.workers.dev/';
      
      const response = await fetch(`${workerBase}marketbrief/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'XRayDog-MarketBrief-Test/1.0'
        },
        body: JSON.stringify({
          force: true,
          test: true
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const result = await response.json();
      console.log('🐕 XRay: Generation result:', result);

      toast({
        title: 'Generation Started',
        description: 'Market brief generation initiated. Check back in a few moments.',
      });

      // Wait a bit then fetch the latest brief
      setTimeout(() => {
        testMarketBrief();
      }, 3000);

    } catch (error) {
      console.error('🐕 XRay: Generation error:', error);
      toast({
        title: 'Generation Error',
        description: error instanceof Error ? error.message : 'Failed to generate market brief',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  // Trigger market brief via Supabase edge function
  const triggerBriefViaSupabase = async () => {
    console.log('🐕 XRay: Triggering market brief via Supabase edge function...');
    setLoading(true);
    
    try {
      const result = await triggerMarketBrief({
        force: true,
        notes: 'Manual generation via Supabase edge function',
        // Add your Cloudflare worker URL here if you have one
        // workerUrl: 'https://your-worker-domain.workers.dev'
      });

      console.log('🐕 XRay: Supabase trigger result:', result);

      if (result.success) {
        toast({
          title: 'Brief Generation Triggered',
          description: result.message || 'Market brief generation started successfully',
        });
        
        // Optionally set brief data if returned
        if (result.result?.slug) {
          console.log('🐕 XRay: Generated brief slug:', result.result.slug);
        }
      } else {
        throw new Error(result.error || 'Failed to trigger brief generation');
      }

    } catch (error) {
      console.error('🐕 XRay: Supabase trigger error:', error);
      toast({
        title: 'Trigger Error',
        description: error instanceof Error ? error.message : 'Failed to trigger market brief',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  // Extract focus assets from brief content for charts
  const getFocusAssets = () => {
    if (!briefData?.article_html) return [];
    
    // Look for common crypto symbols in the content
    const content = briefData.article_html.toLowerCase();
    const assets = [];
    
    if (content.includes('bitcoin') || content.includes('btc')) assets.push('BTCUSD');
    if (content.includes('ethereum') || content.includes('eth')) assets.push('ETHUSD');
    if (content.includes('solana') || content.includes('sol')) assets.push('SOLUSD');
    if (content.includes('cardano') || content.includes('ada')) assets.push('ADAUSD');
    if (content.includes('avalanche') || content.includes('avax')) assets.push('AVAXUSD');
    
    return assets.slice(0, 3); // Limit to 3 charts
  };

  const focusAssets = getFocusAssets();

  return (
    <div className="space-y-6">
      <Card className="xr-card">
        <CardHeader>
          <CardTitle className="flex items-center">
            🧪 Market Brief Testing Dashboard
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Button 
                onClick={testNewsFetch}
                disabled={loading}
                className="flex items-center"
              >
                {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                Test News Fetch
              </Button>
              
              <Button 
                onClick={testMarketBrief}
                disabled={loading}
                variant="outline"
              >
                {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <TrendingUp className="w-4 h-4 mr-2" />}
                Get Latest Brief
              </Button>
              
              <Button 
                onClick={generateNewBrief}
                disabled={loading}
                variant="secondary"
              >
                {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                Generate New Brief
              </Button>
              
              <Button 
                onClick={triggerBriefViaSupabase}
                disabled={loading}
                variant="default"
                className="bg-green-600 hover:bg-green-700"
              >
                {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Zap className="w-4 h-4 mr-2" />}
                Trigger via Supabase
              </Button>
            </div>
            
            <div className="text-sm text-muted-foreground">
              Use these buttons to test the market brief system and see generated content with live charts.
            </div>
          </div>
        </CardContent>
      </Card>

      {/* News Data Display */}
      {newsData && (
        <Card className="xr-card">
          <CardHeader>
            <CardTitle>📰 News Data Results</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <h4 className="font-semibold mb-2">🚀 Crypto ({newsData.crypto?.length || 0})</h4>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {newsData.crypto?.slice(0, 3).map((item: any, i: number) => (
                    <div key={i} className="text-xs p-2 bg-muted rounded">
                      <div className="font-medium line-clamp-1">{item.title}</div>
                      <div className="text-muted-foreground">{item.source}</div>
                    </div>
                  ))}
                </div>
              </div>
              
              <div>
                <h4 className="font-semibold mb-2">📈 Stocks ({newsData.stocks?.length || 0})</h4>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {newsData.stocks?.slice(0, 3).map((item: any, i: number) => (
                    <div key={i} className="text-xs p-2 bg-muted rounded">
                      <div className="font-medium line-clamp-1">{item.title}</div>
                      <div className="text-muted-foreground">{item.source}</div>
                    </div>
                  ))}
                </div>
              </div>
              
              <div>
                <h4 className="font-semibold mb-2">🇺🇸 Trump ({newsData.trump?.length || 0})</h4>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {newsData.trump?.slice(0, 3).map((item: any, i: number) => (
                    <div key={i} className="text-xs p-2 bg-muted rounded">
                      <div className="font-medium line-clamp-1">{item.title}</div>
                      <div className="text-muted-foreground">{item.source}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Market Brief Display */}
      {briefData && (
        <div className="space-y-4">
          <Card className="xr-card">
            <CardHeader>
              <CardTitle>📊 Generated Market Brief</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-bold mb-2">{briefData.title}</h3>
                  <div className="text-sm text-muted-foreground mb-4">
                    {briefData.date} • Session: <span className="font-medium">{briefData.session?.toUpperCase()}</span> • Slug: {briefData.slug}
                    {briefData.sentiment_score && (
                      <span className="ml-2">• Sentiment: <span className={`font-medium ${
                        briefData.sentiment_score === 'bullish' ? 'text-green-600' : 
                        briefData.sentiment_score === 'bearish' ? 'text-red-600' : 'text-yellow-600'
                      }`}>{briefData.sentiment_score}</span></span>
                    )}
                  </div>
                  {briefData.summary && (
                    <div className="p-4 bg-muted rounded-lg mb-4">
                      <h4 className="font-semibold mb-2">Summary:</h4>
                      <p className="text-sm">{briefData.summary}</p>
                    </div>
                  )}
                  
                  {briefData.mini_section && (
                    <div className="p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg mb-4">
                      <h4 className="font-semibold mb-1 text-blue-800 dark:text-blue-200">🎣 Mini Section:</h4>
                      <p className="text-sm text-blue-700 dark:text-blue-300">{briefData.mini_section}</p>
                    </div>
                  )}
                </div>
                
                {briefData.article_html && (
                  <div className="prose prose-sm max-w-none">
                    <h4 className="font-semibold mb-2">Article Content:</h4>
                    <div 
                      className="bg-background border rounded-lg p-4 max-h-96 overflow-y-auto text-sm"
                      dangerouslySetInnerHTML={{ __html: briefData.article_html }}
                    />
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Focus Assets Charts */}
          {focusAssets.length > 0 && (
            <Card className="xr-card">
              <CardHeader>
                <CardTitle>📈 Focus Assets Charts</CardTitle>
              </CardHeader>
              <CardContent>
                <div className={`grid gap-4 ${focusAssets.length === 1 ? 'grid-cols-1' : focusAssets.length === 2 ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'}`}>
                  {focusAssets.map((symbol, index) => (
                    <div key={symbol} className="border rounded-lg p-4">
                      <h4 className="font-medium mb-2 text-center">{symbol}</h4>
                      <div className="h-64">
                        <MiniChart 
                          symbol={symbol}
                          theme={theme}
                        />
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-4 text-sm text-muted-foreground">
                  Charts automatically generated based on assets mentioned in the brief content.
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}