import React, { useState } from 'react';
import { XRHeader } from '@/components/XRHeader';
import { XRTicker } from '@/components/XRTicker';
import { XRFooter } from '@/components/XRFooter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Heart, Copy, Check, Bitcoin, Wallet } from 'lucide-react';

export default function Support() {
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);

  const wallets = [
    {
      currency: 'Bitcoin',
      symbol: 'BTC',
      address: 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh',
      icon: <Bitcoin className="w-5 h-5" />
    },
    {
      currency: 'Ethereum',
      symbol: 'ETH',
      address: '0x26fDb7d5B8a8A0fA3E5C7C7C8B4B3C2B1A9D8E7F',
      icon: <Wallet className="w-5 h-5" />
    },
    {
      currency: 'Solana',
      symbol: 'SOL',
      address: '6y6KJz3F2H8L9N4M3K2J1G9F8E7D6C5B4A3Z2Y1X',
      icon: <Wallet className="w-5 h-5" />
    }
  ];

  const copyToClipboard = (address: string, symbol: string) => {
    navigator.clipboard.writeText(address);
    setCopiedAddress(symbol);
    setTimeout(() => setCopiedAddress(null), 2000);
  };

  return (
    <div className="min-h-screen bg-background">
      <XRHeader currentPage="support" />
      <XRTicker type="crypto" />
      
      <main className="container mx-auto py-6 space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-3xl xr-pixel-title">❤️ Support XRayCrypto</h1>
          <p className="text-muted-foreground font-mono">Help keep the lights on and the data flowing</p>
        </div>

        <div className="max-w-2xl mx-auto">
          <Card className="xr-card">
            <CardHeader className="text-center">
              <div className="mx-auto w-24 h-24 rounded-full overflow-hidden mb-4 border-4 border-primary">
                <img 
                  src="/pfp.png" 
                  alt="XRayCrypto Avatar" 
                  className="w-full h-full object-cover"
                />
              </div>
              <CardTitle className="text-xl xr-pixel-text">Woof! Support the Pack</CardTitle>
              <p className="text-muted-foreground">
                Your donations help maintain servers, data feeds, and keep XRayCrypto free for everyone!
              </p>
            </CardHeader>
            
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <h3 className="xr-nav-text flex items-center">
                  <Wallet className="w-4 h-4 mr-2" />
                  Tip Wallets
                </h3>
                
                {wallets.map((wallet) => (
                  <div key={wallet.symbol} className="border border-border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        {wallet.icon}
                        <span className="xr-nav-text">{wallet.currency}</span>
                        <Badge variant="outline">{wallet.symbol}</Badge>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <code className="flex-1 bg-muted px-3 py-2 rounded text-sm font-mono break-all">
                        {wallet.address}
                      </code>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyToClipboard(wallet.address, wallet.symbol)}
                        className="shrink-0"
                      >
                        {copiedAddress === wallet.symbol ? (
                          <>
                            <Check className="w-4 h-4 mr-1" />
                            Copied!
                          </>
                        ) : (
                          <>
                            <Copy className="w-4 h-4 mr-1" />
                            Copy
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="text-center pt-4 border-t border-border">
                <p className="text-sm text-muted-foreground mb-4">
                  Alternative: Send to our Unstoppable Domain
                </p>
                <div className="flex items-center justify-center space-x-2">
                  <code className="bg-muted px-3 py-2 rounded font-mono">
                    xraycrypto.x
                  </code>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard('xraycrypto.x', 'UD')}
                  >
                    {copiedAddress === 'UD' ? (
                      <>
                        <Check className="w-4 h-4 mr-1" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4 mr-1" />
                        Copy
                      </>
                    )}
                  </Button>
                </div>
              </div>

              <div className="text-center">
                <Heart className="w-6 h-6 text-destructive mx-auto mb-2 animate-pulse" />
                <p className="text-sm text-muted-foreground">
                  Every donation helps keep XRayCrypto running and improving. Thank you for your support!
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
      
      <XRFooter />
    </div>
  );
}