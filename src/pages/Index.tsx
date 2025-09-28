import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { RefreshCw, Sparkles, Target, Activity, Eye, Waves, Compass, Hash } from 'lucide-react';
import { toast } from 'sonner';
import { FinancialDisclaimer } from '@/components/FinancialDisclaimer';
import { MarketBriefDisplay } from '@/components/MarketBriefDisplay';
import { FearGreedWidget } from '@/components/widgets/FearGreedWidget';
import { FOMOScoreWidget } from '@/components/widgets/FOMOScoreWidget';
import { TrendingCoinsWidget } from '@/components/widgets/TrendingCoinsWidget';
import { PriceSnapshotTable } from '@/components/widgets/PriceSnapshotTable';
import { SidebarWidgets } from '@/components/widgets/SidebarWidgets';
import { BriefArchive } from '@/components/BriefArchive';

interface MarketBrief {
  id: string;
  brief_type: string;
  title: string;
  slug: string;
  executive_summary: string;
  content_sections: any;
  social_data: any;
  market_data: any;
  stoic_quote: string | null;
  featured_assets: string[];
  sentiment_score: number | null;
  view_count: number;
  published_at: string;
  created_at: string;
}

const Index = () => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [customTopic, setCustomTopic] = useState('');
  const [isVip, setIsVip] = useState(true); // Set to true for private access
  const [autoGenerateOnLoad, setAutoGenerateOnLoad] = useState(false);

  const { data: briefs, isLoading: briefsLoading, refetch: refetchBriefs } = useQuery({
    queryKey: ['market_briefs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('market_briefs')
        .select('*')
        .eq('is_published', true)
        .order('published_at', { ascending: false })
        .limit(5);
      
      if (error) throw error;
      return data as MarketBrief[];
    }
  });

  // Auto-generate brief if none exists and it's the first load
  useEffect(() => {
    if (!briefsLoading && briefs && briefs.length === 0 && !autoGenerateOnLoad && isVip) {
      setAutoGenerateOnLoad(true);
      generateNewBrief();
    }
  }, [briefsLoading, briefs, autoGenerateOnLoad, isVip]);

  // Get the latest brief for main display
  const latestBrief = briefs && briefs.length > 0 ? briefs[0] : null;

  const generateNewBrief = async () => {
    if (!isVip) {
      toast.error('AI Brief generation is only available for VIP users');
      return;
    }

    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-brief');
      
      if (error) throw error;
      
      toast.success('Fresh market brief generated successfully!');
      refetchBriefs();
    } catch (error) {
      console.error('Error generating brief:', error);
      toast.error('Failed to generate market brief');
    } finally {
      setIsGenerating(false);
    }
  };

  const generateCustomBrief = async () => {
    if (!isVip) {
      toast.error('Custom brief generation is only available for VIP users');
      return;
    }

    if (!customTopic.trim()) {
      toast.error('Please enter a topic for your custom brief');
      return;
    }

    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-brief', {
        body: { customTopic: customTopic.trim() }
      });
      
      if (error) throw error;
      
      toast.success(`Custom brief about "${customTopic}" generated successfully!`);
      setCustomTopic('');
      refetchBriefs();
    } catch (error) {
      console.error('Error generating custom brief:', error);
      toast.error('Failed to generate custom brief');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <FinancialDisclaimer />
      
      {/* XRay Market Brief Homepage Layout */}
      <div className="flex container mx-auto px-4 py-8 gap-8">
        {/* Main Content Area */}
        <div className="flex-1 space-y-12">
          {/* Hero Section - Latest Brief Featured */}
          <div className="text-center space-y-8">
            {/* Header / Branding */}
            <div className="space-y-4">
              <div className="inline-flex items-center gap-3 px-8 py-4 bg-primary/10 rounded-full border-2 border-primary/30 mb-6">
                <span className="text-4xl animate-bounce">🎣</span>
                <div className="text-left">
                  <div className="font-black text-primary text-2xl font-pixel tracking-wide">XRayCrypto™</div>
                  <div className="text-sm text-muted-foreground font-pixel">Your crypto-first market analysis, twice a day</div>
                </div>
              </div>
              
              <h1 className="text-4xl md:text-6xl font-black xr-gradient-text mb-6 font-pixel">
                🖥️ Command Center
              </h1>
              
              <p className="text-xl text-muted-foreground max-w-4xl mx-auto leading-relaxed font-medium">
                Twice-daily briefings cutting through the noise. From Bitcoin and Ethereum to Layer-2s, DeFi blue-chips, 
                memecoins, ETF flows, and macro events. If it shifts the tide, it's here.
              </p>
            </div>

            {/* Interactive Dashboard Widgets */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
              <FearGreedWidget 
                score={latestBrief?.market_data?.fear_greed_score || 50}
                className="w-full"
              />
              <FOMOScoreWidget 
                score={latestBrief?.market_data?.fomo_score || 45}
                factors={['Social +2.1σ', 'Volume Spike', 'Momentum']}
                className="w-full"
              />
              <TrendingCoinsWidget limit={3} className="w-full" />
            </div>
          </div>

          {/* Main Brief Display */}
          <div className="space-y-12">
            {briefsLoading ? (
              <div className="text-center py-32">
                <div className="relative">
                  <RefreshCw className="h-20 w-20 animate-spin mx-auto mb-8 text-primary" />
                  <div className="absolute inset-0 rounded-full border-4 border-primary/20 animate-pulse"></div>
                </div>
                <h3 className="text-3xl font-bold text-primary mb-4 font-pixel">Gathering Market Intelligence</h3>
                <p className="text-lg text-muted-foreground max-w-md mx-auto">
                  Fresh briefing incoming... scanning the waters for actionable insights.
                </p>
              </div>
            ) : latestBrief ? (
              <div className="space-y-12">
                {/* Latest Brief Header */}
                <div className="text-center space-y-4">
                  <Badge variant="default" className="text-lg font-pixel px-6 py-2 mb-4 btn-hero">
                    🚨 LATEST BRIEF — {new Date(latestBrief.published_at).toLocaleDateString('en-US', { 
                      weekday: 'long', 
                      month: 'long', 
                      day: 'numeric' 
                    })}
                  </Badge>
                  
                  {/* Signature Opener Box */}
                  <div className="max-w-4xl mx-auto">
                    <Card className="xr-card-elevated border-2 border-accent/40 bg-gradient-to-r from-accent/10 to-primary/10">
                      <CardContent className="p-8">
                        <div className="text-center space-y-4">
                          <div className="inline-flex items-center gap-3 px-6 py-3 bg-accent/20 rounded-full border border-accent/50">
                            <Waves className="h-6 w-6 text-accent" />
                            <span className="font-bold text-accent text-lg font-pixel">Signature Opener</span>
                          </div>
                          <blockquote className="text-3xl font-bold text-primary font-pixel mb-4">
                            "Let's talk about something."
                          </blockquote>
                          <p className="text-xl text-foreground/90 italic leading-relaxed max-w-2xl mx-auto">
                            {latestBrief.content_sections?.opener || 
                             "The tide's changing, and there's more beneath the surface than most are seeing. Here's today's hook."}
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>

                {/* Interactive Market Reaction Table */}
                {latestBrief.market_data?.top_assets && (
                  <PriceSnapshotTable 
                    data={latestBrief.market_data.top_assets.map((asset: any) => ({
                      symbol: asset.symbol,
                      name: asset.name,
                      price: asset.price,
                      change_24h: asset.change_24h,
                      volume: asset.volume,
                      sentiment: asset.sentiment_score
                    }))}
                  />
                )}

                {/* Full Brief Content */}
                <MarketBriefDisplay brief={latestBrief} />
              </div>
            ) : (
              <div className="text-center py-32">
                <div className="space-y-6">
                  <div className="text-8xl animate-bounce">🎣</div>
                  <h3 className="text-3xl font-bold text-primary font-pixel">First Brief Loading...</h3>
                  <p className="text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
                    The inaugural XRay Market Brief is being prepared. Captain XRay is scanning the waters 
                    for the most important market developments.
                  </p>
                  {isVip && (
                    <Button 
                      onClick={generateNewBrief} 
                      disabled={isGenerating}
                      className="btn-hero mt-8"
                      size="lg"
                    >
                      {isGenerating ? (
                        <>
                          <RefreshCw className="h-5 w-5 mr-2 animate-spin" />
                          Generating Intelligence...
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-5 w-5 mr-2" />
                          Generate First Brief
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Past Briefs Archive */}
          {briefs && briefs.length > 1 && (
            <BriefArchive briefs={briefs.slice(1)} />
          )}

          {/* Footer */}
          <Card className="xr-card bg-muted/20">
            <CardContent className="p-8">
              <div className="text-center space-y-6">
                {/* Mission Statement */}
                <div className="space-y-4">
                  <h3 className="text-2xl font-bold text-primary font-pixel">About the XRay Brief</h3>
                  <p className="text-lg text-muted-foreground max-w-3xl mx-auto leading-relaxed">
                    Crypto-first market analysis delivered twice daily. We blend verified news, real data, and clear context 
                    for pros and smart newcomers. Numbers before narratives, always.
                  </p>
                </div>
                
                {/* Sources Disclaimer */}
                <div className="space-y-2">
                  <div className="text-sm text-muted-foreground">
                    <strong>Data Sources:</strong> CoinGecko Pro, Binance, LunarCrush, Alternative.me, Reuters, AP, SEC, Fed, CoinDesk, Blockworks
                  </div>
                  <div className="flex items-center justify-center gap-4 text-sm text-muted-foreground">
                    <Badge variant="outline" className="font-pixel">@XRayCryptoX</Badge>
                    <Badge variant="outline" className="font-pixel">@XRayMetaX</Badge>
                  </div>
                </div>
                
                {/* Educational Disclaimer */}
                <Alert className="max-w-2xl mx-auto">
                  <AlertDescription className="text-center">
                    ⚠️ <strong>Not financial advice.</strong> For educational purposes only. 
                    Trade responsibly and do your own research.
                  </AlertDescription>
                </Alert>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar Widgets - Always Visible */}
        <div className="hidden xl:block w-80 space-y-6">
          <div className="sticky top-24">
            <SidebarWidgets 
              fearGreedScore={latestBrief?.market_data?.fear_greed_score}
              fearGreedLabel={latestBrief?.market_data?.fear_greed_label}
            />
          </div>
        </div>
      </div>

      {/* Hidden Admin Controls - Only for VIP */}
      {isVip && (
        <div className="fixed bottom-4 right-4 space-y-2 opacity-30 hover:opacity-100 transition-opacity z-40">
          <Button 
            onClick={generateNewBrief} 
            disabled={isGenerating}
            size="sm"
            variant="outline"
            className="shadow-lg"
          >
            {isGenerating ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
          </Button>
        </div>
      )}
    </div>
  );
};

export default Index;