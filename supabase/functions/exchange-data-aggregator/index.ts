import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

interface ExchangeData {
  exchange: string;
  symbol: string;
  price: number;
  volume_24h: number;
  change_24h: number;
  high_24h?: number;
  low_24h?: number;
  market_cap?: number;
  timestamp: number;
}

interface AggregatedTokenData {
  symbol: string;
  name: string;
  current_price: number;
  average_price: number;
  price_variance: number;
  total_volume_24h: number;
  weighted_change_24h: number;
  exchange_count: number;
  exchanges: ExchangeData[];
  market_dominance: {
    exchange: string;
    volume_percentage: number;
  }[];
  price_discovery: {
    highest_price: { exchange: string; price: number };
    lowest_price: { exchange: string; price: number };
  };
}

// Exchange API configurations - Priority order matches sync-ticker-mappings
const EXCHANGE_CONFIGS = {
  kraken: {
    baseUrl: 'https://api.kraken.com/0',
    tickerEndpoint: '/public/Ticker',
    symbolFormat: (symbol: string) => `${symbol}USD`
  },
  kucoin: {
    baseUrl: 'https://api.kucoin.com/api/v1',
    tickerEndpoint: '/market/stats',
    symbolFormat: (symbol: string) => `${symbol}-USDT`
  },
  gate: {
    baseUrl: 'https://api.gateio.ws/api/v4',
    tickerEndpoint: '/spot/tickers',
    symbolFormat: (symbol: string) => `${symbol}_USDT`
  },
  coinbase: {
    baseUrl: 'https://api.exchange.coinbase.com',
    tickerEndpoint: '/products/{symbol}/ticker',
    symbolFormat: (symbol: string) => `${symbol}-USD`
  },
  okx: {
    baseUrl: 'https://www.okx.com/api/v5',
    tickerEndpoint: '/market/ticker',
    symbolFormat: (symbol: string) => `${symbol}-USDT`
  },
  bitget: {
    baseUrl: 'https://api.bitget.com/api/v2',
    tickerEndpoint: '/spot/market/tickers',
    symbolFormat: (symbol: string) => `${symbol}USDT`
  },
  htx: {
    baseUrl: 'https://api.huobi.pro',
    tickerEndpoint: '/market/detail/merged',
    symbolFormat: (symbol: string) => `${symbol.toLowerCase()}usdt`
  },
  bybit: {
    baseUrl: 'https://api.bybit.com/v5',
    tickerEndpoint: '/market/tickers',
    symbolFormat: (symbol: string) => `${symbol}USDT`
  },
  mexc: {
    baseUrl: 'https://api.mexc.com/api/v3',
    tickerEndpoint: '/ticker/24hr',
    symbolFormat: (symbol: string) => `${symbol}USDT`
  },
  binance: {
    baseUrl: 'https://api.binance.com/api/v3',
    tickerEndpoint: '/ticker/24hr',
    symbolFormat: (symbol: string) => `${symbol}USDT`
  }
};

async function fetchBinanceData(symbol: string): Promise<ExchangeData | null> {
  try {
    const formattedSymbol = EXCHANGE_CONFIGS.binance.symbolFormat(symbol);
    const response = await fetch(`${EXCHANGE_CONFIGS.binance.baseUrl}${EXCHANGE_CONFIGS.binance.tickerEndpoint}?symbol=${formattedSymbol}`);
    
    if (!response.ok) return null;
    
    const data = await response.json();
    return {
      exchange: 'Binance',
      symbol: symbol,
      price: parseFloat(data.lastPrice),
      volume_24h: parseFloat(data.volume) * parseFloat(data.lastPrice),
      change_24h: parseFloat(data.priceChangePercent),
      high_24h: parseFloat(data.highPrice),
      low_24h: parseFloat(data.lowPrice),
      timestamp: Date.now()
    };
  } catch (error) {
    console.error('Binance API error:', error);
    return null;
  }
}

async function fetchCoinbaseData(symbol: string): Promise<ExchangeData | null> {
  try {
    const formattedSymbol = EXCHANGE_CONFIGS.coinbase.symbolFormat(symbol);
    const tickerUrl = `${EXCHANGE_CONFIGS.coinbase.baseUrl}${EXCHANGE_CONFIGS.coinbase.tickerEndpoint.replace('{symbol}', formattedSymbol)}`;
    const statsUrl = `${EXCHANGE_CONFIGS.coinbase.baseUrl}/products/${formattedSymbol}/stats`;
    
    const [tickerResponse, statsResponse] = await Promise.all([
      fetch(tickerUrl),
      fetch(statsUrl)
    ]);
    
    if (!tickerResponse.ok || !statsResponse.ok) return null;
    
    const [tickerData, statsData] = await Promise.all([
      tickerResponse.json(),
      statsResponse.json()
    ]);
    
    const change24h = ((parseFloat(tickerData.price) - parseFloat(statsData.open)) / parseFloat(statsData.open)) * 100;
    
    return {
      exchange: 'Coinbase',
      symbol: symbol,
      price: parseFloat(tickerData.price),
      volume_24h: parseFloat(statsData.volume) * parseFloat(tickerData.price),
      change_24h: change24h,
      high_24h: parseFloat(statsData.high),
      low_24h: parseFloat(statsData.low),
      timestamp: Date.now()
    };
  } catch (error) {
    console.error('Coinbase API error:', error);
    return null;
  }
}

