import React from 'react';
import { XRHeader } from '@/components/XRHeader';
import { XRTicker } from '@/components/XRTicker';
import { XRFooter } from '@/components/XRFooter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, DollarSign, BarChart3 } from 'lucide-react';

export default function MarketBrief() {
  const marketData = [
    { name: 'S&P 500', value: '4,567.89', change: '+1.2%', positive: true },
    { name: 'Dow Jones', value: '34,567.12', change: '+0.8%', positive: true },
    { name: 'NASDAQ', value: '14,234.56', change: '-0.3%', positive: false },
    { name: 'Russell 2000', value: '2,123.45', change: '+2.1%', positive: true },
  ];

  const cryptoData = [
    { name: 'Bitcoin', symbol: 'BTC', value: '$67,234', change: '+3.4%', positive: true },
    { name: 'Ethereum', symbol: 'ETH', value: '$3,456', change: '+2.1%', positive: true },
    { name: 'Solana', symbol: 'SOL', value: '$234', change: '-1.2%', positive: false },
    { name: 'Cardano', symbol: 'ADA', value: '$1.23', change: '+5.6%', positive: true },
  ];

  const newsItems = [
    {
      title: 'Fed Holds Interest Rates Steady',
      time: '2 hours ago',
      source: 'Reuters',
      type: 'Market News'
    },
    {
      title: 'Tech Stocks Rally on AI Optimism',
      time: '4 hours ago',
      source: 'Bloomberg',
      type: 'Technology'
    },
    {
      title: 'Bitcoin Breaks Above $67K Resistance',
      time: '6 hours ago',
      source: 'CoinDesk',
      type: 'Crypto'
    },
    {
      title: 'Energy Sector Leads Market Gains',
      time: '1 day ago',
      source: 'MarketWatch',
      type: 'Sectors'
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      <XRHeader currentPage="market-brief" />
      <XRTicker type="stocks" />
      
      <main className="container mx-auto px-4 py-6 space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold xr-gradient-text">📊 Market Brief</h1>
          <p className="text-muted-foreground">Quick overview of today's market performance</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Stock Indices */}
          <Card className="xr-card">
            <CardHeader>
              <CardTitle className="flex items-center">
                <BarChart3 className="w-5 h-5 mr-2" />
                Major Indices
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {marketData.map((item, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium">{item.name}</h3>
                      <p className="text-sm text-muted-foreground">{item.value}</p>
                    </div>
                    <Badge variant={item.positive ? "default" : "secondary"} className="flex items-center">
                      {item.positive ? (
                        <TrendingUp className="w-3 h-3 mr-1" />
                      ) : (
                        <TrendingDown className="w-3 h-3 mr-1" />
                      )}
                      {item.change}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Crypto */}
          <Card className="xr-card">
            <CardHeader>
              <CardTitle className="flex items-center">
                <DollarSign className="w-5 h-5 mr-2" />
                Top Cryptocurrencies
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {cryptoData.map((item, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium">{item.name}</h3>
                      <p className="text-sm text-muted-foreground">{item.symbol} • {item.value}</p>
                    </div>
                    <Badge variant={item.positive ? "default" : "secondary"} className="flex items-center">
                      {item.positive ? (
                        <TrendingUp className="w-3 h-3 mr-1" />
                      ) : (
                        <TrendingDown className="w-3 h-3 mr-1" />
                      )}
                      {item.change}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Market News */}
        <Card className="xr-card">
          <CardHeader>
            <CardTitle className="flex items-center">
              📰 Market Headlines
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {newsItems.map((item, index) => (
                <div key={index} className="border-b border-border last:border-0 pb-4 last:pb-0">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-medium hover:text-primary cursor-pointer transition-colors">
                        {item.title}
                      </h3>
                      <div className="flex items-center space-x-2 mt-1">
                        <span className="text-xs text-muted-foreground">{item.source}</span>
                        <span className="text-xs text-muted-foreground">•</span>
                        <span className="text-xs text-muted-foreground">{item.time}</span>
                      </div>
                    </div>
                    <Badge variant="outline" className="ml-2">
                      {item.type}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Market Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="xr-card text-center">
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-green-500">+1.2%</div>
              <p className="text-sm text-muted-foreground">Market Average</p>
            </CardContent>
          </Card>
          <Card className="xr-card text-center">
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">$2.4T</div>
              <p className="text-sm text-muted-foreground">Total Volume</p>
            </CardContent>
          </Card>
          <Card className="xr-card text-center">
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-blue-500">67</div>
              <p className="text-sm text-muted-foreground">Fear & Greed Index</p>
            </CardContent>
          </Card>
        </div>
      </main>
      
      <XRFooter />
    </div>
  );
}