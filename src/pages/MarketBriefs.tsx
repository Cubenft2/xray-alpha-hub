import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { TrendingUp, TrendingDown, Activity, Calendar, Eye, RefreshCw } from 'lucide-react';
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

interface SocialSentiment {
  id: string;
  asset_symbol: string;
  asset_name: string;
  sentiment_score: number;
  social_volume: number;
  social_volume_24h_change: number;
  galaxy_score: number;
  trending_rank: number;
  data_timestamp: string;
}

interface MarketAlert {
  id: string;
  alert_type: string;
  asset_symbol: string;
  asset_name: string;
  trigger_value: number;
  current_value: number;
  alert_message: string;
  severity: string;
  created_at: string;
}

export default function MarketBriefs() {
  const [isGenerating, setIsGenerating] = useState(false);

  const { data: briefs, isLoading: briefsLoading, refetch: refetchBriefs } = useQuery({
    queryKey: ['market_briefs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('market_briefs')
        .select('*')
        .eq('is_published', true)
        .order('published_at', { ascending: false })
        .limit(10);
      
      if (error) throw error;
      return data as MarketBrief[];
    }
  });

  const { data: socialSentiment, isLoading: sentimentLoading } = useQuery({
    queryKey: ['social_sentiment'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('social_sentiment')
        .select('*')
        .order('data_timestamp', { ascending: false })
        .limit(20);
      
      if (error) throw error;
      return data as SocialSentiment[];
    }
  });

  const { data: marketAlerts, isLoading: alertsLoading } = useQuery({
    queryKey: ['market_alerts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('market_alerts')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(10);
      
      if (error) throw error;
      return data as MarketAlert[];
    }
  });

  const generateNewBrief = async () => {
    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('market-intelligence');
      
      if (error) throw error;
      
      toast.success('Market intelligence updated successfully!');
      refetchBriefs();
    } catch (error) {
      console.error('Error generating brief:', error);
      toast.error('Failed to generate market intelligence');
    } finally {
      setIsGenerating(false);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'destructive';
      case 'high': return 'destructive';
      case 'medium': return 'secondary';
      default: return 'outline';
    }
  };

  const getSentimentIcon = (score: number) => {
    if (score > 20) return <TrendingUp className="h-4 w-4 text-green-500" />;
    if (score < -20) return <TrendingDown className="h-4 w-4 text-red-500" />;
    return <Activity className="h-4 w-4 text-yellow-500" />;
  };

  return (
    <div className="container mx-auto p-6 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold">🎣 Market Intelligence Command Center</h1>
          <p className="text-muted-foreground text-lg mt-2">
            Real-time crypto market briefs powered by AI, social sentiment & fishing wisdom
          </p>
        </div>
        <Button 
          onClick={generateNewBrief} 
          disabled={isGenerating}
          className="bg-primary hover:bg-primary/90"
        >
          {isGenerating ? (
            <>
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              Generating...
            </>
          ) : (
            'Generate Intelligence'
          )}
        </Button>
      </div>

      <Tabs defaultValue="briefs" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="briefs">📋 Market Briefs</TabsTrigger>
          <TabsTrigger value="sentiment">📊 Social Radar</TabsTrigger>
          <TabsTrigger value="alerts">🚨 Whale Watch</TabsTrigger>
          <TabsTrigger value="dashboard">🎯 Command Center</TabsTrigger>
        </TabsList>

        <TabsContent value="briefs" className="space-y-6">
          <div className="grid gap-6">
            {briefsLoading ? (
              <div className="text-center py-12">
                <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4" />
                <p>Loading market briefs...</p>
              </div>
            ) : briefs && briefs.length > 0 ? (
              briefs.map((brief) => (
                <Card key={brief.id} className="xr-card">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-xl">{brief.title}</CardTitle>
                        <CardDescription className="mt-2">
                          {brief.executive_summary}
                        </CardDescription>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">{brief.brief_type}</Badge>
                        {brief.sentiment_score && (
                          <Badge variant={brief.sentiment_score > 0 ? 'default' : 'destructive'}>
                            {brief.sentiment_score > 0 ? '🔥' : '🥶'} {brief.sentiment_score.toFixed(1)}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {brief.content_sections?.ai_content && (
                        <div className="prose prose-sm max-w-none">
                          <div className="whitespace-pre-wrap">
                            {brief.content_sections.ai_content}
                          </div>
                        </div>
                      )}
                      
                      {brief.featured_assets && brief.featured_assets.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          <span className="text-sm font-medium">Featured Assets:</span>
                          {brief.featured_assets.map((asset) => (
                            <Badge key={asset} variant="outline">{asset}</Badge>
                          ))}
                        </div>
                      )}

                      {brief.stoic_quote && (
                        <Alert>
                          <AlertDescription className="italic">
                            🌊 Wisdom for the Waters: "{brief.stoic_quote}"
                          </AlertDescription>
                        </Alert>
                      )}

                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-4 w-4" />
                          {new Date(brief.published_at).toLocaleDateString()}
                        </div>
                        <div className="flex items-center gap-1">
                          <Eye className="h-4 w-4" />
                          {brief.view_count} views
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : (
              <Card className="text-center py-12">
                <CardContent>
                  <p className="text-muted-foreground">No market briefs available yet.</p>
                  <Button onClick={generateNewBrief} className="mt-4">
                    Generate Your First Brief
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="sentiment" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sentimentLoading ? (
              <div className="col-span-full text-center py-12">
                <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4" />
                <p>Loading social sentiment data...</p>
              </div>
            ) : socialSentiment && socialSentiment.length > 0 ? (
              socialSentiment.map((sentiment) => (
                <Card key={sentiment.id} className="xr-card">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">{sentiment.asset_symbol}</CardTitle>
                      {getSentimentIcon(sentiment.sentiment_score)}
                    </div>
                    <CardDescription>{sentiment.asset_name}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm">Sentiment:</span>
                      <Badge variant={sentiment.sentiment_score > 0 ? 'default' : 'destructive'}>
                        {sentiment.sentiment_score.toFixed(1)}
                      </Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm">Social Volume:</span>
                      <span className="text-sm font-medium">{sentiment.social_volume.toLocaleString()}</span>
                    </div>
                    {sentiment.galaxy_score > 0 && (
                      <div className="flex justify-between">
                        <span className="text-sm">Galaxy Score:</span>
                        <span className="text-sm font-medium">{sentiment.galaxy_score.toFixed(1)}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-sm">Trending Rank:</span>
                      <Badge variant="outline">#{sentiment.trending_rank}</Badge>
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : (
              <div className="col-span-full text-center py-12">
                <p className="text-muted-foreground">No social sentiment data available.</p>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="alerts" className="space-y-6">
          <div className="space-y-4">
            {alertsLoading ? (
              <div className="text-center py-12">
                <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4" />
                <p>Loading market alerts...</p>
              </div>
            ) : marketAlerts && marketAlerts.length > 0 ? (
              marketAlerts.map((alert) => (
                <Alert key={alert.id} className="xr-card">
                  <Activity className="h-4 w-4" />
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-semibold">{alert.asset_name} ({alert.asset_symbol})</h4>
                      <AlertDescription>{alert.alert_message}</AlertDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={getSeverityColor(alert.severity) as any}>
                        {alert.severity.toUpperCase()}
                      </Badge>
                      <span className="text-sm text-muted-foreground">
                        {new Date(alert.created_at).toLocaleTimeString()}
                      </span>
                    </div>
                  </div>
                </Alert>
              ))
            ) : (
              <Alert>
                <Activity className="h-4 w-4" />
                <AlertDescription>
                  All quiet in the waters. No unusual market activity detected.
                </AlertDescription>
              </Alert>
            )}
          </div>
        </TabsContent>

        <TabsContent value="dashboard" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Card className="xr-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  📊 Social Radar
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {socialSentiment?.length || 0}
                </div>
                <p className="text-muted-foreground">Assets Tracked</p>
              </CardContent>
            </Card>

            <Card className="xr-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  🚨 Active Alerts
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {marketAlerts?.length || 0}
                </div>
                <p className="text-muted-foreground">Whale Movements</p>
              </CardContent>
            </Card>

            <Card className="xr-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  📋 Market Briefs
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {briefs?.length || 0}
                </div>
                <p className="text-muted-foreground">Intelligence Reports</p>
              </CardContent>
            </Card>
          </div>

          <Card className="xr-card">
            <CardHeader>
              <CardTitle>🎣 Captain's Log</CardTitle>
              <CardDescription>
                Your comprehensive crypto market intelligence system powered by AI
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="prose prose-sm max-w-none">
                <p>
                  <strong>Let's talk about something...</strong> This ain't your average market tracker. 
                  We're pulling in social sentiment from LunarCrush, price data from CoinGecko, 
                  and using OpenAI to weave it all together into digestible market intelligence.
                </p>
                <p>
                  Like a good fisherman reads the water, we read the market sentiment. 
                  When the social volume spikes 100%+ or sentiment hits extreme levels, 
                  our whale watch alerts you before the market moves.
                </p>
                <p>
                  <strong>Features Active:</strong>
                </p>
                <ul>
                  <li>🤖 AI-powered market briefs with fishing analogies</li>
                  <li>📊 Real-time social sentiment tracking</li>
                  <li>🚨 Automated whale movement alerts</li>
                  <li>💎 Price correlation analysis</li>
                  <li>🌊 Stoic wisdom for daily perspective</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}