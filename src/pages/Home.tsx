import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { TrendingUp, BarChart3, Newspaper, Sparkles, Globe, Shield } from 'lucide-react';
import { RealTimePriceTicker } from '@/components/RealTimePriceTicker';

export default function Home() {
  return (
    <div className="py-8">
      {/* Hero Section */}
      <div className="container mx-auto">
        <div className="text-center space-y-6 mb-12">
          <h1 className="text-5xl sm:text-6xl font-black xr-gradient-text animate-radioactive-glow">
            Welcome to XRayCrypto™
          </h1>
          <p className="text-xl sm:text-2xl text-muted-foreground max-w-3xl mx-auto">
            Your ultimate crypto & stocks intelligence platform. Real-time data, AI-powered briefs, 
            and market insights - all in one place! ☢️
          </p>
          
          <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
            <Link to="/crypto">
              <Button size="lg" className="btn-hero text-lg px-8">
                <TrendingUp className="mr-2 h-5 w-5" />
                Explore Crypto
              </Button>
            </Link>
            <Link to="/markets">
              <Button size="lg" variant="outline" className="text-lg px-8">
                <BarChart3 className="mr-2 h-5 w-5" />
                Stock Markets
              </Button>
            </Link>
          </div>
        </div>

        {/* Live Prices */}
        <div className="mb-12">
          <RealTimePriceTicker symbols={['BTC', 'ETH', 'SOL', 'SPY', 'AAPL', 'COIN']} />
        </div>

        {/* Feature Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          <Card className="xr-card hover:xr-glow-primary transition-all duration-300">
            <CardContent className="pt-6">
              <div className="flex flex-col items-center text-center space-y-4">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <TrendingUp className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-xl font-bold">Live Crypto Tracking</h3>
                <p className="text-muted-foreground">
                  Real-time prices, charts, and market data for 1000+ cryptocurrencies
                </p>
                <Link to="/crypto">
                  <Button variant="ghost" className="mt-2">
                    View Dashboard →
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>

          <Card className="xr-card hover:xr-glow-primary transition-all duration-300">
            <CardContent className="pt-6">
              <div className="flex flex-col items-center text-center space-y-4">
                <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center">
                  <Sparkles className="h-8 w-8 text-accent" />
                </div>
                <h3 className="text-xl font-bold">AI Market Briefs</h3>
                <p className="text-muted-foreground">
                  Daily AI-powered market analysis written by Xavier Rodriguez
                </p>
                <Link to="/marketbrief/latest">
                  <Button variant="ghost" className="mt-2">
                    Read Latest Brief →
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>

          <Card className="xr-card hover:xr-glow-primary transition-all duration-300">
            <CardContent className="pt-6">
              <div className="flex flex-col items-center text-center space-y-4">
                <div className="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center">
                  <BarChart3 className="h-8 w-8 text-success" />
                </div>
                <h3 className="text-xl font-bold">Stock Markets</h3>
                <p className="text-muted-foreground">
                  Track major indices, crypto stocks, and tech giants in real-time
                </p>
                <Link to="/markets">
                  <Button variant="ghost" className="mt-2">
                    View Markets →
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>

          <Card className="xr-card hover:xr-glow-primary transition-all duration-300">
            <CardContent className="pt-6">
              <div className="flex flex-col items-center text-center space-y-4">
                <div className="w-16 h-16 rounded-full bg-warning/10 flex items-center justify-center">
                  <Newspaper className="h-8 w-8 text-warning" />
                </div>
                <h3 className="text-xl font-bold">Live News Feed</h3>
                <p className="text-muted-foreground">
                  Breaking crypto & stock news aggregated from top sources
                </p>
                <Link to="/news">
                  <Button variant="ghost" className="mt-2">
                    Read News →
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>

          <Card className="xr-card hover:xr-glow-primary transition-all duration-300">
            <CardContent className="pt-6">
              <div className="flex flex-col items-center text-center space-y-4">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <Globe className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-xl font-bold">Crypto Universe</h3>
                <p className="text-muted-foreground">
                  Explore comprehensive data, social metrics, and insights
                </p>
                <Link to="/crypto-universe">
                  <Button variant="ghost" className="mt-2">
                    Explore Universe →
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>

          <Card className="xr-card hover:xr-glow-primary transition-all duration-300">
            <CardContent className="pt-6">
              <div className="flex flex-col items-center text-center space-y-4">
                <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center">
                  <Shield className="h-8 w-8 text-accent" />
                </div>
                <h3 className="text-xl font-bold">Free & Open</h3>
                <p className="text-muted-foreground">
                  100% free to use. No signup required. Built by XRay Dog Pack
                </p>
                <Link to="/about">
                  <Button variant="ghost" className="mt-2">
                    Learn More →
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* CTA Section */}
        <Card className="xr-card-elevated">
          <CardContent className="py-12">
            <div className="text-center space-y-6">
              <h2 className="text-3xl font-bold xr-gradient-text">Ready to Start?</h2>
              <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                Jump into live crypto tracking or catch up with today's AI-powered market brief
              </p>
              <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
                <Link to="/crypto">
                  <Button size="lg" className="btn-hero text-lg px-8">
                    View Live Charts
                  </Button>
                </Link>
                <Link to="/marketbrief/latest">
                  <Button size="lg" variant="outline" className="text-lg px-8">
                    Read Today's Brief
                  </Button>
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
