import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useLayoutSearch } from '@/components/Layout';
import { TradingViewChart } from '@/components/TradingViewChart';
import { CryptoScreener } from '@/components/CryptoScreener';
import { CryptoHeatmap } from '@/components/CryptoHeatmap';
import { StocksScreener } from '@/components/StocksScreener';
import { StocksHeatmap } from '@/components/StocksHeatmap';
import { NewsSection } from '@/components/NewsSection';
import { FinancialDisclaimer } from '@/components/FinancialDisclaimer';

export default function Markets() {
  const [searchParams] = useSearchParams();
  const [chartSymbol, setChartSymbol] = useState<string>('BINANCE:BTCUSDT');
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'crypto' | 'stocks'>('crypto');
  const { setSearchHandler } = useLayoutSearch();

  const handleSearch = (term: string) => {
    setSearchTerm(term);
    
    if (term.length >= 2) {
      const upperTerm = term.toUpperCase();
      let newSymbol = '';
      
      // Crypto mappings
      const cryptoMappings: { [key: string]: string } = {
        'BTC': 'BINANCE:BTCUSDT',
        'BITCOIN': 'BINANCE:BTCUSDT',
        'ETH': 'BINANCE:ETHUSDT',
        'ETHEREUM': 'BINANCE:ETHUSDT',
        'SOL': 'BINANCE:SOLUSDT',
        'SOLANA': 'BINANCE:SOLUSDT',
        'ADA': 'BINANCE:ADAUSDT',
        'CARDANO': 'BINANCE:ADAUSDT',
        'MATIC': 'BINANCE:MATICUSDT',
        'POLYGON': 'BINANCE:MATICUSDT',
      };

      // Stock mappings
      const stockMappings: { [key: string]: string } = {
        'SPY': 'AMEX:SPY',
        'QQQ': 'NASDAQ:QQQ',
        'AAPL': 'NASDAQ:AAPL',
        'APPLE': 'NASDAQ:AAPL',
        'MSFT': 'NASDAQ:MSFT',
        'MICROSOFT': 'NASDAQ:MSFT',
        'TSLA': 'NASDAQ:TSLA',
        'TESLA': 'NASDAQ:TSLA',
        'NVDA': 'NASDAQ:NVDA',
        'NVIDIA': 'NASDAQ:NVDA',
      };
      
      const mappings = activeTab === 'crypto' ? cryptoMappings : stockMappings;
      
      if (mappings[upperTerm]) {
        newSymbol = mappings[upperTerm];
      } else {
        newSymbol = activeTab === 'crypto' ? `BINANCE:${upperTerm}USDT` : `NASDAQ:${upperTerm}`;
      }
      
      if (newSymbol && newSymbol !== chartSymbol) {
        setChartSymbol(newSymbol);
      }
    }
  };

  const handleTabChange = (tab: 'crypto' | 'stocks') => {
    setActiveTab(tab);
    setChartSymbol(tab === 'crypto' ? 'BINANCE:BTCUSDT' : 'AMEX:SPY');
  };

  useEffect(() => {
    const symbolFromUrl = searchParams.get('symbol');
    if (symbolFromUrl) {
      setChartSymbol(symbolFromUrl);
    }
  }, [searchParams]);

  useEffect(() => {
    setSearchHandler(handleSearch);
  }, [setSearchHandler, activeTab]);

  return (
    <div className="py-6 space-y-6">
      <div className="w-full">
        <div className="container mx-auto">
          <div className="text-center space-y-2">
            <h1 className="text-3xl font-bold xr-gradient-text">📊 Markets Dashboard</h1>
            <p className="text-muted-foreground">Real-time crypto & stock market data</p>
          </div>
          <div className="mt-6">
            <FinancialDisclaimer />
          </div>
        </div>
      </div>

      {/* Tab Selector */}
      <div className="w-full">
        <div className="container mx-auto">
          <div className="flex justify-center">
            <div className="flex bg-card rounded-lg p-1 border">
              <button
                onClick={() => handleTabChange('crypto')}
                className={`px-6 py-2 rounded-md transition-colors ${
                  activeTab === 'crypto' 
                    ? 'bg-primary text-primary-foreground' 
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                🪙 Crypto
              </button>
              <button
                onClick={() => handleTabChange('stocks')}
                className={`px-6 py-2 rounded-md transition-colors ${
                  activeTab === 'stocks' 
                    ? 'bg-primary text-primary-foreground' 
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                📈 Stocks
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="w-full">
        <div className="container mx-auto">
          <TradingViewChart symbol={chartSymbol} height="700px" />
        </div>
      </div>
      
      {/* Widgets */}
      <div className="w-full">
        <div className="container mx-auto">
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {activeTab === 'crypto' ? (
              <>
                <CryptoScreener />
                <CryptoHeatmap />
              </>
            ) : (
              <>
                <StocksScreener />
                <StocksHeatmap />
              </>
            )}
          </div>
        </div>
      </div>
      
      {/* News */}
      <div className="w-full">
        <div className="container mx-auto">
          <NewsSection searchTerm={searchTerm} defaultTab={activeTab === 'crypto' ? 'crypto' : 'stocks'} />
        </div>
      </div>
    </div>
  );
}