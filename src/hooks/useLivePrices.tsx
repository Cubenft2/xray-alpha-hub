import { useState, useEffect, useRef } from 'react';

interface PriceData {
  price: number;
  change_24h: number;
  market_cap_rank?: number;
  symbol: string;
  name: string;
}

interface LivePricesData {
  [symbol: string]: PriceData;
}

export function useLivePrices(tickers: string[] = []) {
  const [prices, setPrices] = useState<LivePricesData>({});
  const [loading, setLoading] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout>();

  const fetchPrices = async (tickerList: string[]) => {
    if (tickerList.length === 0) return;

    try {
      setLoading(true);
      
      // Create a comma-separated list of ticker symbols
      const tickerParams = tickerList.join(',').toLowerCase();
      
      // Fetch from CoinGecko API - using coins/markets endpoint for live data
      const response = await fetch(
        `https://api.coingecko.com/api/v3/simple/price?ids=${tickerParams}&vs_currencies=usd&include_24hr_change=true&include_market_cap=true`,
        {
          headers: {
            'Accept': 'application/json'
          }
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log('🔴 Live prices fetched:', data);

      // Transform the data to match our format
      const transformedPrices: LivePricesData = {};
      
      Object.entries(data).forEach(([coinId, priceInfo]: [string, any]) => {
        // Map coin IDs back to ticker symbols
        const symbol = mapCoinIdToSymbol(coinId);
        if (symbol && priceInfo.usd) {
          transformedPrices[symbol] = {
            price: priceInfo.usd,
            change_24h: priceInfo.usd_24h_change || 0,
            market_cap_rank: priceInfo.market_cap_rank,
            symbol: symbol,
            name: coinId.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
          };
        }
      });

      setPrices(prev => ({
        ...prev,
        ...transformedPrices
      }));

    } catch (error) {
      console.error('🔴 Error fetching live prices:', error);
    } finally {
      setLoading(false);
    }
  };

  // Map ticker symbols to CoinGecko coin IDs
  const mapSymbolToCoinId = (symbol: string): string => {
    const symbolMap: { [key: string]: string } = {
      'BTC': 'bitcoin',
      'BITCOIN': 'bitcoin',
      'ETH': 'ethereum',
      'ETHEREUM': 'ethereum',
      'SOL': 'solana',
      'SOLANA': 'solana',
      'ADA': 'cardano',
      'CARDANO': 'cardano',
      'AVAX': 'avalanche-2',
      'AVALANCHE': 'avalanche-2',
      'DOT': 'polkadot',
      'POLKADOT': 'polkadot',
      'MATIC': 'matic-network',
      'POLYGON': 'matic-network',
      'LINK': 'chainlink',
      'CHAINLINK': 'chainlink',
      'UNI': 'uniswap',
      'UNISWAP': 'uniswap',
      'XRP': 'ripple',
      'RIPPLE': 'ripple',
      'DOGE': 'dogecoin',
      'DOGECOIN': 'dogecoin',
      'ASTER': 'aster',
      'HYPE': 'hyperliquid',
      'HYPERLIQUID': 'hyperliquid',
      'SUI': 'sui',
      'BNB': 'binancecoin',
      'WBTC': 'wrapped-bitcoin',
      'USDE': 'ethena-usde'
    };
    
    return symbolMap[symbol.toUpperCase()] || symbol.toLowerCase();
  };

  // Map coin IDs back to ticker symbols
  const mapCoinIdToSymbol = (coinId: string): string => {
    const idToSymbolMap: { [key: string]: string } = {
      'bitcoin': 'BTC',
      'ethereum': 'ETH', 
      'solana': 'SOL',
      'cardano': 'ADA',
      'avalanche-2': 'AVAX',
      'polkadot': 'DOT',
      'matic-network': 'MATIC',
      'chainlink': 'LINK',
      'uniswap': 'UNI',
      'ripple': 'XRP',
      'dogecoin': 'DOGE',
      'aster': 'ASTER',
      'hyperliquid': 'HYPE',
      'sui': 'SUI',
      'binancecoin': 'BNB',
      'wrapped-bitcoin': 'WBTC',
      'ethena-usde': 'USDE'
    };
    
    return idToSymbolMap[coinId] || coinId.toUpperCase();
  };

  useEffect(() => {
    if (tickers.length === 0) return;

    // Map ticker symbols to CoinGecko coin IDs
    const coinIds = tickers.map(mapSymbolToCoinId).filter(Boolean);
    
    // Initial fetch
    fetchPrices(coinIds);

    // Set up polling every 30 seconds for live updates
    intervalRef.current = setInterval(() => {
      fetchPrices(coinIds);
    }, 30000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [tickers.join(',')]); // Re-run when tickers change

  return { prices, loading, refetch: () => fetchPrices(tickers.map(mapSymbolToCoinId)) };
}