async function fetchBybitData(symbol: string): Promise<ExchangeData | null> {
  try {
    const formattedSymbol = EXCHANGE_CONFIGS.bybit.symbolFormat(symbol);
    const response = await fetch(`${EXCHANGE_CONFIGS.bybit.baseUrl}${EXCHANGE_CONFIGS.bybit.tickerEndpoint}?category=spot&symbol=${formattedSymbol}`);
    
    if (!response.ok) return null;
    
    const data = await response.json();
    if (!data.result?.list?.[0]) return null;
    
    const ticker = data.result.list[0];
    return {
      exchange: 'Bybit',
      symbol: symbol,
      price: parseFloat(ticker.lastPrice),
      volume_24h: parseFloat(ticker.turnover24h),
      change_24h: parseFloat(ticker.price24hPcnt) * 100,
      high_24h: parseFloat(ticker.highPrice24h),
      low_24h: parseFloat(ticker.lowPrice24h),
      timestamp: Date.now()
    };
  } catch (error) {
    console.error('Bybit API error:', error);
    return null;
  }
}

async function fetchOKXData(symbol: string): Promise<ExchangeData | null> {
  try {
    const formattedSymbol = EXCHANGE_CONFIGS.okx.symbolFormat(symbol);
    const response = await fetch(`${EXCHANGE_CONFIGS.okx.baseUrl}${EXCHANGE_CONFIGS.okx.tickerEndpoint}?instId=${formattedSymbol}`);
    
    if (!response.ok) return null;
    
    const data = await response.json();
    if (!data.data?.[0]) return null;
    
    const ticker = data.data[0];
    return {
      exchange: 'OKX',
      symbol: symbol,
      price: parseFloat(ticker.last),
      volume_24h: parseFloat(ticker.volCcy24h),
      change_24h: parseFloat(ticker.chgUtc0) * 100,
      high_24h: parseFloat(ticker.high24h),
      low_24h: parseFloat(ticker.low24h),
      timestamp: Date.now()
    };
  } catch (error) {
    console.error('OKX API error:', error);
    return null;
  }
}

async function fetchBitgetData(symbol: string): Promise<ExchangeData | null> {
  try {
    const formattedSymbol = EXCHANGE_CONFIGS.bitget.symbolFormat(symbol);
    const response = await fetch(`${EXCHANGE_CONFIGS.bitget.baseUrl}${EXCHANGE_CONFIGS.bitget.tickerEndpoint}?symbol=${formattedSymbol}`);
    
    if (!response.ok) return null;
    
    const data = await response.json();
    if (!data.data?.[0]) return null;
    
    const ticker = data.data[0];
    return {
      exchange: 'Bitget',
      symbol: symbol,
      price: parseFloat(ticker.lastPr),
      volume_24h: parseFloat(ticker.baseVolume),
      change_24h: parseFloat(ticker.chgUtc),
      high_24h: parseFloat(ticker.high24h),
      low_24h: parseFloat(ticker.low24h),
      timestamp: Date.now()
    };
  } catch (error) {
    console.error('Bitget API error:', error);
    return null;
  }
}

async function fetchMEXCData(symbol: string): Promise<ExchangeData | null> {
  try {
    const formattedSymbol = EXCHANGE_CONFIGS.mexc.symbolFormat(symbol);
    const response = await fetch(`${EXCHANGE_CONFIGS.mexc.baseUrl}${EXCHANGE_CONFIGS.mexc.tickerEndpoint}?symbol=${formattedSymbol}`);
    
    if (!response.ok) return null;
    
    const data = await response.json();
    return {
      exchange: 'MEXC',
      symbol: symbol,
      price: parseFloat(data.lastPrice),
      volume_24h: parseFloat(data.quoteVolume),
      change_24h: parseFloat(data.priceChangePercent),
      high_24h: parseFloat(data.highPrice),
      low_24h: parseFloat(data.lowPrice),
      timestamp: Date.now()
    };
  } catch (error) {
    console.error('MEXC API error:', error);
    return null;
  }
}

