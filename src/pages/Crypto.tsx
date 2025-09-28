import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useLayoutSearch } from '@/components/Layout';
import { TradingViewChart } from '@/components/TradingViewChart';
import { CryptoScreener } from '@/components/CryptoScreener';
import { CryptoHeatmap } from '@/components/CryptoHeatmap';
import { NewsSection } from '@/components/NewsSection';
import { FinancialDisclaimer } from '@/components/FinancialDisclaimer';

export default function Crypto() {
  const [searchParams] = useSearchParams();
  const [chartSymbol, setChartSymbol] = useState<string>('BINANCE:BTCUSDT');
  const [searchTerm, setSearchTerm] = useState('');
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
        'AVAX': 'BINANCE:AVAXUSDT',
        'AVALANCHE': 'BINANCE:AVAXUSDT',
        'LINK': 'BINANCE:LINKUSDT',
        'CHAINLINK': 'BINANCE:LINKUSDT',
        'XRP': 'BINANCE:XRPUSDT',
        'DOGE': 'BINANCE:DOGEUSDT',
        'DOGECOIN': 'BINANCE:DOGEUSDT',
        'ARB': 'BINANCE:ARBUSDT',
        'ARBITRUM': 'BINANCE:ARBUSDT',
        'OP': 'BINANCE:OPUSDT',
        'OPTIMISM': 'BINANCE:OPUSDT',
        'DOT': 'BINANCE:DOTUSDT',
        'POLKADOT': 'BINANCE:DOTUSDT',
        'ATOM': 'BINANCE:ATOMUSDT',
        'COSMOS': 'BINANCE:ATOMUSDT',
        'INJ': 'BINANCE:INJUSDT',
        'INJECTIVE': 'BINANCE:INJUSDT',
      };
      
      if (cryptoMappings[upperTerm]) {
        newSymbol = cryptoMappings[upperTerm];
      } else {
        newSymbol = `BINANCE:${upperTerm}USDT`;
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
            <h1 className="text-4xl font-bold xr-gradient-text font-pixel">🪙 Crypto Markets</h1>
            <p className="text-muted-foreground text-lg">Real-time cryptocurrency data, charts, and analysis</p>
            <div className="flex items-center justify-center gap-4 text-sm text-muted-foreground font-pixel mt-4">
              <span>📊 Live Charts</span>
              <span>•</span>
              <span>🔥 Heatmaps</span>
              <span>•</span>
              <span>📈 Screeners</span>
              <span>•</span>
              <span>📰 Crypto News</span>
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
          <div className="mb-4">
            <h2 className="text-2xl font-bold text-center font-pixel text-primary">
              📈 Live Trading Chart
            </h2>
            <p className="text-center text-muted-foreground">
              Search for any crypto symbol in the header to update the chart
            </p>
          </div>
          <TradingViewChart symbol={chartSymbol} height="700px" />
        </div>
      </div>
      
      {/* Crypto Widgets */}
      <div className="w-full">
        <div className="container mx-auto">
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <CryptoScreener />
            <CryptoHeatmap />
          </div>
        </div>
      </div>
      
      {/* Crypto News */}
      <div className="w-full">
        <div className="container mx-auto">
          <NewsSection searchTerm={searchTerm} defaultTab="crypto" />
        </div>
      </div>
    </div>
  );
}