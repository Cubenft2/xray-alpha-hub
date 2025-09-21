import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { XRHeader } from '@/components/XRHeader';
import { XRTicker } from '@/components/XRTicker';
import { XRFooter } from '@/components/XRFooter';
import { CryptoChart } from '@/components/CryptoChart';
import { StocksScreener } from '@/components/StocksScreener';
import { StocksHeatmap } from '@/components/StocksHeatmap';
import { NewsSection } from '@/components/NewsSection';

export default function Markets() {
  const [searchParams] = useSearchParams();
  const [chartSymbol, setChartSymbol] = useState<string>('NASDAQ:SPY');

  useEffect(() => {
    const symbolFromUrl = searchParams.get('symbol');
    if (symbolFromUrl) {
      setChartSymbol(symbolFromUrl);
    }
  }, [searchParams]);
  return (
    <div className="min-h-screen bg-background">
      <XRHeader currentPage="markets" />
      <XRTicker type="stocks" />
      
      <main className="container mx-auto px-4 py-6 space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold xr-gradient-text">📈 Stock Markets</h1>
          <p className="text-muted-foreground">Real-time stock market data and analysis</p>
        </div>

        <CryptoChart symbol={chartSymbol} height={500} />
        
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <StocksScreener />
          <StocksHeatmap />
        </div>
        
        <NewsSection />
      </main>
      
      <XRFooter />
    </div>
  );
}