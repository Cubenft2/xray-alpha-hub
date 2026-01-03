import React, { useState } from 'react';
import { SEOHead } from '@/components/SEOHead';
import { TradingViewChart } from '@/components/TradingViewChart';
import { MetalsCards } from '@/components/forex/MetalsCards';
import { ForexScreener } from '@/components/ForexScreener';
import { NewsSection } from '@/components/NewsSection';
import { FinancialDisclaimer } from '@/components/FinancialDisclaimer';

export default function Forex() {
  const [chartSymbol, setChartSymbol] = useState('OANDA:XAUUSD');

  const handleSelectSymbol = (symbol: string) => {
    setChartSymbol(symbol);
  };

  return (
    <>
      <SEOHead
        title="Forex & Precious Metals - Live Gold, Silver & Currency Prices"
        description="Track live gold, silver, and forex prices with ZombieDog AI insights. Real-time XAU/USD, XAG/USD, and major currency pair data with charts."
        canonicalUrl="https://xraycrypto.io/forex"
        keywords="gold price, silver price, forex, currency trading, XAU/USD, XAG/USD, precious metals, ZombieDog AI"
      />
      <div className="py-6 space-y-6">
        {/* Header */}
        <div className="w-full">
          <div className="container mx-auto">
            <div className="text-center space-y-2">
              <h1 className="text-3xl font-bold xr-gradient-text">💱 Forex & Precious Metals</h1>
              <p className="text-muted-foreground">Real-time currency and metals market data</p>
            </div>
            <div className="mt-6">
              <FinancialDisclaimer />
            </div>
          </div>
        </div>

        {/* Metals Cards */}
        <div className="w-full">
          <div className="container mx-auto">
            <MetalsCards onSelectSymbol={handleSelectSymbol} />
          </div>
        </div>

        {/* Chart */}
        <div className="w-full">
          <div className="container mx-auto">
            <TradingViewChart symbol={chartSymbol} height="600px" />
          </div>
        </div>

        {/* Forex Screener */}
        <div className="w-full">
          <div className="container mx-auto">
            <ForexScreener onSelectSymbol={handleSelectSymbol} />
          </div>
        </div>

        {/* News */}
        <div className="w-full">
          <div className="container mx-auto">
            <NewsSection searchTerm="" defaultTab="crypto" />
          </div>
        </div>
      </div>
    </>
  );
}
