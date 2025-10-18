import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useLayoutSearch } from '@/components/Layout';
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

  const handleSearch = (term: string) => {
    setSearchTerm(term);
    
    // Convert search term to TradingView symbol format
    if (term.length >= 2) {
      const upperTerm = term.toUpperCase();
      let newSymbol = '';
      
      // 1. Check database first for exact mapping
      const dbMapping = getMapping(upperTerm);
      if (dbMapping?.tradingview_symbol) {
        newSymbol = dbMapping.tradingview_symbol;
      } else {
        // 2. Fall back to hardcoded common mappings for performance
        const cryptoMappings: { [key: string]: string } = {
          'BTC': 'BINANCE:BTCUSDT',
          'BITCOIN': 'BINANCE:BTCUSDT',
          'ETH': 'BINANCE:ETHUSDT',
          'ETHEREUM': 'BINANCE:ETHUSDT',
          'BNB': 'BINANCE:BNBUSDT',
          'BINANCE': 'BINANCE:BNBUSDT',
          'SOL': 'BINANCE:SOLUSDT',
          'SOLANA': 'BINANCE:SOLUSDT',
          'XRP': 'BINANCE:XRPUSDT',
          'RIPPLE': 'BINANCE:XRPUSDT',
          'ADA': 'BINANCE:ADAUSDT',
          'CARDANO': 'BINANCE:ADAUSDT',
          'AVAX': 'BINANCE:AVAXUSDT',
          'AVALANCHE': 'BINANCE:AVAXUSDT',
          'DOGE': 'BINANCE:DOGEUSDT',
          'DOGECOIN': 'BINANCE:DOGEUSDT',
          'TRX': 'BINANCE:TRXUSDT',
          'TRON': 'BINANCE:TRXUSDT',
          'TON': 'BINANCE:TONUSDT',
          'TONCOIN': 'BINANCE:TONUSDT',
          'LINK': 'BINANCE:LINKUSDT',
          'CHAINLINK': 'BINANCE:LINKUSDT',
          'SHIB': 'BINANCE:SHIBUSDT',
          'SHIBA': 'BINANCE:SHIBUSDT',
          'DOT': 'BINANCE:DOTUSDT',
          'POLKADOT': 'BINANCE:DOTUSDT',
          'MATIC': 'BINANCE:MATICUSDT',
          'POLYGON': 'BINANCE:MATICUSDT',
          'UNI': 'BINANCE:UNIUSDT',
          'UNISWAP': 'BINANCE:UNIUSDT',
          'LTC': 'BINANCE:LTCUSDT',
          'LITECOIN': 'BINANCE:LTCUSDT',
          'BCH': 'BINANCE:BCHUSDT',
          'NEAR': 'BINANCE:NEARUSDT',
          'ICP': 'BINANCE:ICPUSDT',
          'APT': 'BINANCE:APTUSDT',
          'APTOS': 'BINANCE:APTUSDT',
          'FIL': 'BINANCE:FILUSDT',
          'FILECOIN': 'BINANCE:FILUSDT',
          'ARB': 'BINANCE:ARBUSDT',
          'ARBITRUM': 'BINANCE:ARBUSDT',
          'OP': 'BINANCE:OPUSDT',
          'OPTIMISM': 'BINANCE:OPUSDT',
          'HBAR': 'BINANCE:HBARUSDT',
          'HEDERA': 'BINANCE:HBARUSDT',
          'VET': 'BINANCE:VETUSDT',
          'VECHAIN': 'BINANCE:VETUSDT',
          'MKR': 'BINANCE:MKRUSDT',
          'MAKER': 'BINANCE:MKRUSDT',
          'ATOM': 'BINANCE:ATOMUSDT',
          'COSMOS': 'BINANCE:ATOMUSDT',
          'IMX': 'BINANCE:IMXUSDT',
          'IMMUTABLE': 'BINANCE:IMXUSDT',
          'RNDR': 'GEMINI:RNDRUSD',
          'RENDER': 'GEMINI:RNDRUSD',
          'STX': 'BINANCE:STXUSDT',
          'STACKS': 'BINANCE:STXUSDT',
          'INJ': 'BINANCE:INJUSDT',
          'INJECTIVE': 'BINANCE:INJUSDT',
          'GRT': 'BINANCE:GRTUSDT',
          'GRAPH': 'BINANCE:GRTUSDT',
          'RUNE': 'BINANCE:RUNEUSDT',
          'THORCHAIN': 'BINANCE:RUNEUSDT',
          'FTM': 'BINANCE:FTMUSDT',
          'FANTOM': 'BINANCE:FTMUSDT',
          'ALGO': 'BINANCE:ALGOUSDT',
          'ALGORAND': 'BINANCE:ALGOUSDT',
          'SAND': 'BINANCE:SANDUSDT',
          'SANDBOX': 'BINANCE:SANDUSDT',
          'MANA': 'BINANCE:MANAUSDT',
          'DECENTRALAND': 'BINANCE:MANAUSDT',
          'AAVE': 'BINANCE:AAVEUSDT',
          'EOS': 'BINANCE:EOSUSDT',
          'XTZ': 'BINANCE:XTZUSDT',
          'TEZOS': 'BINANCE:XTZUSDT',
          'THETA': 'BINANCE:THETAUSDT',
          'FLR': 'BINANCE:FLRUSDT',
          'FLARE': 'BINANCE:FLRUSDT',
          'AXS': 'BINANCE:AXSUSDT',
          'AXIE': 'BINANCE:AXSUSDT',
          'FLOW': 'BINANCE:FLOWUSDT',
          'SUI': 'BINANCE:SUIUSDT',
          'HYPE': 'BINANCE:HYPEUSDT',
          'HYPERLIQUID': 'BINANCE:HYPEUSDT',
        };
        
        // Check for exact matches in hardcoded list
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
            // 3. Last resort: try exchanges in priority order (MEXC → GATEIO → KUCOIN → BYBIT → OKX → BINANCE)
            const exchanges = ['MEXC', 'GATEIO', 'KUCOIN', 'BYBIT', 'OKX', 'BINANCE'];
            newSymbol = `${exchanges[0]}:${upperTerm}USDT`;
          }
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
      // Convert symbol to TradingView format
      const upperSymbol = symbolFromUrl.toUpperCase();
      let newSymbol = '';
      
      // 1. Check database first for exact mapping
      const dbMapping = getMapping(upperSymbol);
      if (dbMapping?.tradingview_symbol) {
        newSymbol = dbMapping.tradingview_symbol;
      } else {
        // 2. Fall back to hardcoded common mappings
        const cryptoMappings: { [key: string]: string } = {
          'BTC': 'BINANCE:BTCUSDT',
          'BITCOIN': 'BINANCE:BTCUSDT',
          'ETH': 'BINANCE:ETHUSDT',
          'ETHEREUM': 'BINANCE:ETHUSDT',
          'BNB': 'BINANCE:BNBUSDT',
          'BINANCE': 'BINANCE:BNBUSDT',
          'SOL': 'BINANCE:SOLUSDT',
          'SOLANA': 'BINANCE:SOLUSDT',
          'XRP': 'BINANCE:XRPUSDT',
          'RIPPLE': 'BINANCE:XRPUSDT',
          'ADA': 'BINANCE:ADAUSDT',
          'CARDANO': 'BINANCE:ADAUSDT',
          'AVAX': 'BINANCE:AVAXUSDT',
          'AVALANCHE': 'BINANCE:AVAXUSDT',
          'DOGE': 'BINANCE:DOGEUSDT',
          'DOGECOIN': 'BINANCE:DOGEUSDT',
          'TRX': 'BINANCE:TRXUSDT',
          'TRON': 'BINANCE:TRXUSDT',
          'TON': 'BINANCE:TONUSDT',
          'TONCOIN': 'BINANCE:TONUSDT',
          'LINK': 'BINANCE:LINKUSDT',
          'CHAINLINK': 'BINANCE:LINKUSDT',
          'SHIB': 'BINANCE:SHIBUSDT',
          'SHIBA': 'BINANCE:SHIBUSDT',
          'DOT': 'BINANCE:DOTUSDT',
          'POLKADOT': 'BINANCE:DOTUSDT',
          'MATIC': 'BINANCE:MATICUSDT',
          'POLYGON': 'BINANCE:MATICUSDT',
          'UNI': 'BINANCE:UNIUSDT',
          'UNISWAP': 'BINANCE:UNIUSDT',
          'LTC': 'BINANCE:LTCUSDT',
          'LITECOIN': 'BINANCE:LTCUSDT',
          'BCH': 'BINANCE:BCHUSDT',
          'NEAR': 'BINANCE:NEARUSDT',
          'ICP': 'BINANCE:ICPUSDT',
          'APT': 'BINANCE:APTUSDT',
          'APTOS': 'BINANCE:APTUSDT',
          'FIL': 'BINANCE:FILUSDT',
          'FILECOIN': 'BINANCE:FILUSDT',
          'ARB': 'BINANCE:ARBUSDT',
          'ARBITRUM': 'BINANCE:ARBUSDT',
          'OP': 'BINANCE:OPUSDT',
          'OPTIMISM': 'BINANCE:OPUSDT',
          'HBAR': 'BINANCE:HBARUSDT',
          'HEDERA': 'BINANCE:HBARUSDT',
          'VET': 'BINANCE:VETUSDT',
          'VECHAIN': 'BINANCE:VETUSDT',
          'MKR': 'BINANCE:MKRUSDT',
          'MAKER': 'BINANCE:MKRUSDT',
          'ATOM': 'BINANCE:ATOMUSDT',
          'COSMOS': 'BINANCE:ATOMUSDT',
          'IMX': 'BINANCE:IMXUSDT',
          'IMMUTABLE': 'BINANCE:IMXUSDT',
          'RNDR': 'GEMINI:RNDRUSD',
          'RENDER': 'GEMINI:RNDRUSD',
          'STX': 'BINANCE:STXUSDT',
          'STACKS': 'BINANCE:STXUSDT',
          'INJ': 'BINANCE:INJUSDT',
          'INJECTIVE': 'BINANCE:INJUSDT',
          'GRT': 'BINANCE:GRTUSDT',
          'GRAPH': 'BINANCE:GRTUSDT',
          'RUNE': 'BINANCE:RUNEUSDT',
          'THORCHAIN': 'BINANCE:RUNEUSDT',
          'FTM': 'BINANCE:FTMUSDT',
          'FANTOM': 'BINANCE:FTMUSDT',
          'ALGO': 'BINANCE:ALGOUSDT',
          'ALGORAND': 'BINANCE:ALGOUSDT',
          'SAND': 'BINANCE:SANDUSDT',
          'SANDBOX': 'BINANCE:SANDUSDT',
          'MANA': 'BINANCE:MANAUSDT',
          'DECENTRALAND': 'BINANCE:MANAUSDT',
          'AAVE': 'BINANCE:AAVEUSDT',
          'EOS': 'BINANCE:EOSUSDT',
          'XTZ': 'BINANCE:XTZUSDT',
          'TEZOS': 'BINANCE:XTZUSDT',
          'THETA': 'BINANCE:THETAUSDT',
          'FLR': 'BINANCE:FLRUSDT',
          'FLARE': 'BINANCE:FLRUSDT',
          'AXS': 'BINANCE:AXSUSDT',
          'AXIE': 'BINANCE:AXSUSDT',
          'FLOW': 'BINANCE:FLOWUSDT',
          'SUI': 'BINANCE:SUIUSDT',
          'HYPE': 'BINANCE:HYPEUSDT',
          'HYPERLIQUID': 'BINANCE:HYPEUSDT',
        };
        
        if (cryptoMappings[upperSymbol]) {
          newSymbol = cryptoMappings[upperSymbol];
        } else {
          // Check if it's already in TradingView format
          if (symbolFromUrl.includes(':')) {
            newSymbol = symbolFromUrl;
          } else {
            // 3. Last resort: try exchanges in priority order (MEXC → GATEIO → KUCOIN → BYBIT → OKX → BINANCE)
            const exchanges = ['MEXC', 'GATEIO', 'KUCOIN', 'BYBIT', 'OKX', 'BINANCE'];
            newSymbol = `${exchanges[0]}:${upperSymbol}USDT`;
          }
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
    <div className="py-6">
      <FinancialDisclaimer />
      
      <div className="w-full">
        <div className="container mx-auto">
          <div className="space-y-6">
            {/* Hero Section */}
            <div className="text-center py-8" style={{ minHeight: '200px' }}>
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

      {/* Real-Time Price Ticker - Mixed Crypto & Stocks */}
      <div className="w-full mb-6">
        <div className="container mx-auto">
          <RealTimePriceTicker symbols={['BTC', 'ETH', 'SOL', 'SPY', 'AAPL', 'COIN']} />
        </div>
      </div>

      {/* Main Chart - Full nav width */}
      <div className="w-full mb-6">
        <div className="container mx-auto" style={{ minHeight: '700px' }}>
          <TradingViewChart symbol={chartSymbol} height="700px" />
        </div>
      </div>

      {/* Dashboard Grid - Full nav width */}
      <div className="w-full">
        <div className="container mx-auto">
          <div className="grid grid-cols-1 gap-6">
            {/* Crypto Screener - Full width */}
            <div style={{ minHeight: '600px' }}>
              <CryptoScreener />
            </div>

            {/* Crypto Heatmap - Full width */}
            <div style={{ minHeight: '450px' }}>
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
