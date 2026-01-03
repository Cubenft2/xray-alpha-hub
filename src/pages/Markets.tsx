import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useLayoutSearch } from '@/components/Layout';
import { SEOHead } from '@/components/SEOHead';
import { TradingViewChart } from '@/components/TradingViewChart';
import { StocksScreener } from '@/components/StocksScreener';
import { StocksHeatmap } from '@/components/StocksHeatmap';
import { NewsSection } from '@/components/NewsSection';
import { FinancialDisclaimer } from '@/components/FinancialDisclaimer';

export default function Markets() {
  const [searchParams] = useSearchParams();
  const [chartSymbol, setChartSymbol] = useState<string>('AMEX:SPY');
  const [searchTerm, setSearchTerm] = useState('');
  const { setSearchHandler } = useLayoutSearch();

  const handleSearch = (term: string) => {
    setSearchTerm(term);
    
    // Convert search term to TradingView symbol format for stocks
    if (term.length >= 1) {
      const upperTerm = term.toUpperCase();
      let newSymbol = '';
      
      // Map common stock symbols to TradingView format
      const stockMappings: { [key: string]: string } = {
        'SPY': 'AMEX:SPY',
        'QQQ': 'NASDAQ:QQQ',
        'IWM': 'AMEX:IWM',
        'AAPL': 'NASDAQ:AAPL',
        'APPLE': 'NASDAQ:AAPL',
        'MSFT': 'NASDAQ:MSFT',
        'MICROSOFT': 'NASDAQ:MSFT',
        'GOOGL': 'NASDAQ:GOOGL',
        'GOOGLE': 'NASDAQ:GOOGL',
        'AMZN': 'NASDAQ:AMZN',
        'AMAZON': 'NASDAQ:AMZN',
        'TSLA': 'NASDAQ:TSLA',
        'TESLA': 'NASDAQ:TSLA',
        'NVDA': 'NASDAQ:NVDA',
        'NVIDIA': 'NASDAQ:NVDA',
        'META': 'NASDAQ:META',
        'FACEBOOK': 'NASDAQ:META',
        'NFLX': 'NASDAQ:NFLX',
        'NETFLIX': 'NASDAQ:NFLX',
        'CRM': 'NYSE:CRM',
        'SALESFORCE': 'NYSE:CRM',
        'ORCL': 'NYSE:ORCL',
        'ORACLE': 'NYSE:ORCL',
        'SNAP': 'NYSE:SNAP',
        'SBUX': 'NASDAQ:SBUX',
        'STARBUCKS': 'NASDAQ:SBUX',
        'EA': 'NASDAQ:EA',
        'MNPR': 'NASDAQ:MNPR',
        'MONOPAR': 'NASDAQ:MNPR',
      };
      
      // Check for exact matches first
      if (stockMappings[upperTerm]) {
        newSymbol = stockMappings[upperTerm];
      } else {
        // Try to find partial matches
        const matchedKey = Object.keys(stockMappings).find(key => 
          key.startsWith(upperTerm) || key.includes(upperTerm)
        );
        if (matchedKey) {
          newSymbol = stockMappings[matchedKey];
        } else {
          // Default format for unknown symbols - try NASDAQ first
          newSymbol = `NASDAQ:${upperTerm}`;
        }
      }
      
      if (newSymbol && newSymbol !== chartSymbol) {
        setChartSymbol(newSymbol);
      }
    }
  };

  useEffect(() => {
    const symbolFromUrl = searchParams.get('symbol');
    if (symbolFromUrl) {
      setChartSymbol(symbolFromUrl);
    }
  }, [searchParams]);

  useEffect(() => {
    // Register search handler with layout
    setSearchHandler(handleSearch);
  }, [setSearchHandler]);

  return (
    <>
      <SEOHead
        title="Live Stock Markets - Real-Time Prices & Charts"
        description="Track live stock prices, charts, and market data. Real-time updates for SPY, QQQ, and thousands of stocks with TradingView integration."
        canonicalUrl="https://xraycrypto.io/markets"
        keywords="stock market, live prices, SPY, QQQ, NASDAQ, NYSE, stock charts, market analysis"
      />
    <div className="py-6 space-y-6">
      <div className="w-full">
        <div className="container mx-auto">
          <div className="text-center space-y-2">
            <h1 className="text-3xl font-bold xr-gradient-text">📈 Stock Markets</h1>
            <p className="text-muted-foreground">Real-time stock market data and analysis</p>
          </div>
          <div className="mt-6">
            <FinancialDisclaimer />
          </div>
        </div>
      </div>

      {/* Chart with exact nav width */}
      <div className="w-full">
        <div className="container mx-auto">
          <TradingViewChart symbol={chartSymbol} height="700px" />
        </div>
      </div>
      
      {/* Widgets with exact nav width */}
      <div className="w-full">
        <div className="container mx-auto">
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <StocksScreener />
            <StocksHeatmap />
          </div>
        </div>
      </div>
      
      {/* News with exact nav width */}
      <div className="w-full">
        <div className="container mx-auto">
          <NewsSection searchTerm={searchTerm} defaultTab="stocks" />
        </div>
      </div>
    </div>
    </>
  );
}