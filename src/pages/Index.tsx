import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { TrendingUp, TrendingDown, Activity, Calendar, Eye, RefreshCw, Sparkles, Target } from 'lucide-react';
import { toast } from 'sonner';
import { TradingViewChart } from '@/components/TradingViewChart';
import { FinancialDisclaimer } from '@/components/FinancialDisclaimer';

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

const Index = () => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [customTopic, setCustomTopic] = useState('');
  const [isVip, setIsVip] = useState(true); // Set to true for private access

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
    if (!isVip) {
      toast.error('AI Brief generation is only available for VIP users');
      return;
    }

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

  const getChartSymbol = (asset: string) => {
    const upperAsset = asset.toUpperCase();
    const cryptoMappings: { [key: string]: string } = {
      'BTC': 'BINANCE:BTCUSDT',
      'BITCOIN': 'BINANCE:BTCUSDT',
      'ETH': 'BINANCE:ETHUSDT',
      'ETHEREUM': 'BINANCE:ETHUSDT',
      'SOL': 'BINANCE:SOLUSDT',
      'SOLANA': 'BINANCE:SOLUSDT',
      'ADA': 'BINANCE:ADAUSDT',
      'CARDANO': 'BINANCE:ADAUSDT',
      'MATIC': 'BINANCE:MATICUSDT',
      'POLYGON': 'BINANCE:MATICUSDT',
      'AVAX': 'BINANCE:AVAXUSDT',
      'AVALANCHE': 'BINANCE:AVAXUSDT',
      'LINK': 'BINANCE:LINKUSDT',
      'CHAINLINK': 'BINANCE:LINKUSDT',
    };
    
    return cryptoMappings[upperAsset] || `BINANCE:${upperAsset}USDT`;
  };

  return (
    <div className="py-6">
      <FinancialDisclaimer />
      
      <div className="container mx-auto p-6 space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold xr-gradient-text">🎣 XRay Market Intelligence Command Center</h1>
            <p className="text-muted-foreground text-lg mt-2">
              Your private AI-powered crypto market briefs with interactive charts & deep research
            </p>
          </div>
          <div className="flex gap-3">
            {isVip && (
              <>
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
                    <>
                      <Sparkles className="h-4 w-4 mr-2" />
                      Generate AI Brief
                    </>
                  )}
                </Button>
              </>
            )}
          </div>
        </div>

        {isVip && (
          <Card className="xr-card border-primary/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                🎯 Custom Brief Generator (VIP Only)
              </CardTitle>
              <CardDescription>
                Generate a personalized market brief about any crypto topic
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-3">
                <Input
                  placeholder="e.g., Hyperliquidity, DeFi trends, Layer 2 analysis..."
                  value={customTopic}
                  onChange={(e) => setCustomTopic(e.target.value)}
                  className="flex-1"
                />
                <Button 
                  onClick={generateCustomBrief}
                  disabled={isGenerating || !customTopic.trim()}
                >
                  Generate
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

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
                      <div className="space-y-6">
                        {brief.content_sections?.ai_content && (
                          <div className="prose prose-sm max-w-none">
                            <div className="whitespace-pre-wrap">
                              {brief.content_sections.ai_content}
                            </div>
                          </div>
                        )}
                        
                        {brief.featured_assets && brief.featured_assets.length > 0 && (
                          <div className="space-y-4">
                            <div className="flex flex-wrap gap-2">
                              <span className="text-sm font-medium">Featured Assets:</span>
                              {brief.featured_assets.map((asset) => (
                                <Badge key={asset} variant="outline">{asset}</Badge>
                              ))}
                            </div>
                            
                            {/* Interactive Charts for Featured Assets */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                              {brief.featured_assets.slice(0, 4).map((asset) => (
                                <div key={asset} className="space-y-2">
                                  <h4 className="text-sm font-medium">{asset} Chart</h4>
                                  <TradingViewChart 
                                    symbol={getChartSymbol(asset)} 
                                    height="300px"
                                    className="rounded-lg border"
                                  />
                                </div>
                              ))}
                            </div>
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
                    {isVip && (
                      <Button onClick={generateNewBrief} className="mt-4">
                        Generate Your First Brief
                      </Button>
                    )}
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
                <CardTitle>🎣 Captain's Command Center</CardTitle>
                <CardDescription>
                  Your personal crypto market intelligence system with interactive analysis
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="prose prose-sm max-w-none">
                  <p>
                    <strong>Welcome to your private intelligence hub.</strong> This system pulls real-time data from multiple sources:
                  </p>
                  <ul>
                    <li>🤖 <strong>AI-Powered Research Briefs</strong> - Deep market analysis with OpenAI GPT-5</li>
                    <li>📊 <strong>Interactive TradingView Charts</strong> - Real-time price action for featured assets</li>
                    <li>🔥 <strong>Social Sentiment Tracking</strong> - LunarCrush social intelligence</li>
                    <li>🚨 <strong>Whale Movement Alerts</strong> - Large volume & sentiment spike detection</li>
                    <li>🎯 <strong>Custom Topic Generation</strong> - Personalized briefs on any crypto subject</li>
                    <li>🌊 <strong>Stoic Market Wisdom</strong> - Philosophical perspective for trading psychology</li>
                  </ul>
                  <p>
                    <strong>VIP Features Active:</strong> Private AI generation, custom topic briefs, unlimited research depth, interactive charts integration.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Index;