async function fetchGateData(symbol: string): Promise<ExchangeData | null> {
  try {
    const formattedSymbol = EXCHANGE_CONFIGS.gate.symbolFormat(symbol);
    const response = await fetch(`${EXCHANGE_CONFIGS.gate.baseUrl}${EXCHANGE_CONFIGS.gate.tickerEndpoint}/${formattedSymbol}`);
    
    if (!response.ok) return null;
    
    const data = await response.json();
    return {
      exchange: 'Gate.io',
      symbol: symbol,
      price: parseFloat(data.last),
      volume_24h: parseFloat(data.quote_volume),
      change_24h: parseFloat(data.change_percentage),
      high_24h: parseFloat(data.high_24h),
      low_24h: parseFloat(data.low_24h),
      timestamp: Date.now()
    };
  } catch (error) {
    console.error('Gate.io API error:', error);
    return null;
  }
}

async function fetchHTXData(symbol: string): Promise<ExchangeData | null> {
  try {
    const formattedSymbol = EXCHANGE_CONFIGS.htx.symbolFormat(symbol);
    const response = await fetch(`${EXCHANGE_CONFIGS.htx.baseUrl}${EXCHANGE_CONFIGS.htx.tickerEndpoint}?symbol=${formattedSymbol}`);
    
    if (!response.ok) return null;
    
    const data = await response.json();
    if (!data.tick) return null;
    
    const ticker = data.tick;
    const change24h = ((ticker.close - ticker.open) / ticker.open) * 100;
    
    return {
      exchange: 'HTX',
      symbol: symbol,
      price: ticker.close,
      volume_24h: ticker.vol * ticker.close,
      change_24h: change24h,
      high_24h: ticker.high,
      low_24h: ticker.low,
      timestamp: Date.now()
    };
  } catch (error) {
    console.error('HTX API error:', error);
    return null;
  }
}

async function fetchKrakenData(symbol: string): Promise<ExchangeData | null> {
  try {
    const formattedSymbol = EXCHANGE_CONFIGS.kraken.symbolFormat(symbol);
    const response = await fetch(`${EXCHANGE_CONFIGS.kraken.baseUrl}${EXCHANGE_CONFIGS.kraken.tickerEndpoint}?pair=${formattedSymbol}`);
    
    if (!response.ok) return null;
    
    const data = await response.json();
    const pairKey = Object.keys(data.result || {})[0];
    if (!pairKey) return null;
    
    const ticker = data.result[pairKey];
    const change24h = parseFloat(ticker.p[1]); // Today's percentage change
    
    return {
      exchange: 'Kraken',
      symbol: symbol,
      price: parseFloat(ticker.c[0]), // Last trade closed
      volume_24h: parseFloat(ticker.v[1]) * parseFloat(ticker.c[0]), // 24h volume * price
      change_24h: change24h,
      high_24h: parseFloat(ticker.h[1]),
      low_24h: parseFloat(ticker.l[1]),
      timestamp: Date.now()
    };
  } catch (error) {
    console.error('Kraken API error:', error);
    return null;
  }
}

async function fetchKuCoinData(symbol: string): Promise<ExchangeData | null> {
  try {
    const formattedSymbol = EXCHANGE_CONFIGS.kucoin.symbolFormat(symbol);
    const response = await fetch(`${EXCHANGE_CONFIGS.kucoin.baseUrl}${EXCHANGE_CONFIGS.kucoin.tickerEndpoint}?symbol=${formattedSymbol}`);
    
    if (!response.ok) return null;
    
    const data = await response.json();
    if (!data.data) return null;
    
    const ticker = data.data;
    return {
      exchange: 'KuCoin',
      symbol: symbol,
      price: parseFloat(ticker.last),
      volume_24h: parseFloat(ticker.volValue),
      change_24h: parseFloat(ticker.changeRate) * 100,
      high_24h: parseFloat(ticker.high),
      low_24h: parseFloat(ticker.low),
      timestamp: Date.now()
    };
  } catch (error) {
    console.error('KuCoin API error:', error);
    return null;
  }
}

