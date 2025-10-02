import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

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

      // Normalize and de-duplicate symbols
      const symbols = [...new Set(tickerList.map((s) => s.toUpperCase().trim()))];

      // Fetch via Supabase Edge Function to avoid CORS/rate limits
      const { data, error } = await supabase.functions.invoke('quotes', {
        body: { symbols }
      });

      if (error) throw error;
      if (!data || !Array.isArray(data.quotes)) {
        throw new Error('Invalid quotes response');
      }

      const transformedPrices: LivePricesData = {};
      for (const q of data.quotes) {
        if (!q || !q.symbol) continue;
        const sym = q.symbol.toUpperCase();
        if (q.price !== null && typeof q.price === 'number') {
          transformedPrices[sym] = {
            price: q.price,
            change_24h: typeof q.change24h === 'number' ? q.change24h : 0,
            symbol: sym,
            name: sym
          };
        }
      }

      // Fallback: fetch missing symbols directly from CoinGecko (simple/price)
      const missingSymbols = symbols.filter((s) => !transformedPrices[s.toUpperCase()]);
      if (missingSymbols.length > 0) {
        try {
          const ids = [...new Set(missingSymbols.map((s) => mapSymbolToCoinId(s)))].filter(Boolean).join(',');
          if (ids.length > 0) {
            const resp = await fetch(
              `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(ids)}&vs_currencies=usd&include_24hr_change=true`
            );
            if (resp.ok) {
              const cg: Record<string, { usd?: number; usd_24h_change?: number }> = await resp.json();
              for (const [coinId, v] of Object.entries(cg)) {
                const sym = mapCoinIdToSymbol(coinId);
                if (!transformedPrices[sym] && typeof v.usd === 'number') {
                  transformedPrices[sym] = {
                    price: v.usd,
                    change_24h: typeof v.usd_24h_change === 'number' ? v.usd_24h_change : 0,
                    symbol: sym,
                    name: sym,
                  };
                }
              }
            } else {
              console.warn('CoinGecko fallback non-200:', resp.status);
            }
          }
        } catch (e) {
          console.warn('CoinGecko fallback failed:', e);
        }
      }

      setPrices((prev) => ({
        ...prev,
        ...transformedPrices,
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
      'ASTER': 'astar',
      'ASTR': 'astar',
      'HYPE': 'hyperliquid',
      'HYPERLIQUID': 'hyperliquid',
      'SUI': 'sui',
      'USDE': 'ethena-usde',
      'WETH': 'weth',
      'WEETH': 'wrapped-eeth',
      'WBETH': 'wrapped-beacon-eth',
      'FF': 'falcon-finance',
      'ADX': 'adex',
      'ERG': 'ergo',
      'ERGO': 'ergo',
      'ZEC': 'zcash'
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
      'astar': 'ASTER',
      'hyperliquid': 'HYPE',
      'sui': 'SUI',
      'ethena-usde': 'USDE',
      'weth': 'WETH',
      'wrapped-eeth': 'WEETH',
      'wrapped-beacon-eth': 'WBETH',
      'falcon-finance': 'FF',
      'adex': 'ADX',
      'ergo': 'ERG',
      'zcash': 'ZEC'
    };
    
    return idToSymbolMap[coinId] || coinId.toUpperCase();
  };

  useEffect(() => {
    if (tickers.length === 0) return;

    const symbols = [...new Set(tickers.map((s) => s.toUpperCase().trim()))];

    // Initial fetch
    fetchPrices(symbols);

    // Set up polling every 60 seconds for live updates
    intervalRef.current = setInterval(() => {
      fetchPrices(symbols);
    }, 60000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [tickers.join(',')]); // Re-run when tickers change

  return { prices, loading, refetch: () => fetchPrices([...new Set(tickers.map((s) => s.toUpperCase().trim()))]) };
}