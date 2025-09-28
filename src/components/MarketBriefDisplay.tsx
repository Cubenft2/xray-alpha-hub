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
  // Core crypto assets for mini-charts row
  const coreAssets = ['BTC', 'ETH', 'SOL', 'ADA', 'AVAX', 'ARB', 'OP', 'DOGE'];
  
  const getChartSymbol = (asset: string) => {
    const upperAsset = asset.toUpperCase();
    const cryptoMappings: { [key: string]: string } = {
      'BTC': 'BINANCE:BTCUSDT', 'BITCOIN': 'BINANCE:BTCUSDT',
      'ETH': 'BINANCE:ETHUSDT', 'ETHEREUM': 'BINANCE:ETHUSDT',
      'SOL': 'BINANCE:SOLUSDT', 'SOLANA': 'BINANCE:SOLUSDT',
      'ADA': 'BINANCE:ADAUSDT', 'CARDANO': 'BINANCE:ADAUSDT',
      'AVAX': 'BINANCE:AVAXUSDT', 'AVALANCHE': 'BINANCE:AVAXUSDT',
      'ARB': 'BINANCE:ARBUSDT', 'ARBITRUM': 'BINANCE:ARBUSDT',
      'OP': 'BINANCE:OPUSDT', 'OPTIMISM': 'BINANCE:OPUSDT',
      'DOGE': 'BINANCE:DOGEUSDT', 'DOGECOIN': 'BINANCE:DOGEUSDT'
    };
    return cryptoMappings[upperAsset] || `BINANCE:${upperAsset}USDT`;
  };

  const getFearGreedLabel = (score: number) => {
    if (score >= 75) return 'Extreme Greed';
    if (score >= 55) return 'Greed';
    if (score >= 45) return 'Neutral';
    if (score >= 25) return 'Fear';
    return 'Extreme Fear';
  };

  // Parse AI content into structured sections
  const parseContentSections = (content: string) => {
    const sections = content.split(/\n(?=\*\*[^*]+\*\*)/);
    const parsed = {
      whatHappened: '',
      whyMatters: '',
      whatToWatch: '',
      lastWord: ''
    };
    
    sections.forEach(section => {
      const titleMatch = section.match(/^\*\*([^*]+)\*\*/);
      const title = titleMatch ? titleMatch[1].toLowerCase() : '';
      const body = section.replace(/^\*\*[^*]+\*\*\n?/, '').trim();
      
      if (title.includes('what happened') || title.includes('happened')) {
        parsed.whatHappened = body;
      } else if (title.includes('why') && title.includes('matter')) {
        parsed.whyMatters = body;
      } else if (title.includes('watch') || title.includes('next')) {
        parsed.whatToWatch = body;
      } else if (title.includes('last word') || title.includes('final')) {
        parsed.lastWord = body;
      }
    });
    
    return parsed;
  };

  const contentSections = brief.content_sections?.ai_content 
    ? parseContentSections(brief.content_sections.ai_content)
    : { whatHappened: '', whyMatters: '', whatToWatch: '', lastWord: '' };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* HERO / LATEST BRIEF */}
      <div className="text-center space-y-6">
        <h1 className="text-4xl font-black xr-gradient-text font-pixel">
          {brief.title}
        </h1>
        
        {/* Hook Line */}
        <div className="text-2xl font-bold text-primary font-pixel mb-4">
          "Let's talk about something."
        </div>
        
        {/* Executive Summary */}
        <div className="max-w-3xl mx-auto">
          <p className="text-lg text-muted-foreground leading-relaxed">
            {brief.executive_summary}
          </p>
        </div>
      </div>

      {/* TRADINGVIEW MINI-CHARTS ROW */}
      <Card className="xr-card">
        <CardContent className="p-6">
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
            {coreAssets.map((asset) => (
              <div key={asset} className="text-center">
                <div className="font-bold text-sm mb-2 font-pixel">{asset}</div>
                <div className="h-20 border rounded bg-background/50">
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

      {/* FEAR & GREED + FOMO + HEATMAP ROW */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Fear & Greed Dial */}
        <Card className="xr-card">
          <CardHeader className="text-center pb-2">
            <CardTitle className="text-lg font-pixel">Fear & Greed</CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <div className="text-3xl font-bold text-primary mb-2">
              {brief.market_data?.fear_greed_score || 50}
            </div>
            <div className="text-sm text-muted-foreground">
              {getFearGreedLabel(brief.market_data?.fear_greed_score || 50)}
            </div>
            <Progress 
              value={brief.market_data?.fear_greed_score || 50} 
              className="w-full h-2 mt-3"
            />
          </CardContent>
        </Card>

        {/* FOMO Score Bar */}
        <Card className="xr-card">
          <CardHeader className="text-center pb-2">
            <CardTitle className="text-lg font-pixel">FOMO Score</CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <div className="text-3xl font-bold text-warning mb-2">
              {brief.market_data?.fomo_score || 45}
            </div>
            <div className="text-sm text-muted-foreground">
              {(brief.market_data?.fomo_score || 45) >= 70 ? 'Frothy' : 
               (brief.market_data?.fomo_score || 45) >= 50 ? 'Hot' : 'Warming'}
            </div>
            <Progress 
              value={brief.market_data?.fomo_score || 45} 
              className="w-full h-2 mt-3"
            />
          </CardContent>
        </Card>

        {/* LunarCrush Trending Heatmap */}
        <Card className="xr-card">
          <CardHeader className="text-center pb-2">
            <CardTitle className="text-lg font-pixel">Trending</CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <div className="text-3xl font-bold text-accent mb-2">
              {brief.sentiment_score ? brief.sentiment_score.toFixed(1) : '0.0'}
            </div>
            <div className="text-sm text-muted-foreground">
              Market Sentiment
            </div>
            <div className="flex justify-center mt-2">
              {brief.sentiment_score && brief.sentiment_score > 0 ? 
                <TrendingUp className="h-5 w-5 text-success" /> : 
                <TrendingDown className="h-5 w-5 text-destructive" />
              }
            </div>
          </CardContent>
        </Card>
      </div>

      {/* MAIN BODY */}
      <div className="space-y-8">
        {/* WHAT HAPPENED */}
        {contentSections.whatHappened && (
          <Card className="xr-card">
            <CardHeader>
              <CardTitle className="text-2xl font-pixel text-primary">WHAT HAPPENED</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="prose prose-lg max-w-none text-foreground">
                <p className="leading-relaxed whitespace-pre-wrap">{contentSections.whatHappened}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* WHY IT MATTERS */}
        {contentSections.whyMatters && (
          <Card className="xr-card">
            <CardHeader>
              <CardTitle className="text-2xl font-pixel text-primary">WHY IT MATTERS</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="prose prose-lg max-w-none text-foreground">
                <p className="leading-relaxed whitespace-pre-wrap">{contentSections.whyMatters}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* MARKET REACTION - Live Price Snapshot Table */}
        {brief.market_data?.top_assets && (
          <Card className="xr-card">
            <CardHeader>
              <CardTitle className="text-2xl font-pixel text-primary">MARKET REACTION</CardTitle>
              <CardDescription>Live price snapshot and market sentiment</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4">
                {brief.market_data.top_assets.slice(0, 6).map((asset: any) => (
                  <div key={asset.symbol} className="flex items-center justify-between p-4 rounded-lg border bg-background/50">
                    <div className="flex items-center gap-4">
                      <div>
                        <div className="font-bold">{asset.symbol}</div>
                        <div className="text-sm text-muted-foreground">{asset.name}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-medium">${asset.price?.toFixed(4) || '0.0000'}</div>
                        <Badge variant={asset.change_24h > 0 ? 'default' : 'destructive'} className="text-xs">
                          {asset.change_24h > 0 ? '+' : ''}{asset.change_24h?.toFixed(2) || '0.00'}%
                        </Badge>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-muted-foreground">Volume</div>
                      <div className="font-medium">${((asset.volume || 0)/1e9).toFixed(2)}B</div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* WHAT TO WATCH NEXT */}
        {contentSections.whatToWatch && (
          <Card className="xr-card">
            <CardHeader>
              <CardTitle className="text-2xl font-pixel text-primary">WHAT TO WATCH NEXT</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="prose prose-lg max-w-none text-foreground">
                <p className="leading-relaxed whitespace-pre-wrap">{contentSections.whatToWatch}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* LAST WORD */}
        {(contentSections.lastWord || brief.content_sections?.last_word) && (
          <Card className="xr-card border-accent/40 bg-gradient-to-r from-accent/10 to-primary/10">
            <CardHeader>
              <CardTitle className="text-2xl font-pixel text-accent flex items-center gap-2">
                <Compass className="h-6 w-6" />
                LAST WORD
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-lg italic text-foreground leading-relaxed">
                {contentSections.lastWord || brief.content_sections?.last_word}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* MINI-SECTION ROTATOR */}
      <Card className="xr-card border-primary/30">
        <CardHeader>
          <CardTitle className="text-2xl font-pixel text-primary flex items-center gap-2">
            <Waves className="h-6 w-6" />
            Chart of the Tide
          </CardTitle>
          <CardDescription>Daily market analysis rotator</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {brief.featured_assets?.slice(0, 4).map((asset) => (
              <div key={asset} className="space-y-3">
                <h4 className="font-bold text-lg font-pixel">{asset}</h4>
                <div className="h-48 rounded-lg border bg-background/50">
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

      {/* WISDOM FOR THE WATERS */}
      {brief.stoic_quote && (
        <Card className="xr-card border-accent/40 bg-gradient-to-r from-accent/10 to-primary/10">
          <CardContent className="p-8 text-center">
            <h3 className="text-2xl font-bold text-accent mb-6 flex items-center justify-center gap-2 font-pixel">
              <Waves className="h-6 w-6" />
              WISDOM FOR THE WATERS
            </h3>
            <blockquote className="text-xl italic text-foreground/90 font-medium leading-relaxed mb-4">
              "{brief.stoic_quote}"
            </blockquote>
            <div className="text-sm text-muted-foreground">
              — Daily wisdom from the trading docks
            </div>
          </CardContent>
        </Card>
      )}

      {/* Brief Footer */}
      <Card className="xr-card bg-muted/20">
        <CardContent className="p-4">
          <div className="text-center space-y-2">
            <div className="flex items-center justify-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Eye className="h-4 w-4" />
                <span>{brief.view_count} views</span>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                <span>
                  {new Date(brief.published_at).toLocaleDateString()}
                </span>
              </div>
            </div>
            <div className="text-xs text-muted-foreground font-pixel">
              🎣 XRay Market Intelligence — Source of Truth for Crypto Markets
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}