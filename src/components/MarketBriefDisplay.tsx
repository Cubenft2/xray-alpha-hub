import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { TradingViewChart } from '@/components/TradingViewChart';
import { MiniChart } from '@/components/MiniChart';
import { Calendar, Eye, TrendingUp, TrendingDown, Activity, Target, Waves, Compass } from 'lucide-react';

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

interface MarketBriefDisplayProps {
  brief: MarketBrief;
}

export function MarketBriefDisplay({ brief }: MarketBriefDisplayProps) {
  const getChartSymbol = (asset: string) => {
    const upperAsset = asset.toUpperCase();
    const cryptoMappings: { [key: string]: string } = {
      'BTC': 'BINANCE:BTCUSDT', 'BITCOIN': 'BINANCE:BTCUSDT',
      'ETH': 'BINANCE:ETHUSDT', 'ETHEREUM': 'BINANCE:ETHUSDT',
      'SOL': 'BINANCE:SOLUSDT', 'SOLANA': 'BINANCE:SOLUSDT',
      'ADA': 'BINANCE:ADAUSDT', 'CARDANO': 'BINANCE:ADAUSDT',
      'MATIC': 'BINANCE:MATICUSDT', 'POLYGON': 'BINANCE:MATICUSDT',
      'AVAX': 'BINANCE:AVAXUSDT', 'AVALANCHE': 'BINANCE:AVAXUSDT',
      'LINK': 'BINANCE:LINKUSDT', 'CHAINLINK': 'BINANCE:LINKUSDT',
      'XRP': 'BINANCE:XRPUSDT', 'DOGE': 'BINANCE:DOGEUSDT', 'DOGECOIN': 'BINANCE:DOGEUSDT',
      'ARB': 'BINANCE:ARBUSDT', 'ARBITRUM': 'BINANCE:ARBUSDT',
      'OP': 'BINANCE:OPUSDT', 'OPTIMISM': 'BINANCE:OPUSDT',
      'DOT': 'BINANCE:DOTUSDT', 'POLKADOT': 'BINANCE:DOTUSDT',
      'ATOM': 'BINANCE:ATOMUSDT', 'COSMOS': 'BINANCE:ATOMUSDT',
      'INJ': 'BINANCE:INJUSDT', 'INJECTIVE': 'BINANCE:INJUSDT',
    };
    return cryptoMappings[upperAsset] || `BINANCE:${upperAsset}USDT`;
  };

  const getFearGreedColor = (score: number) => {
    if (score >= 75) return 'text-success';
    if (score >= 55) return 'text-warning';
    if (score >= 45) return 'text-muted-foreground';
    if (score >= 25) return 'text-warning';
    return 'text-destructive';
  };

  const getFearGreedLabel = (score: number) => {
    if (score >= 75) return 'Extreme Greed';
    if (score >= 55) return 'Greed';
    if (score >= 45) return 'Neutral';
    if (score >= 25) return 'Fear';
    return 'Extreme Fear';
  };

  // Parse the AI content to extract sections
  const parseContent = (content: string) => {
    const sections = content.split(/\n(?=\*\*[^*]+\*\*)/);
    return sections.map((section, index) => {
      if (section.trim().startsWith('**') && section.includes('**')) {
        const titleMatch = section.match(/^\*\*([^*]+)\*\*/);
        const title = titleMatch ? titleMatch[1] : '';
        const body = section.replace(/^\*\*[^*]+\*\*\n?/, '').trim();
        return { title, body, isSection: true };
      }
      return { title: '', body: section.trim(), isSection: false };
    }).filter(item => item.body);
  };

  const contentSections = brief.content_sections?.ai_content 
    ? parseContent(brief.content_sections.ai_content)
    : [];

  return (
    <div className="max-w-6xl mx-auto space-y-12">
      {/* XRay Brief Header */}
      <div className="text-center space-y-6">
        <div className="flex items-center justify-center gap-3 mb-6">
          <Badge variant="outline" className="text-sm font-pixel uppercase tracking-wider">
            🎣 {brief.brief_type.replace('_', '-')} Brief
          </Badge>
          <Badge variant="secondary" className="text-sm">
            <Calendar className="h-4 w-4 mr-2" />
            {new Date(brief.published_at).toLocaleDateString('en-US', { 
              weekday: 'long', 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })}
          </Badge>
        </div>
        
        <h1 className="text-5xl font-black xr-gradient-text mb-6 font-pixel tracking-wide">
          {brief.title}
        </h1>
        
        <div className="max-w-3xl mx-auto">
          <p className="text-xl text-muted-foreground leading-relaxed font-medium">
            {brief.executive_summary}
          </p>
        </div>
      </div>

      {/* Market Sentiment Dashboard */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Fear & Greed Gauge */}
        <Card className="xr-card">
          <CardHeader className="text-center">
            <CardTitle className="flex items-center justify-center gap-2 text-lg">
              <Activity className="h-5 w-5 text-primary" />
              Fear & Greed
            </CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <div className="relative w-32 h-32 mx-auto mb-4">
              <div className="absolute inset-0 rounded-full border-8 border-muted"></div>
              {brief.market_data?.fear_greed_score && (
                <div 
                  className="absolute inset-0 rounded-full border-8 border-t-primary transform -rotate-90 transition-all duration-1000"
                  style={{ 
                    borderImage: `conic-gradient(hsl(var(--primary)) ${brief.market_data.fear_greed_score * 3.6}deg, transparent 0deg) 1`
                  }}
                ></div>
              )}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <div className="text-2xl font-bold text-primary">
                    {brief.market_data?.fear_greed_score || 50}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {getFearGreedLabel(brief.market_data?.fear_greed_score || 50)}
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* FOMO Score */}
        <Card className="xr-card">
          <CardHeader className="text-center">
            <CardTitle className="flex items-center justify-center gap-2 text-lg">
              <Target className="h-5 w-5 text-warning" />
              FOMO Score
            </CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <div className="text-4xl font-bold text-warning mb-2">
              {brief.market_data?.fomo_score || 45}
            </div>
            <div className="text-sm text-muted-foreground mb-4">
              {(brief.market_data?.fomo_score || 45) >= 70 ? 'Frothy' : 
               (brief.market_data?.fomo_score || 45) >= 50 ? 'Hot' : 
               (brief.market_data?.fomo_score || 45) >= 25 ? 'Warming' : 'Calm'}
            </div>
            <Progress 
              value={brief.market_data?.fomo_score || 45} 
              className="w-full h-2"
            />
          </CardContent>
        </Card>

        {/* Market Sentiment */}
        <Card className="xr-card">
          <CardHeader className="text-center">
            <CardTitle className="flex items-center justify-center gap-2 text-lg">
              <Compass className="h-5 w-5 text-accent" />
              Sentiment
            </CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            {brief.sentiment_score && (
              <>
                <div className={`text-4xl font-bold mb-2 ${brief.sentiment_score > 0 ? 'text-success' : 'text-destructive'}`}>
                  {brief.sentiment_score > 0 ? <TrendingUp className="h-8 w-8 mx-auto mb-2" /> : <TrendingDown className="h-8 w-8 mx-auto mb-2" />}
                  {brief.sentiment_score.toFixed(1)}
                </div>
                <div className="text-sm text-muted-foreground">
                  {brief.sentiment_score > 0.5 ? 'Bullish' : brief.sentiment_score < -0.5 ? 'Bearish' : 'Neutral'}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Featured Assets Charts - Interactive Market Pulse */}
      {brief.featured_assets && brief.featured_assets.length > 0 && (
        <Card className="xr-card border-primary/30 bg-gradient-to-br from-primary/5 to-accent/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-3 text-2xl">
              <Waves className="h-6 w-6 text-primary" />
              Chart of the Tide — Market Pulse
            </CardTitle>
            <CardDescription className="text-base">
              Interactive charts for the assets driving today's market narrative. Click any chart for fullscreen analysis.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {brief.featured_assets.slice(0, 6).map((asset) => (
                <div key={asset} className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-lg xr-pixel-text">{asset}</h4>
                    <Badge variant="outline" className="font-pixel">{asset}/USDT</Badge>
                  </div>
                  <div className="h-64 rounded-lg border-2 border-primary/20 bg-background/80 hover:border-primary/40 transition-all duration-300 hover:shadow-lg">
                    <MiniChart 
                      symbol={getChartSymbol(asset)}
                      theme="light"
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* XRay Market Brief - Signature Opener */}
      <Card className="xr-card-elevated border-accent/30">
        <CardContent className="p-10">
          <div className="mb-8 text-center">
            <div className="inline-flex items-center gap-3 px-6 py-3 bg-accent/10 rounded-full border border-accent/30 mb-6">
              <span className="text-2xl">🎣</span>
              <span className="font-bold text-accent text-lg font-pixel">XRay Market Brief</span>
            </div>
          </div>
          
          <div className="prose prose-xl max-w-none text-foreground">
            {/* Signature Opener */}
            <div className="mb-12 p-6 bg-primary/5 border-l-4 border-primary rounded-r-lg">
              <p className="text-2xl font-bold text-primary mb-2 font-pixel">
                "Let's talk about something."
              </p>
              <p className="text-lg text-muted-foreground italic">
                {brief.content_sections?.opener || "The tide's changing, and there's more beneath the surface than most are seeing."}
              </p>
            </div>

            {/* Brief Content Sections */}
            {contentSections.map((section, index) => (
              <div key={index} className="mb-10">
                {section.isSection && section.title && (
                  <h2 className="text-3xl font-bold mb-6 text-foreground pb-3 border-b-2 border-primary/20 font-pixel">
                    {section.title}
                  </h2>
                )}
                <div className="text-lg text-foreground/90 leading-relaxed whitespace-pre-wrap font-medium">
                  {section.body}
                </div>
              </div>
            ))}

            {/* Last Word Section */}
            {brief.content_sections?.last_word && (
              <div className="mt-12 p-6 bg-accent/5 border border-accent/20 rounded-lg">
                <h3 className="text-2xl font-bold text-accent mb-4 flex items-center gap-2 font-pixel">
                  <Compass className="h-6 w-6" />
                  Last Word
                </h3>
                <p className="text-lg text-foreground italic leading-relaxed">
                  {brief.content_sections.last_word}
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Wisdom for the Waters */}
      {brief.stoic_quote && (
        <Card className="xr-card border-accent/40 bg-gradient-to-r from-accent/10 to-primary/10">
          <CardContent className="p-8 text-center">
            <div className="mb-4">
              <h3 className="text-2xl font-bold text-accent mb-2 flex items-center justify-center gap-2 font-pixel">
                <Waves className="h-6 w-6" />
                Wisdom for the Waters
              </h3>
            </div>
            <blockquote className="text-xl italic text-foreground/90 font-medium leading-relaxed">
              "{brief.stoic_quote}"
            </blockquote>
            <div className="mt-4 text-sm text-muted-foreground">
              — Daily wisdom from the trading docks
            </div>
          </CardContent>
        </Card>
      )}

      {/* Market Data Summary */}
      {brief.market_data?.top_assets && (
        <Card className="xr-card">
          <CardHeader>
            <CardTitle>📊 Market Data Snapshot</CardTitle>
            <CardDescription>
              Real-time data from CoinGecko & LunarCrush used in this brief
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {brief.market_data.top_assets.slice(0, 6).map((asset: any) => (
                <div key={asset.symbol} className="p-4 rounded-lg border bg-background/50">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h4 className="font-semibold">{asset.symbol}</h4>
                      <p className="text-sm text-muted-foreground">{asset.name}</p>
                    </div>
                    <Badge variant={asset.change_24h > 0 ? 'default' : 'destructive'} className="text-xs">
                      {asset.change_24h > 0 ? '+' : ''}{asset.change_24h.toFixed(2)}%
                    </Badge>
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span>Price:</span>
                      <span className="font-medium">${asset.price.toFixed(4)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Volume:</span>
                      <span className="font-medium">${(asset.volume/1e9).toFixed(2)}B</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* XRay Brief Footer */}
      <Card className="xr-card bg-muted/20">
        <CardContent className="p-6">
          <div className="text-center space-y-4">
            <div className="flex items-center justify-center gap-6 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Eye className="h-4 w-4" />
                <span className="font-medium">{brief.view_count} views</span>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                <span className="font-medium">
                  Published {new Date(brief.published_at).toLocaleString('en-US', {
                    dateStyle: 'medium',
                    timeStyle: 'short'
                  })}
                </span>
              </div>
            </div>
            <div className="text-xs text-muted-foreground/80 font-pixel">
              <div className="mb-1">📊 Data Sources: CoinGecko Pro • LunarCrush • Alternative.me • OpenAI GPT-5</div>
              <div className="font-bold text-primary">🎣 XRay Market Intelligence — Source of Truth for Crypto Markets</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}