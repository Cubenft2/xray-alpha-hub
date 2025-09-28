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
      <div className="container mx-auto px-4 py-8">
        {/* Simple Hero Section */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 px-6 py-3 bg-primary/10 rounded-full border border-primary/30 mb-4">
            <span className="text-3xl animate-bounce">🎣</span>
            <span className="font-bold text-primary text-xl font-pixel tracking-wide">XRay Market Brief</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-black xr-gradient-text mb-4 font-pixel">
            Command Center for Crypto Intelligence
          </h1>
          <p className="text-lg text-muted-foreground max-w-3xl mx-auto leading-relaxed">
            Twice-daily briefings that cut through the noise. Your source of truth for crypto markets.
          </p>
        </div>

        {/* Main Content - THE BRIEF (Full Width Focus) */}
        <div className="max-w-4xl mx-auto">
          {briefsLoading ? (
            <div className="text-center py-20">
              <RefreshCw className="h-16 w-16 animate-spin mx-auto mb-6 text-primary" />
              <h3 className="text-2xl font-bold text-primary mb-4 font-pixel">Gathering Market Intelligence</h3>
              <p className="text-lg text-muted-foreground">
                Fresh briefing incoming... scanning the waters for actionable insights.
              </p>
            </div>
          ) : latestBrief ? (
            <div className="space-y-6">
              {/* Brief Header */}
              <div className="text-center mb-6">
                <Badge variant="default" className="text-base font-pixel px-4 py-2 btn-hero">
                  🚨 LATEST BRIEF — {new Date(latestBrief.published_at).toLocaleDateString('en-US', { 
                    weekday: 'long', 
                    month: 'long', 
                    day: 'numeric' 
                  })}
                </Badge>
              </div>

              {/* THE MARKET BRIEF */}
              <MarketBriefDisplay brief={latestBrief} />
            </div>
          ) : (
            <div className="text-center py-20">
              <div className="space-y-6">
                <div className="text-8xl animate-bounce">🎣</div>
                <h3 className="text-2xl font-bold text-primary font-pixel">First Brief Loading...</h3>
                <p className="text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
                  The inaugural XRay Market Brief is being prepared. Captain XRay is scanning the waters.
                </p>
                {isVip && (
                  <Button 
                    onClick={generateNewBrief} 
                    disabled={isGenerating}
                    className="btn-hero mt-6"
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

        {/* Bottom Section - Archive and Footer */}
        <div className="mt-16 space-y-12">
          {/* Past Briefs Archive */}
          {briefs && briefs.length > 1 && (
            <BriefArchive briefs={briefs.slice(1)} />
          )}

          {/* Footer */}
          <Card className="xr-card bg-muted/20">
            <CardContent className="p-6">
              <div className="text-center space-y-4">
                <div className="space-y-2">
                  <h3 className="text-xl font-bold text-primary font-pixel">About the XRay Brief</h3>
                  <p className="text-base text-muted-foreground max-w-2xl mx-auto leading-relaxed">
                    Crypto-first market analysis delivered twice daily. Numbers before narratives, always.
                  </p>
                </div>
                
                <div className="flex items-center justify-center gap-4 text-sm text-muted-foreground">
                  <Badge variant="outline" className="font-pixel">@XRayCryptoX</Badge>
                  <Badge variant="outline" className="font-pixel">@XRayMetaX</Badge>
                </div>
                
                <Alert className="max-w-xl mx-auto">
                  <AlertDescription className="text-center text-sm">
                    ⚠️ <strong>Not financial advice.</strong> For educational purposes only.
                  </AlertDescription>
                </Alert>
              </div>
            </CardContent>
          </Card>
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