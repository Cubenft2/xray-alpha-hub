import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useLayoutSearch } from '@/components/Layout';
import { TradingViewChart } from '@/components/TradingViewChart';
import { StocksScreener } from '@/components/StocksScreener';
import { StocksHeatmap } from '@/components/StocksHeatmap';
import { NewsSection } from '@/components/NewsSection';
import { FinancialDisclaimer } from '@/components/FinancialDisclaimer';

export default function Stocks() {
  const [searchParams] = useSearchParams();
  const [chartSymbol, setChartSymbol] = useState<string>('AMEX:SPY');
  const [searchTerm, setSearchTerm] = useState('');
  const { setSearchHandler } = useLayoutSearch();

  const handleSearch = (term: string) => {
    setSearchTerm(term);
    
    if (term.length >= 2) {
      const upperTerm = term.toUpperCase();
      let newSymbol = '';
      
      // Stock mappings
      const stockMappings: { [key: string]: string } = {
        'SPY': 'AMEX:SPY',
        'QQQ': 'NASDAQ:QQQ',
        'IWM': 'AMEX:IWM',
        'DIA': 'AMEX:DIA',
        'AAPL': 'NASDAQ:AAPL',
        'APPLE': 'NASDAQ:AAPL',
        'MSFT': 'NASDAQ:MSFT',
        'MICROSOFT': 'NASDAQ:MSFT',
        'TSLA': 'NASDAQ:TSLA',
        'TESLA': 'NASDAQ:TSLA',
        'NVDA': 'NASDAQ:NVDA',
        'NVIDIA': 'NASDAQ:NVDA',
        'AMZN': 'NASDAQ:AMZN',
        'AMAZON': 'NASDAQ:AMZN',
        'GOOGL': 'NASDAQ:GOOGL',
        'GOOGLE': 'NASDAQ:GOOGL',
        'META': 'NASDAQ:META',
        'FACEBOOK': 'NASDAQ:META',
        'NFLX': 'NASDAQ:NFLX',
        'NETFLIX': 'NASDAQ:NFLX',
        'COIN': 'NASDAQ:COIN',
        'COINBASE': 'NASDAQ:COIN',
        'MSTR': 'NASDAQ:MSTR',
        'MICROSTRATEGY': 'NASDAQ:MSTR',
        'MARA': 'NASDAQ:MARA',
        'RIOT': 'NASDAQ:RIOT',
        'HUT': 'NASDAQ:HUT',
      };
      
      if (stockMappings[upperTerm]) {
        newSymbol = stockMappings[upperTerm];
      } else {
        newSymbol = `NASDAQ:${upperTerm}`;
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
    setSearchHandler(handleSearch);
  }, [setSearchHandler]);

  return (
    <div className="py-6 space-y-6">
      <div className="w-full">
        <div className="container mx-auto">
          <div className="text-center space-y-2">
            <h1 className="text-2xl font-bold xr-gradient-text font-pixel">📈 Stock Markets</h1>
            <p className="text-muted-foreground text-base">Real-time stock market data, charts, and financial analysis</p>
            <div className="flex items-center justify-center gap-4 text-sm text-muted-foreground font-pixel mt-4">
              <span>📊 Live Charts</span>
              <span>•</span>
              <span>🔥 Sector Maps</span>
              <span>•</span>
              <span>📈 Screeners</span>
              <span>•</span>
              <span>📰 Market News</span>
            </div>
          </div>
          <div className="mt-6">
            <FinancialDisclaimer />
          </div>
        </div>
      </div>

      {/* Interactive Chart */}
      <div className="w-full">
        <div className="container mx-auto">
          <TradingViewChart symbol={chartSymbol} height="700px" />
        </div>
      </div>
      
      {/* Stock Widgets */}
      <div className="w-full">
        <div className="container mx-auto">
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <StocksScreener />
            <StocksHeatmap />
          </div>
        </div>
      </div>
      
      {/* Stock News */}
      <div className="w-full">
        <div className="container mx-auto">
          <NewsSection searchTerm={searchTerm} defaultTab="stocks" />
        </div>
      </div>
    </div>
  );
}