import React from 'react';
import { XRHeader } from '@/components/XRHeader';
import { XRTicker } from '@/components/XRTicker';
import { XRFooter } from '@/components/XRFooter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, DollarSign, BarChart3 } from 'lucide-react';
import { SimpleBriefTrigger } from '@/components/SimpleBriefTrigger';

export default function MarketBrief() {

  return (
    <div className="min-h-screen bg-background">
      <XRHeader currentPage="market-brief" />
      {/* Desktop and Medium: Both tickers */}
      <div className="hidden sm:block">
        <XRTicker type="crypto" />
      </div>
      <div className="hidden sm:block">
        <XRTicker type="stocks" />
      </div>
      {/* Small screens: Only crypto ticker */}
      <div className="block sm:hidden">
        <XRTicker type="crypto" />
      </div>
      
      <main className="container mx-auto py-6 space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold xr-gradient-text">📊 Market Brief</h1>
          <p className="text-muted-foreground">Generate and view daily market analysis with real-time news and data</p>
        </div>

        {/* Generate New Brief */}
        <div className="flex justify-center">
          <SimpleBriefTrigger />
        </div>

        {/* Coming Soon - Generated Market Brief Content */}
        <Card className="xr-card">
          <CardHeader>
            <CardTitle className="flex items-center">
              📋 Market Brief Content
            </CardTitle>
          </CardHeader>
          <CardContent className="text-center py-8">
            <p className="text-muted-foreground mb-4">
              Click "Generate Now" above to create a fresh market brief with:
            </p>
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>• Latest cryptocurrency news and analysis</p>
              <p>• Stock market trends and insights</p>
              <p>• Macro economic developments</p>
              <p>• AI-powered market intelligence</p>
            </div>
          </CardContent>
        </Card>
      </main>
      
      <XRFooter />
    </div>
  );
}