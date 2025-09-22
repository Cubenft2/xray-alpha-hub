import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { XRHeader } from '@/components/XRHeader';
import { XRTicker } from '@/components/XRTicker';
import { XRFooter } from '@/components/XRFooter';
import { TradingViewChart } from '@/components/TradingViewChart';
import { CryptoScreener } from '@/components/CryptoScreener';
import { CryptoHeatmap } from '@/components/CryptoHeatmap';
import { NewsSection } from '@/components/NewsSection';

const Index = () => {
  const [searchParams] = useSearchParams();
  const [chartSymbol, setChartSymbol] = useState<string>('BINANCE:BTCUSDT');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const symbolFromUrl = searchParams.get('symbol');
    if (symbolFromUrl) {
      setChartSymbol(symbolFromUrl);
    }
  }, [searchParams]);

  const handleSearch = (term: string) => {
    setSearchTerm(term);
  };
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <XRHeader onSearch={handleSearch} />
      
      {/* Ticker Tapes */}
      <div className="space-y-0">
        <XRTicker type="crypto" />
        <div className="hidden sm:block">
          <XRTicker type="stocks" />
        </div>
      </div>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6">
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

          {/* Main Chart - Full width and taller */}
          <div className="w-full mb-6">
            <TradingViewChart symbol={chartSymbol} height="700px" />
          </div>

          {/* News Section - Full width */}
          <div className="w-full mb-6">
            <NewsSection />
          </div>

          {/* Dashboard Grid */}
          <div className="grid grid-cols-1 gap-6">
            {/* Crypto Screener - Full width */}
            <div>
              <CryptoScreener />
            </div>

            {/* Crypto Heatmap - Full width */}
            <div>
              <CryptoHeatmap />
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <XRFooter />
    </div>
  );
};

export default Index;
