import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { RefreshCw, Sparkles, Target, Activity } from 'lucide-react';
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
    <div className="py-6">
      <FinancialDisclaimer />
      
      <div className="container mx-auto p-6 space-y-8">
        {/* Header with controls */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold xr-gradient-text">🎣 Captain XRay's Market Brief</h1>
            <p className="text-muted-foreground mt-1">
              Daily crypto intelligence with interactive charts & deep research
            </p>
          </div>
          <div className="flex gap-3">
            {isVip && (
              <Button 
                onClick={generateNewBrief} 
                disabled={isGenerating}
                size="sm"
                variant="outline"
              >
                {isGenerating ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Fresh Brief
                  </>
                )}
              </Button>
            )}
          </div>
        </div>

        {/* Custom Topic Generator - Compact */}
        {isVip && (
          <Card className="xr-card border-primary/20">
            <CardContent className="p-4">
              <div className="flex gap-3 items-center">
                <Target className="h-4 w-4 text-primary flex-shrink-0" />
                <Input
                  placeholder="Generate custom brief: Hyperliquidity, DeFi trends, Layer 2..."
                  value={customTopic}
                  onChange={(e) => setCustomTopic(e.target.value)}
                  className="flex-1"
                  onKeyDown={(e) => e.key === 'Enter' && customTopic.trim() && generateCustomBrief()}
                />
                <Button 
                  onClick={generateCustomBrief}
                  disabled={isGenerating || !customTopic.trim()}
                  size="sm"
                >
                  Generate
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Main Brief Display */}
        <div className="space-y-8">
          {briefsLoading ? (
            <div className="text-center py-20">
              <RefreshCw className="h-12 w-12 animate-spin mx-auto mb-6 text-primary" />
              <p className="text-lg">Loading today's market brief...</p>
              <p className="text-sm text-muted-foreground mt-2">Gathering fresh market intelligence</p>
            </div>
          ) : latestBrief ? (
            <MarketBriefDisplay brief={latestBrief} />
          ) : (
            <Card className="text-center py-20 xr-card border-dashed">
              <CardContent>
                <div className="space-y-4">
                  <div className="text-6xl">🎣</div>
                  <h3 className="text-xl font-semibold">No market brief available yet</h3>
                  <p className="text-muted-foreground max-w-md mx-auto">
                    Generate your first comprehensive market brief with AI-powered analysis, 
                    interactive charts, and Captain XRay's signature fishing wisdom.
                  </p>
                  {isVip && (
                    <Button onClick={generateNewBrief} className="mt-6" disabled={isGenerating}>
                      {isGenerating ? (
                        <>
                          <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                          Generating Brief...
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-4 w-4 mr-2" />
                          Generate First Brief
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Previous Briefs - Compact List */}
        {briefs && briefs.length > 1 && (
          <Card className="xr-card">
            <CardHeader>
              <CardTitle className="text-lg">📚 Previous Briefs</CardTitle>
              <CardDescription>
                Recent market intelligence reports
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {briefs.slice(1, 4).map((brief) => (
                  <div key={brief.id} className="flex items-center justify-between p-3 rounded-lg border bg-background/50 hover:bg-background/80 transition-colors">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium truncate">{brief.title}</h4>
                      <p className="text-sm text-muted-foreground truncate">{brief.executive_summary}</p>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      <Badge variant="outline" className="text-xs">
                        {new Date(brief.published_at).toLocaleDateString()}
                      </Badge>
                      {brief.sentiment_score && (
                        <Badge variant={brief.sentiment_score > 0 ? 'default' : 'destructive'} className="text-xs">
                          {brief.sentiment_score.toFixed(1)}
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default Index;