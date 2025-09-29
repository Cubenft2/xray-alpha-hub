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
      'USDT': 'tether',
      'TETHER': 'tether',
      'BNB': 'binancecoin',
      'BINANCE': 'binancecoin',
      'SOL': 'solana',
      'SOLANA': 'solana',
      'USDC': 'usd-coin',
      'XRP': 'ripple',
      'RIPPLE': 'ripple',
      'STETH': 'staked-ether',
      'ADA': 'cardano',
      'CARDANO': 'cardano',
      'AVAX': 'avalanche-2',
      'AVALANCHE': 'avalanche-2',
      'DOGE': 'dogecoin',
      'DOGECOIN': 'dogecoin',
      'TRX': 'tron',
      'TRON': 'tron',
      'TON': 'the-open-network',
      'TONCOIN': 'the-open-network',
      'LINK': 'chainlink',
      'CHAINLINK': 'chainlink',
      'SHIB': 'shiba-inu',
      'SHIBA': 'shiba-inu',
      'DOT': 'polkadot',
      'POLKADOT': 'polkadot',
      'MATIC': 'matic-network',
      'POLYGON': 'matic-network',
      'WBTC': 'wrapped-bitcoin',
      'DAI': 'dai',
      'UNI': 'uniswap',
      'UNISWAP': 'uniswap',
      'LTC': 'litecoin',
      'LITECOIN': 'litecoin',
      'BCH': 'bitcoin-cash',
      'LEO': 'leo-token',
      'NEAR': 'near',
      'ICP': 'internet-computer',
      'APT': 'aptos',
      'FIL': 'filecoin',
      'FILECOIN': 'filecoin',
      'ARB': 'arbitrum',
      'ARBITRUM': 'arbitrum',
      'OP': 'optimism',
      'OPTIMISM': 'optimism',
      'HBAR': 'hedera-hashgraph',
      'HEDERA': 'hedera-hashgraph',
      'VET': 'vechain',
      'VECHAIN': 'vechain',
      'MKR': 'maker',
      'MAKER': 'maker',
      'ATOM': 'cosmos',
      'COSMOS': 'cosmos',
      'IMX': 'immutable-x',
      'IMMUTABLE': 'immutable-x',
      'RNDR': 'render-token',
      'RENDER': 'render-token',
      'STX': 'blockstack',
      'STACKS': 'blockstack',
      'INJ': 'injective-protocol',
      'INJECTIVE': 'injective-protocol',
      'GRT': 'the-graph',
      'GRAPH': 'the-graph',
      'RUNE': 'thorchain',
      'THORCHAIN': 'thorchain',
      'FTM': 'fantom',
      'FANTOM': 'fantom',
      'ALGO': 'algorand',
      'ALGORAND': 'algorand',
      'SAND': 'the-sandbox',
      'SANDBOX': 'the-sandbox',
      'MANA': 'decentraland',
      'DECENTRALAND': 'decentraland',
      'AAVE': 'aave',
      'EOS': 'eos',
      'XTZ': 'tezos',
      'TEZOS': 'tezos',
      'THETA': 'theta-token',
      'FLR': 'flare-networks',
      'FLARE': 'flare-networks',
      'AXS': 'axie-infinity',
      'AXIE': 'axie-infinity',
      'FLOW': 'flow',
      'ASTER': 'aster',
      'HYPE': 'hyperliquid',
      'HYPERLIQUID': 'hyperliquid',
      'SUI': 'sui',
      'USDE': 'ethena-usde'
    };
    
    return symbolMap[symbol.toUpperCase()] || symbol.toLowerCase();
  };

  // Map coin IDs back to ticker symbols
  const mapCoinIdToSymbol = (coinId: string): string => {
    const idToSymbolMap: { [key: string]: string } = {
      'bitcoin': 'BTC',
      'ethereum': 'ETH',
      'tether': 'USDT',
      'binancecoin': 'BNB',
      'solana': 'SOL',
      'usd-coin': 'USDC',
      'ripple': 'XRP',
      'staked-ether': 'STETH',
      'cardano': 'ADA',
      'avalanche-2': 'AVAX',
      'dogecoin': 'DOGE',
      'tron': 'TRX',
      'the-open-network': 'TON',
      'chainlink': 'LINK',
      'shiba-inu': 'SHIB',
      'polkadot': 'DOT',
      'matic-network': 'MATIC',
      'wrapped-bitcoin': 'WBTC',
      'dai': 'DAI',
      'uniswap': 'UNI',
      'litecoin': 'LTC',
      'bitcoin-cash': 'BCH',
      'leo-token': 'LEO',
      'near': 'NEAR',
      'internet-computer': 'ICP',
      'aptos': 'APT',
      'filecoin': 'FIL',
      'arbitrum': 'ARB',
      'optimism': 'OP',
      'hedera-hashgraph': 'HBAR',
      'vechain': 'VET',
      'maker': 'MKR',
      'cosmos': 'ATOM',
      'immutable-x': 'IMX',
      'render-token': 'RNDR',
      'blockstack': 'STX',
      'injective-protocol': 'INJ',
      'the-graph': 'GRT',
      'thorchain': 'RUNE',
      'fantom': 'FTM',
      'algorand': 'ALGO',
      'the-sandbox': 'SAND',
      'decentraland': 'MANA',
      'aave': 'AAVE',
      'eos': 'EOS',
      'tezos': 'XTZ',
      'theta-token': 'THETA',
      'flare-networks': 'FLR',
      'axie-infinity': 'AXS',
      'flow': 'FLOW',
      'aster': 'ASTER',
      'hyperliquid': 'HYPE',
      'sui': 'SUI',
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