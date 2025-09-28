import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { TradingViewChart } from '@/components/TradingViewChart';
import { MiniChart } from '@/components/MiniChart';
import { Calendar, Eye, TrendingUp, TrendingDown } from 'lucide-react';

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
      'XRP': 'BINANCE:XRPUSDT',
      'DOGE': 'BINANCE:DOGEUSDT',
      'DOGECOIN': 'BINANCE:DOGEUSDT',
    };
    
    return cryptoMappings[upperAsset] || `BINANCE:${upperAsset}USDT`;
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
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div className="text-center space-y-4">
        <div className="flex items-center justify-center gap-2 mb-4">
          <Badge variant="outline" className="text-xs">
            {brief.brief_type.replace('_', ' ').toUpperCase()}
          </Badge>
          {brief.sentiment_score && (
            <Badge variant={brief.sentiment_score > 0 ? 'default' : 'destructive'} className="text-xs">
              {brief.sentiment_score > 0 ? <TrendingUp className="h-3 w-3 mr-1" /> : <TrendingDown className="h-3 w-3 mr-1" />}
              {brief.sentiment_score.toFixed(1)}
            </Badge>
          )}
          <Badge variant="secondary" className="text-xs">
            <Calendar className="h-3 w-3 mr-1" />
            {new Date(brief.published_at).toLocaleDateString()}
          </Badge>
        </div>
        
        <h1 className="text-4xl font-bold xr-gradient-text mb-4">
          {brief.title}
        </h1>
        
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
          {brief.executive_summary}
        </p>
      </div>

      {/* Featured Assets Charts - Prominent Display */}
      {brief.featured_assets && brief.featured_assets.length > 0 && (
        <Card className="xr-card border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              📈 Market Pulse - Featured Assets
            </CardTitle>
            <CardDescription>
              Live charts for the assets driving today's market narrative
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {brief.featured_assets.slice(0, 6).map((asset) => (
                <div key={asset} className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold">{asset}</h4>
                    <Badge variant="outline" className="text-xs">{asset}</Badge>
                  </div>
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
      )}

      {/* Main Brief Content */}
      <Card className="xr-card">
        <CardContent className="p-8">
          <div className="prose prose-lg max-w-none">
            {contentSections.map((section, index) => (
              <div key={index} className="mb-8">
                {section.isSection && section.title && (
                  <h2 className="text-2xl font-bold mb-4 text-foreground border-b border-border pb-2">
                    {section.title}
                  </h2>
                )}
                <div className="text-foreground/90 leading-relaxed whitespace-pre-wrap">
                  {section.body}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Stoic Quote */}
      {brief.stoic_quote && (
        <Alert className="xr-card border-primary/30 bg-primary/5">
          <AlertDescription className="text-center">
            <div className="text-lg italic font-medium text-primary mb-2">
              🌊 Wisdom for the Waters
            </div>
            <div className="text-base text-foreground/80">
              "{brief.stoic_quote}"
            </div>
          </AlertDescription>
        </Alert>
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

      {/* Footer */}
      <div className="text-center text-sm text-muted-foreground space-y-2">
        <div className="flex items-center justify-center gap-4">
          <div className="flex items-center gap-1">
            <Eye className="h-4 w-4" />
            {brief.view_count} views
          </div>
          <div className="flex items-center gap-1">
            <Calendar className="h-4 w-4" />
            Published {new Date(brief.published_at).toLocaleString()}
          </div>
        </div>
        <div className="text-xs">
          Data sources: CoinGecko Pro, LunarCrush, OpenAI GPT-5 • Captain XRay's Market Intelligence
        </div>
      </div>
    </div>
  );
}