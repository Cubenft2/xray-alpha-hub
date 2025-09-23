import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useLayoutSearch } from '@/components/Layout';
import { TradingViewChart } from '@/components/TradingViewChart';
import { CryptoScreener } from '@/components/CryptoScreener';
import { CryptoHeatmap } from '@/components/CryptoHeatmap';
import { NewsSection } from '@/components/NewsSection';

const Index = () => {
  const [searchParams] = useSearchParams();
  const [chartSymbol, setChartSymbol] = useState<string>('BINANCE:BTCUSDT');
  const [searchTerm, setSearchTerm] = useState('');
  const { setSearchHandler } = useLayoutSearch();

  const handleSearch = (term: string) => {
    setSearchTerm(term);
    
    // Convert search term to TradingView symbol format
    if (term.length >= 2) {
      const upperTerm = term.toUpperCase();
      let newSymbol = '';
      
      // Map common crypto symbols to TradingView format
      const cryptoMappings: { [key: string]: string } = {
        'BTC': 'BINANCE:BTCUSDT',
        'BITCOIN': 'BINANCE:BTCUSDT',
        'ETH': 'BINANCE:ETHUSDT',
        'ETHEREUM': 'BINANCE:ETHUSDT',
        'SOL': 'BINANCE:SOLUSDT',
        'SOLANA': 'BINANCE:SOLUSDT',
        'ADA': 'BINANCE:ADAUSDT',
        'CARDANO': 'BINANCE:ADAUSDT',
        'DOT': 'BINANCE:DOTUSDT',
        'POLKADOT': 'BINANCE:DOTUSDT',
        'MATIC': 'BINANCE:MATICUSDT',
        'POLYGON': 'BINANCE:MATICUSDT',
        'AVAX': 'BINANCE:AVAXUSDT',
        'AVALANCHE': 'BINANCE:AVAXUSDT',
        'LINK': 'BINANCE:LINKUSDT',
        'CHAINLINK': 'BINANCE:LINKUSDT',
        'UNI': 'BINANCE:UNIUSDT',
        'UNISWAP': 'BINANCE:UNIUSDT',
        'LTC': 'BINANCE:LTCUSDT',
        'LITECOIN': 'BINANCE:LTCUSDT',
        'XRP': 'BINANCE:XRPUSDT',
        'RIPPLE': 'BINANCE:XRPUSDT',
        'DOGE': 'BINANCE:DOGEUSDT',
        'DOGECOIN': 'BINANCE:DOGEUSDT',
        'FLR': 'BITSTAMP:FLRUSD',
        'FLARE': 'BITSTAMP:FLRUSD',
      };
      
      // Check for exact matches first
      if (cryptoMappings[upperTerm]) {
        newSymbol = cryptoMappings[upperTerm];
      } else {
        // Try to find partial matches
        const matchedKey = Object.keys(cryptoMappings).find(key => 
          key.startsWith(upperTerm) || key.includes(upperTerm)
        );
        if (matchedKey) {
          newSymbol = cryptoMappings[matchedKey];
        } else {
          // Default format for unknown symbols
          newSymbol = `BINANCE:${upperTerm}USDT`;
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
    <div className="py-6">
      <div className="w-full">
        <div className="container mx-auto">
          <div className="space-y-6">
            {/* Hero Section */}
            <div className="text-center py-8">
              <h1 className="text-4xl sm:text-5xl font-bold xr-gradient-text mb-4">
                Welcome to XRayCrypto™
              </h1>
              <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                Your ultimate crypto & stocks dashboard. Real-time charts, live news, 
                and community support - all in one place! ☢️
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Chart - Full nav width */}
      <div className="w-full mb-6">
        <div className="container mx-auto">
          <TradingViewChart symbol={chartSymbol} height="700px" />
        </div>
      </div>

      {/* Dashboard Grid - Full nav width */}
      <div className="w-full">
        <div className="container mx-auto">
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
      </div>

      {/* News Section - Full nav width */}
      <div className="w-full">
        <div className="container mx-auto">
          <NewsSection searchTerm={searchTerm} defaultTab="crypto" />
        </div>
      </div>
    </div>
  );
};

export default Index;