async function aggregateExchangeData(symbol: string): Promise<AggregatedTokenData | null> {
  console.log(`Aggregating exchange data for ${symbol}`);
  
  // Priority order: Kraken → KuCoin → Gate.io → Coinbase → OKX → Bitget → HTX → Bybit → MEXC → Binance (last)
  const exchangeFetchers = [
    fetchKrakenData,
    fetchKuCoinData,
    fetchGateData,
    fetchCoinbaseData,
    fetchOKXData,
    fetchBitgetData,
    fetchHTXData,
    fetchBybitData,
    fetchMEXCData,
    fetchBinanceData
  ];
  
  // Fetch data from all exchanges concurrently
  const exchangeDataPromises = exchangeFetchers.map(fetcher => 
    fetcher(symbol).catch(error => {
      console.error(`Exchange fetch error for ${symbol}:`, error);
      return null;
    })
  );
  
  const exchangeDataResults = await Promise.all(exchangeDataPromises);
  const validExchangeData = exchangeDataResults.filter((data): data is ExchangeData => data !== null);
  
  if (validExchangeData.length === 0) {
    console.log(`No valid exchange data found for ${symbol}`);
    return null;
  }
  
  console.log(`Found data from ${validExchangeData.length} exchanges for ${symbol}`);
  
  // Calculate aggregated metrics
  const totalVolume = validExchangeData.reduce((sum, data) => sum + data.volume_24h, 0);
  const weightedPrice = validExchangeData.reduce((sum, data) => sum + (data.price * data.volume_24h), 0) / totalVolume;
  const averagePrice = validExchangeData.reduce((sum, data) => sum + data.price, 0) / validExchangeData.length;
  const weightedChange = validExchangeData.reduce((sum, data) => sum + (data.change_24h * data.volume_24h), 0) / totalVolume;
  
  // Calculate price variance
  const priceVariance = Math.sqrt(
    validExchangeData.reduce((sum, data) => sum + Math.pow(data.price - averagePrice, 2), 0) / validExchangeData.length
  );
  
  // Market dominance by volume
  const marketDominance = validExchangeData
    .map(data => ({
      exchange: data.exchange,
      volume_percentage: (data.volume_24h / totalVolume) * 100
    }))
    .sort((a, b) => b.volume_percentage - a.volume_percentage);
  
  // Price discovery
  const prices = validExchangeData.map(data => ({ exchange: data.exchange, price: data.price }));
  const highestPrice = prices.reduce((max, current) => current.price > max.price ? current : max);
  const lowestPrice = prices.reduce((min, current) => current.price < min.price ? current : min);
  
  return {
    symbol,
    name: symbol, // We'll enhance this with proper names later
    current_price: weightedPrice,
    average_price: averagePrice,
    price_variance: priceVariance,
    total_volume_24h: totalVolume,
    weighted_change_24h: weightedChange,
    exchange_count: validExchangeData.length,
    exchanges: validExchangeData,
    market_dominance: marketDominance,
    price_discovery: {
      highest_price: highestPrice,
      lowest_price: lowestPrice
    }
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  
  try {
    const { symbols } = await req.json();
    
    if (!symbols || !Array.isArray(symbols)) {
      return new Response(
        JSON.stringify({ error: 'Invalid symbols array provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log(`Processing exchange data for symbols: ${symbols.join(', ')}`);
    
    // Process all symbols concurrently
    const aggregationPromises = symbols.map(symbol => 
      aggregateExchangeData(symbol.toUpperCase())
    );
    
    const results = await Promise.all(aggregationPromises);
    const validResults = results.filter((result): result is AggregatedTokenData => result !== null);
    
    // Store aggregated data in the database for caching
    if (validResults.length > 0) {
      for (const tokenData of validResults) {
        try {
          // Store individual exchange prices
          for (const exchangeData of tokenData.exchanges) {
            await supabase
              .from('exchange_ticker_data')
              .upsert({
                asset_symbol: tokenData.symbol,
                exchange: exchangeData.exchange,
                price: exchangeData.price,
                volume_24h: exchangeData.volume_24h,
                change_24h: exchangeData.change_24h,
                high_24h: exchangeData.high_24h,
                low_24h: exchangeData.low_24h,
                timestamp: new Date().toISOString(),
              }, {
                onConflict: 'asset_symbol,exchange,timestamp',
                ignoreDuplicates: false
              });
          }

          // Also keep social_sentiment for compatibility
          await supabase
            .from('social_sentiment')
            .upsert({
              asset_symbol: tokenData.symbol,
              asset_name: tokenData.name,
              sentiment_score: 0.5,
              social_volume: Math.floor(tokenData.total_volume_24h / 1000000),
              galaxy_score: tokenData.exchange_count * 10,
              trending_rank: null,
              viral_posts: [],
              top_influencers: [],
              social_volume_24h_change: tokenData.weighted_change_24h,
              data_timestamp: new Date().toISOString()
            }, {
              onConflict: 'asset_symbol',
              ignoreDuplicates: false
            });
        } catch (dbError) {
          console.error(`Database error for ${tokenData.symbol}:`, dbError);
        }
      }
    }
    
    return new Response(
      JSON.stringify({
        success: true,
        data: validResults,
        processed_count: symbols.length,
        successful_count: validResults.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    console.error('Exchange aggregator error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});