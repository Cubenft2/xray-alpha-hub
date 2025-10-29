import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ExternalLink, Shield, Users, TrendingUp, Heart } from 'lucide-react';

export default function About() {
  return (
    <div className="container mx-auto py-6 space-y-8">
      <div className="text-center space-y-4">
        <div className="flex items-center justify-center mb-4">
          <img 
            src="/pfp.png" 
            alt="XRayCrypto Team" 
            className="w-20 h-20 rounded-full border-4 border-primary"
          />
        </div>
        <h1 className="text-4xl font-bold xr-gradient-text">About XRayCrypto™</h1>
        <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
          Your trusted source for real-time cryptocurrency and stock market data, 
          built by passionate developers for the trading community.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="xr-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              Our Mission
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              XRayCrypto™ was created to democratize access to professional-grade market data and analysis tools. 
              We believe that everyone should have access to the same quality information that institutional traders use.
            </p>
            <div className="space-y-2">
              <Badge variant="outline" className="mr-2">
                <Shield className="w-3 h-3 mr-1" />
                Educational Purpose Only
              </Badge>
              <Badge variant="outline" className="mr-2">
                <TrendingUp className="w-3 h-3 mr-1" />
                Real-time Data
              </Badge>
              <Badge variant="outline">
                <Heart className="w-3 h-3 mr-1" />
                Community Driven
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card className="xr-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-success" />
              Data Sources & Transparency
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              All our market data is sourced from reputable, licensed providers:
            </p>
            <ul className="space-y-2 text-sm">
              <li className="flex items-center gap-2">
                <span className="w-2 h-2 bg-primary rounded-full"></span>
                <strong>TradingView:</strong> Real-time charts and technical analysis
              </li>
              <li className="flex items-center gap-2">
                <span className="w-2 h-2 bg-accent rounded-full"></span>
                <strong>RSS Feeds:</strong> Aggregated news from major financial outlets
              </li>
              <li className="flex items-center gap-2">
                <span className="w-2 h-2 bg-success rounded-full"></span>
                <strong>APIs:</strong> Cryptocurrency and stock market data
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>

      <Card className="xr-card">
        <CardHeader>
          <CardTitle className="text-center">Important Disclaimers</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-warning/10 border border-warning/20 rounded-lg p-4">
            <h3 className="font-semibold text-warning mb-2 flex items-center gap-2">
              <Shield className="w-4 h-4" />
              Not Financial Advice
            </h3>
            <p className="text-sm text-muted-foreground">
              XRayCrypto™ provides educational content and market data for informational purposes only. 
              This is not financial, investment, or trading advice. Always conduct your own research 
              and consult with qualified financial advisors before making investment decisions.
            </p>
          </div>
          
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
            <h3 className="font-semibold text-destructive mb-2">Risk Warning</h3>
            <p className="text-sm text-muted-foreground">
              Trading cryptocurrencies and stocks involves substantial risk of loss and is not suitable 
              for all investors. Past performance does not guarantee future results. Only invest what 
              you can afford to lose.
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="xr-card">
          <CardHeader>
            <CardTitle>Contact Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="font-medium">Twitter:</span>
              <a 
                href="https://x.com/XRayMarkets" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-primary hover:underline flex items-center gap-1"
              >
                @XRayMarkets <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-medium">Website:</span>
              <span className="text-muted-foreground">xraycrypto.io</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-medium">Support:</span>
              <span className="text-muted-foreground">Available through our social channels</span>
            </div>
          </CardContent>
        </Card>

        <Card className="xr-card">
          <CardHeader>
            <CardTitle>Technical Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2 text-sm">
              <div><strong>Founded:</strong> 2024</div>
              <div><strong>Technology:</strong> React, TypeScript, Supabase</div>
              <div><strong>Data Updates:</strong> Real-time via websockets</div>
              <div><strong>Hosting:</strong> Secure cloud infrastructure</div>
              <div><strong>Privacy:</strong> No personal data collection without consent</div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="text-center text-sm text-muted-foreground space-y-2">
        <p>XRayCrypto™ is an independent platform not affiliated with any cryptocurrency exchange or financial institution.</p>
        <p>We are committed to providing accurate, up-to-date information while maintaining transparency about our data sources and limitations.</p>
      </div>
    </div>
  );
}