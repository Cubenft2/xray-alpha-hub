import React, { useState } from 'react';
import { XRHeader } from '@/components/XRHeader';
import { XRTicker } from '@/components/XRTicker';
import { XRFooter } from '@/components/XRFooter';
import { CryptoChart } from '@/components/CryptoChart';
import { CryptoScreener } from '@/components/CryptoScreener';
import { CryptoHeatmap } from '@/components/CryptoHeatmap';
import { NewsSection } from '@/components/NewsSection';

const Index = () => {
  const [currentPage, setCurrentPage] = useState('home');

  const handleNavigate = (page: string) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <XRHeader currentPage={currentPage} onNavigate={handleNavigate} />
      
      {/* Ticker Tapes */}
      <div className="space-y-0">
        <XRTicker type="crypto" />
        <div className="hidden sm:block">
          <XRTicker type="stocks" />
        </div>
      </div>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6">
        {currentPage === 'home' && (
          <div className="space-y-6">
            {/* Hero Section */}
            <div className="text-center py-8">
              <h1 className="text-4xl sm:text-5xl font-bold xr-gradient-text mb-4">
                Welcome to XRayCrypto™
              </h1>
              <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                Your ultimate crypto & stocks dashboard. Real-time charts, live news, 
                and community support - all in one place! 🐕
              </p>
            </div>

            {/* Dashboard Grid */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              {/* Main Chart - Full width on mobile, 2 cols on desktop */}
              <div className="xl:col-span-2">
                <CryptoChart />
              </div>

              {/* News Section */}
              <div className="xl:col-span-1">
                <NewsSection />
              </div>

              {/* Crypto Screener - Full width */}
              <div className="xl:col-span-3">
                <CryptoScreener />
              </div>

              {/* Crypto Heatmap - Full width */}
              <div className="xl:col-span-3">
                <CryptoHeatmap />
              </div>
            </div>
          </div>
        )}

        {currentPage === 'markets' && (
          <div className="space-y-6">
            <div className="text-center py-8">
              <h1 className="text-4xl font-bold xr-gradient-text mb-4">
                📈 Stock Markets
              </h1>
              <p className="text-xl text-muted-foreground">
                Track stocks, ETFs, and market performance
              </p>
            </div>
            <CryptoChart symbol="NYSE:SPY" />
          </div>
        )}

        {currentPage === 'watchlist' && (
          <div className="space-y-6">
            <div className="text-center py-8">
              <h1 className="text-4xl font-bold xr-gradient-text mb-4">
                👀 My Watchlist
              </h1>
              <p className="text-xl text-muted-foreground">
                Your personalized crypto & stocks tracker
              </p>
            </div>
            <div className="xr-card p-8 text-center">
              <h3 className="text-lg font-semibold mb-2">Coming Soon!</h3>
              <p className="text-muted-foreground">
                Add your favorite cryptocurrencies and stocks to track them here.
              </p>
            </div>
          </div>
        )}

        {currentPage === 'news' && (
          <div className="space-y-6">
            <div className="text-center py-8">
              <h1 className="text-4xl font-bold xr-gradient-text mb-4">
                📰 Financial News Hub
              </h1>
              <p className="text-xl text-muted-foreground">
                24/7 live financial news and analysis
              </p>
            </div>
            <div className="xr-card p-8 text-center">
              <h3 className="text-lg font-semibold mb-2">Live News Feeds</h3>
              <p className="text-muted-foreground">
                Multiple 24/7 financial news streams coming soon!
              </p>
            </div>
          </div>
        )}

        {currentPage === 'chill' && (
          <div className="space-y-6">
            <div className="text-center py-8">
              <h1 className="text-4xl font-bold xr-gradient-text mb-4">
                🎵 ChillZone
              </h1>
              <p className="text-xl text-muted-foreground">
                Relax while watching the markets
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }, (_, i) => (
                <div key={i} className="xr-card p-4 hover:xr-glow-primary transition-all duration-300 cursor-pointer">
                  <div className="aspect-video bg-muted rounded-lg mb-3 flex items-center justify-center">
                    <span className="text-2xl">🎵</span>
                  </div>
                  <h3 className="font-medium mb-1">Chill Beats #{i + 1}</h3>
                  <p className="text-sm text-muted-foreground">Lofi • Relaxing</p>
                  <div className="flex items-center justify-between mt-3">
                    <span className="text-xs bg-red-500 text-white px-2 py-1 rounded">LIVE</span>
                    <span className="text-xs text-muted-foreground">24/7</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {currentPage === 'store' && (
          <div className="space-y-6">
            <div className="text-center py-8">
              <h1 className="text-4xl font-bold xr-gradient-text mb-4">
                🛍️ XR Store
              </h1>
              <p className="text-xl text-muted-foreground">
                NFTs, merch, and premium assets
              </p>
            </div>
            <div className="xr-card p-8 text-center">
              <h3 className="text-lg font-semibold mb-2">Coming Soon!</h3>
              <p className="text-muted-foreground mb-4">
                Stay tuned for exclusive XRayCrypto™ merchandise and digital assets.
              </p>
              <div className="text-4xl mb-4">🛍️✨</div>
            </div>
          </div>
        )}

        {currentPage === 'support' && (
          <div className="space-y-6">
            <div className="text-center py-8">
              <h1 className="text-4xl font-bold xr-gradient-text mb-4">
                ❤️ Support XRayCrypto
              </h1>
              <p className="text-xl text-muted-foreground">
                Help keep the community thriving! Woof! 🐕
              </p>
            </div>
            
            <div className="max-w-2xl mx-auto">
              <div className="xr-card p-8 text-center">
                <div className="w-20 h-20 bg-primary rounded-full flex items-center justify-center text-4xl mx-auto mb-4 animate-glow-pulse">
                  🐕
                </div>
                <h3 className="text-xl font-semibold mb-4">Woof! Thank You!</h3>
                <p className="text-muted-foreground mb-6">
                  Your support helps us maintain and improve XRayCrypto™ for the entire community.
                </p>
                
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="xr-card p-4">
                    <div className="text-2xl mb-2">₿</div>
                    <div className="text-xs text-muted-foreground mb-2">Bitcoin</div>
                    <div className="text-xs font-mono bg-muted p-2 rounded">
                      bc1q...example
                    </div>
                  </div>
                  <div className="xr-card p-4">
                    <div className="text-2xl mb-2">Ξ</div>
                    <div className="text-xs text-muted-foreground mb-2">Ethereum</div>
                    <div className="text-xs font-mono bg-muted p-2 rounded">
                      0x26...example
                    </div>
                  </div>
                  <div className="xr-card p-4">
                    <div className="text-2xl mb-2">◎</div>
                    <div className="text-xs text-muted-foreground mb-2">Solana</div>
                    <div className="text-xs font-mono bg-muted p-2 rounded">
                      6y6K...example
                    </div>
                  </div>
                </div>
                
                <p className="text-xs text-muted-foreground mt-4">
                  Or reach out: <strong>xraycrypto.x</strong>
                </p>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <XRFooter />
    </div>
  );
};

export default Index;
