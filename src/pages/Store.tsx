import React from 'react';
import { XRHeader } from '@/components/XRHeader';
import { XRTicker } from '@/components/XRTicker';
import { XRFooter } from '@/components/XRFooter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ShoppingBag, Star, Zap } from 'lucide-react';

export default function Store() {
  return (
    <div className="min-h-screen bg-background">
      <XRHeader currentPage="store" />
      <XRTicker type="crypto" />
      
      <main className="container mx-auto py-6 space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold xr-gradient-text">🛍️ XRay Store</h1>
          <p className="text-muted-foreground">Premium tools and NFTs coming soon</p>
        </div>

        <Card className="xr-card">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
              <ShoppingBag className="w-8 h-8 text-primary" />
            </div>
            <CardTitle className="text-2xl">Store Coming Soon!</CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-muted-foreground">
              We're working on bringing you exclusive NFTs, premium trading tools, and XRayCrypto merchandise.
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
              <div className="space-y-2">
                <Star className="w-6 h-6 text-warning mx-auto" />
                <h3 className="font-semibold">Premium NFTs</h3>
                <p className="text-sm text-muted-foreground">Exclusive crypto-themed collectibles</p>
              </div>
              <div className="space-y-2">
                <Zap className="w-6 h-6 text-primary mx-auto" />
                <h3 className="font-semibold">Trading Tools</h3>
                <p className="text-sm text-muted-foreground">Advanced analytics and alerts</p>
              </div>
              <div className="space-y-2">
                <ShoppingBag className="w-6 h-6 text-success mx-auto" />
                <h3 className="font-semibold">Merchandise</h3>
                <p className="text-sm text-muted-foreground">XRayCrypto branded gear</p>
              </div>
            </div>

            <Button className="mt-6 btn-hero">
              Get Notified When We Launch
            </Button>
          </CardContent>
        </Card>
      </main>
      
      <XRFooter />
    </div>
  );
}