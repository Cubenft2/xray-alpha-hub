import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { RefreshCw, Sparkles, Target, Activity, Eye } from 'lucide-react';
import { toast } from 'sonner';
import { FinancialDisclaimer } from '@/components/FinancialDisclaimer';
import { MarketBriefDisplay } from '@/components/MarketBriefDisplay';

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
      
      {/* XRay Market Brief Homepage */}
      <div className="container mx-auto px-4 py-8">
        {/* Hero Introduction */}
        <div className="text-center mb-12 space-y-6">
          <div className="inline-flex items-center gap-3 px-6 py-3 bg-primary/10 rounded-full border border-primary/30 mb-4">
            <span className="text-3xl animate-bounce">🎣</span>
            <span className="font-bold text-primary text-xl font-pixel tracking-wide">XRay Market Brief</span>
          </div>
          <h1 className="text-4xl md:text-6xl font-black xr-gradient-text mb-4 font-pixel">
            Command Center for Crypto Intelligence
          </h1>
          <p className="text-xl text-muted-foreground max-w-4xl mx-auto leading-relaxed font-medium">
            Twice-daily briefings that cut through the noise. From Bitcoin and Ethereum to Layer-2s, DeFi blue-chips, 
            memecoins, ETF flows, and the macro events that move markets. If it shifts the tide, it's here.
          </p>
          <div className="flex items-center justify-center gap-4 text-sm text-muted-foreground font-pixel">
            <span>📅 Pre-Market & Post-Market</span>
            <span>•</span>
            <span>🔄 Live Data</span>
            <span>•</span>
            <span>📊 Interactive Charts</span>
          </div>
        </div>

        {/* Main Brief Display */}
        <div className="space-y-12">
          {briefsLoading ? (
            <div className="text-center py-32">
              <div className="relative">
                <RefreshCw className="h-16 w-16 animate-spin mx-auto mb-8 text-primary" />
                <div className="absolute inset-0 rounded-full border-4 border-primary/20 animate-pulse"></div>
              </div>
              <h3 className="text-2xl font-bold text-primary mb-4 font-pixel">Gathering Market Intelligence</h3>
              <p className="text-lg text-muted-foreground max-w-md mx-auto">
                Fresh briefing incoming... scanning the waters for actionable insights.
              </p>
            </div>
          ) : latestBrief ? (
            <div className="space-y-8">
              <div className="text-center mb-8">
                <Badge variant="outline" className="text-sm font-pixel mb-4">
                  🚨 LATEST BRIEF — {new Date(latestBrief.published_at).toLocaleDateString()}
                </Badge>
                <h2 className="text-2xl font-bold text-foreground mb-2">
                  Today's Market Intelligence
                </h2>
                <p className="text-muted-foreground">
                  Fresh analysis from the trading docks
                </p>
              </div>
              <MarketBriefDisplay brief={latestBrief} />
            </div>
          ) : (
            <div className="text-center py-32">
              <div className="space-y-6">
                <div className="text-8xl animate-bounce">🎣</div>
                <h3 className="text-3xl font-bold text-primary font-pixel">First Brief Loading...</h3>
                <p className="text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
                  The inaugural XRay Market Brief is being prepared. Captain XRay is scanning the waters 
                  for the most important market developments to bring you.
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

        {/* Previous Briefs Archive */}
        {briefs && briefs.length > 1 && (
          <div className="mt-20">
            <Card className="xr-card-elevated">
              <CardHeader className="text-center">
                <CardTitle className="text-2xl font-bold flex items-center justify-center gap-3 font-pixel">
                  <span className="text-3xl">📚</span>
                  Brief Archive — Recent Intelligence
                </CardTitle>
                <CardDescription className="text-base">
                  Navigate past briefings from the XRay command center
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {briefs.slice(1, 7).map((brief) => (
                    <Card key={brief.id} className="xr-card hover:xr-glow-primary transition-all duration-300 cursor-pointer group">
                      <CardContent className="p-5">
                        <div className="space-y-3">
                          <div className="flex items-start justify-between gap-2">
                            <Badge variant="outline" className="text-xs font-pixel shrink-0">
                              {brief.brief_type.toUpperCase()}
                            </Badge>
                            <Badge variant="secondary" className="text-xs">
                              {new Date(brief.published_at).toLocaleDateString()}
                            </Badge>
                          </div>
                          
                          <h4 className="font-bold text-lg group-hover:text-primary transition-colors line-clamp-2">
                            {brief.title}
                          </h4>
                          
                          <p className="text-sm text-muted-foreground line-clamp-3 leading-relaxed">
                            {brief.executive_summary}
                          </p>
                          
                          <div className="flex items-center justify-between pt-2">
                            <div className="flex items-center gap-2">
                              <Eye className="h-3 w-3 text-muted-foreground" />
                              <span className="text-xs text-muted-foreground">{brief.view_count}</span>
                            </div>
                            {brief.sentiment_score && (
                              <Badge variant={brief.sentiment_score > 0 ? 'default' : 'destructive'} className="text-xs">
                                {brief.sentiment_score > 0 ? '+' : ''}{brief.sentiment_score.toFixed(1)}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
                
                <div className="text-center mt-8">
                  <p className="text-sm text-muted-foreground font-pixel">
                    📊 All briefs stored for 30 days • Interactive data • Source-verified intelligence
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Hidden Admin Controls - Only for VIP */}
        {isVip && (
          <div className="fixed bottom-4 right-4 space-y-2 opacity-30 hover:opacity-100 transition-opacity">
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
            {customTopic && (
              <div className="flex gap-1">
                <Input
                  placeholder="Custom topic..."
                  value={customTopic}
                  onChange={(e) => setCustomTopic(e.target.value)}
                  className="text-xs h-8 w-32"
                  onKeyDown={(e) => e.key === 'Enter' && customTopic.trim() && generateCustomBrief()}
                />
                <Button 
                  onClick={generateCustomBrief}
                  disabled={isGenerating || !customTopic.trim()}
                  size="sm"
                  variant="outline"
                >
                  <Target className="h-3 w-3" />
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Index;