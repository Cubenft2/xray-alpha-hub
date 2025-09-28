import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { RefreshCw, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

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

  const { data: briefs, isLoading: briefsLoading, refetch: refetchBriefs } = useQuery({
    queryKey: ['market_briefs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('market_briefs')
        .select('*')
        .eq('is_published', true)
        .order('published_at', { ascending: false })
        .limit(1);
      
      if (error) throw error;
      return data as MarketBrief[];
    }
  });

  const latestBrief = briefs && briefs.length > 0 ? briefs[0] : null;

  const generateNewBrief = async () => {
    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-brief');
      
      if (error) throw error;
      
      toast.success('Fresh market brief generated!');
      refetchBriefs();
    } catch (error) {
      console.error('Error generating brief:', error);
      toast.error('Failed to generate market brief');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-primary mb-4">XRay Market Brief</h1>
          <p className="text-muted-foreground">Your daily crypto market intelligence</p>
        </div>

        {/* Main Content */}
        {briefsLoading ? (
          <div className="text-center py-20">
            <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
            <p className="text-muted-foreground">Loading latest brief...</p>
          </div>
        ) : latestBrief ? (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>{latestBrief.title}</CardTitle>
                <Badge>{new Date(latestBrief.published_at).toLocaleDateString()}</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold mb-2">Executive Summary</h3>
                  <p className="text-muted-foreground">{latestBrief.executive_summary}</p>
                </div>
                
                {latestBrief.content_sections && (
                  <div className="space-y-4">
                    {Object.entries(latestBrief.content_sections).map(([key, value]) => (
                      <div key={key}>
                        <h3 className="text-lg font-semibold mb-2 capitalize">{key.replace('_', ' ')}</h3>
                        <div className="text-muted-foreground whitespace-pre-wrap">{String(value)}</div>
                      </div>
                    ))}
                  </div>
                )}

                {latestBrief.stoic_quote && (
                  <div className="bg-muted p-4 rounded-lg">
                    <p className="italic text-center">"{latestBrief.stoic_quote}"</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="text-center py-20">
            <p className="text-muted-foreground mb-4">No briefs available yet</p>
            <Button onClick={generateNewBrief} disabled={isGenerating}>
              {isGenerating ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4 mr-2" />
              )}
              Generate Brief
            </Button>
          </div>
        )}

        {/* Generate Button */}
        <div className="text-center mt-8">
          <Button onClick={generateNewBrief} disabled={isGenerating} variant="outline">
            {isGenerating ? (
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Generate New Brief
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Index;