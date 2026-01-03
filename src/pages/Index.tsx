import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useLayoutSearch } from '@/components/Layout';
import { SEOHead } from '@/components/SEOHead';
import { TradingViewChart } from '@/components/TradingViewChart';
import { CryptoScreener } from '@/components/CryptoScreener';
import { CryptoHeatmap } from '@/components/CryptoHeatmap';
import { NewsSection } from '@/components/NewsSection';
import { FinancialDisclaimer } from '@/components/FinancialDisclaimer';
import { PolygonTicker } from '@/components/PolygonTicker';
import { useTickerMappings } from '@/hooks/useTickerMappings';
import { RealTimePriceTicker } from '@/components/RealTimePriceTicker';

const Index = () => {
  const [searchParams] = useSearchParams();
  const [chartSymbol, setChartSymbol] = useState<string>('BINANCE:BTCUSDT');
  const [searchTerm, setSearchTerm] = useState('');
  const { setSearchHandler } = useLayoutSearch();
  const { getMapping, isLoading } = useTickerMappings();

  // Extract base symbol from display name formats
  const extractSymbol = (input: string): string => {
    // If already uppercase ticker format (BTC, ETH, AVAX), return as-is
    if (/^[A-Z]{2,10}$/.test(input)) return input;
    
    // Extract symbol from display name format: "Avalanche (AVAX)" -> "AVAX"
    const match = input.match(/\(([A-Z]{2,10})\)/);
    if (match) return match[1];
    
    // Extract from formats like "AVAX - Avalanche"
    const dashMatch = input.match(/^([A-Z]{2,10})\s*[-–]/);
    if (dashMatch) return dashMatch[1];
    
    // Return cleaned uppercase version
    return input.replace(/[^A-Z0-9]/g, '').toUpperCase();
  };

  const handleSearch = (term: string) => {
    setSearchTerm(term);
    
    // Convert search term to TradingView symbol format
    if (term.length >= 2) {
      const baseSymbol = extractSymbol(term);
      let newSymbol = '';
      
      // 1. Check database first for exact mapping
      const dbMapping = getMapping(baseSymbol);
      if (dbMapping?.tradingview_symbol) {
        newSymbol = dbMapping.tradingview_symbol;
      } else {
        // 2. Fall back to minimal hardcoded mappings (only top 10)
        const cryptoMappings: { [key: string]: string } = {
          'BTC': 'BINANCE:BTCUSDT',
          'BITCOIN': 'BINANCE:BTCUSDT',
          'ETH': 'BINANCE:ETHUSDT',
          'ETHEREUM': 'BINANCE:ETHUSDT',
          'BNB': 'BINANCE:BNBUSDT',
          'SOL': 'BINANCE:SOLUSDT',
          'SOLANA': 'BINANCE:SOLUSDT',
          'XRP': 'BINANCE:XRPUSDT',
          'RIPPLE': 'BINANCE:XRPUSDT',
          'DOGE': 'BINANCE:DOGEUSDT',
          'DOGECOIN': 'BINANCE:DOGEUSDT',
        };
        
        if (cryptoMappings[baseSymbol]) {
          newSymbol = cryptoMappings[baseSymbol];
        } else {
          // 3. Last resort: construct BINANCE pair
          newSymbol = `BINANCE:${baseSymbol}USDT`;
        }
      }
      
      if (newSymbol && newSymbol !== chartSymbol) {
        setChartSymbol(newSymbol);
      }
    }
  };

  useEffect(() => {
    const symbolFromUrl = searchParams.get('symbol');
    if (symbolFromUrl && !isLoading) {
      // Extract base symbol from display name if needed
      const baseSymbol = extractSymbol(symbolFromUrl);
      let newSymbol = '';
      
      // 1. Check database first for exact mapping
      const dbMapping = getMapping(baseSymbol);
      if (dbMapping?.tradingview_symbol) {
        newSymbol = dbMapping.tradingview_symbol;
      } else if (symbolFromUrl.includes(':')) {
        // 2. If already in TradingView format (e.g., "BINANCE:BTCUSDT")
        newSymbol = symbolFromUrl;
      } else {
        // 3. Fall back to minimal hardcoded mappings (only top 10)
        const cryptoMappings: { [key: string]: string } = {
          'BTC': 'BINANCE:BTCUSDT',
          'BITCOIN': 'BINANCE:BTCUSDT',
          'ETH': 'BINANCE:ETHUSDT',
          'ETHEREUM': 'BINANCE:ETHUSDT',
          'BNB': 'BINANCE:BNBUSDT',
          'SOL': 'BINANCE:SOLUSDT',
          'SOLANA': 'BINANCE:SOLUSDT',
          'XRP': 'BINANCE:XRPUSDT',
          'RIPPLE': 'BINANCE:XRPUSDT',
          'DOGE': 'BINANCE:DOGEUSDT',
          'DOGECOIN': 'BINANCE:DOGEUSDT',
        };
        
        if (cryptoMappings[baseSymbol]) {
          newSymbol = cryptoMappings[baseSymbol];
        } else {
          // 4. Last resort: construct BINANCE pair
          newSymbol = `BINANCE:${baseSymbol}USDT`;
        }
      }
      
      setChartSymbol(newSymbol);
    }
  }, [searchParams, getMapping, isLoading]);

  useEffect(() => {
    // Register search handler with layout
    setSearchHandler(handleSearch);
  }, [setSearchHandler]);
  return (
    <>
      <SEOHead
        title="XRayCrypto - Real-Time Crypto & Stock Dashboard"
        description="Your ultimate crypto & stocks dashboard with ZombieDog AI assistant. Real-time charts, live news, market analysis, and 7,500+ cryptocurrencies."
        canonicalUrl="https://xraycrypto.io/"
        keywords="cryptocurrency, bitcoin, ethereum, crypto dashboard, stock market, real-time prices, trading, ZombieDog AI"
      />
      <div className="py-6">
        <FinancialDisclaimer />
      
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

      {/* Real-Time Price Ticker */}
      <div className="w-full mb-6">
        <div className="container mx-auto">
          <RealTimePriceTicker symbols={['BTC', 'ETH', 'SOL', 'AVAX', 'MATIC', 'LINK', 'CAKE']} />
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
    </>
  );
};

export default Index;
