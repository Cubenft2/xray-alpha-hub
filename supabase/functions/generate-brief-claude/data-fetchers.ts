import { MarketData, CoinData, SocialData, StockData } from './types.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

// Helper to log API calls for rate limit tracking
async function logApiCall(apiName: string, functionName: string, success: boolean, errorMessage?: string) {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    await supabase.from('external_api_calls').insert({
      api_name: apiName,
      function_name: functionName,
      call_count: 1,
      success,
      error_message: errorMessage || null,
    });
  } catch (e) {
    console.error('Failed to log API call:', e);
  }
}

export async function fetchComprehensiveMarketData(): Promise<MarketData> {
  const [
    coinGeckoData,
    lunarCrushData,
    fearGreedData,
    binanceData,
    stocksData,
    livePrices
  ] = await Promise.allSettled([
    fetchCoinGeckoMarkets(),
    fetchLunarCrushSocial(),
    fetchFearGreedIndex(),
    fetchBinanceFunding(),
    fetchPolygonStocks(['COIN', 'MSTR', 'SPY', 'QQQ', 'DXY']),
    fetchLivePrices(['BTC', 'ETH'])
  ]);

  // Extract data with fallbacks
  const coins = coinGeckoData.status === 'fulfilled' ? coinGeckoData.value : [];
  const social = lunarCrushData.status === 'fulfilled' ? lunarCrushData.value : [];
  const fearGreed = fearGreedData.status === 'fulfilled' ? fearGreedData.value : { value: 50, classification: 'Neutral' };
  const funding = binanceData.status === 'fulfilled' ? binanceData.value : { btc: 0, eth: 0 };
  const stocks = stocksData.status === 'fulfilled' ? stocksData.value : { COIN: null, MSTR: null, SPY: null, QQQ: null, DXY: null };
  const prices = livePrices.status === 'fulfilled' ? livePrices.value : { BTC: null, ETH: null };

  // Validate critical data with fallback to CoinGecko
  let btcPrice = prices.BTC;
  let ethPrice = prices.ETH;
  
  const now = Date.now();
  const staleThreshold = 60 * 60 * 1000; // 60 minutes
  
  // Check if BTC is missing or stale
  if (!btcPrice || (btcPrice.updated_at && (now - new Date(btcPrice.updated_at).getTime()) > staleThreshold)) {
    console.warn('⚠️ BTC missing or stale in live_prices, falling back to CoinGecko...');
    const btcCoin = coins.find(c => c.id === 'bitcoin');
    if (btcCoin) {
      btcPrice = {
        price: btcCoin.current_price,
        change_24h: btcCoin.price_change_percentage_24h || 0,
        updated_at: new Date().toISOString()
      };
      console.log('✅ Using CoinGecko fallback for BTC:', btcPrice.price);
    }
  }
  
  // Check if ETH is missing or stale
  if (!ethPrice || (ethPrice.updated_at && (now - new Date(ethPrice.updated_at).getTime()) > staleThreshold)) {
    console.warn('⚠️ ETH missing or stale in live_prices, falling back to CoinGecko...');
    const ethCoin = coins.find(c => c.id === 'ethereum');
    if (ethCoin) {
      ethPrice = {
        price: ethCoin.current_price,
        change_24h: ethCoin.price_change_percentage_24h || 0,
        updated_at: new Date().toISOString()
      };
      console.log('✅ Using CoinGecko fallback for ETH:', ethPrice.price);
    }
  }
  
  // Final validation
  if (!btcPrice || !ethPrice) {
    throw new Error('❌ Missing BTC/ETH price data from both live_prices and CoinGecko fallback');
  }

  return {
    topCoins: coins.slice(0, 50),
    totalMarketCap: coins.reduce((sum, c) => sum + c.market_cap, 0),
    btcDominance: calculateBtcDominance(coins),
    socialSentiment: social.slice(0, 10),
    coinStock: stocks.COIN,
    mstrStock: stocks.MSTR,
    spyStock: stocks.SPY,
    qqqStock: stocks.QQQ,
    dxyIndex: stocks.DXY,
    fearGreedIndex: fearGreed.value,
    fearGreedLabel: fearGreed.classification,
    btcFundingRate: funding.btc,
    ethFundingRate: funding.eth,
    btc: btcPrice,
    eth: ethPrice
  };
}

// Individual API fetchers
async function fetchCoinGeckoMarkets(): Promise<CoinData[]> {
  const apiKey = Deno.env.get('COINGECKO_API_KEY');
  if (!apiKey) {
    console.warn('⚠️ COINGECKO_API_KEY not set, skipping CoinGecko data');
    return [];
  }

  try {
    const response = await fetch(
      `https://pro-api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=50&page=1&sparkline=false&price_change_percentage=24h`,
      { 
        headers: { 'x-cg-pro-api-key': apiKey },
        signal: AbortSignal.timeout(10000)
      }
    );

    if (!response.ok) {
      throw new Error(`CoinGecko API error: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('❌ CoinGecko fetch failed:', error);
    return [];
  }
}

async function fetchLunarCrushSocial(): Promise<SocialData[]> {
  const apiKey = Deno.env.get('LUNARCRUSH_API_KEY');
  if (!apiKey) {
    console.warn('⚠️ LUNARCRUSH_API_KEY not set, skipping social data');
    return [];
  }

  try {
    const response = await fetch(
      `https://lunarcrush.com/api4/public/coins/list/v2?limit=20&sort=social_volume_24h`,
      { 
        headers: { 'Authorization': `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(10000)
      }
    );

    // Log API call for rate limit tracking
    await logApiCall('lunarcrush', 'generate-brief-claude', response.ok, response.ok ? undefined : `${response.status}`);

    if (!response.ok) {
      throw new Error(`LunarCrush API error: ${response.status}`);
    }

    const data = await response.json();
    return data.data || [];
  } catch (error) {
    console.error('❌ LunarCrush fetch failed:', error);
    await logApiCall('lunarcrush', 'generate-brief-claude', false, error.message);
    return [];
  }
}

async function fetchFearGreedIndex() {
  try {
    const response = await fetch(
      'https://api.alternative.me/fng/',
      { signal: AbortSignal.timeout(10000) }
    );
    
    if (!response.ok) {
      throw new Error(`Fear & Greed API error: ${response.status}`);
    }

    const data = await response.json();
    return {
      value: parseInt(data.data[0].value),
      classification: data.data[0].value_classification
    };
  } catch (error) {
    console.error('❌ Fear & Greed fetch failed:', error);
    return { value: 50, classification: 'Neutral' };
  }
}

async function fetchBinanceFunding() {
  try {
    const [btcRes, ethRes] = await Promise.all([
      fetch('https://fapi.binance.com/fapi/v1/premiumIndex?symbol=BTCUSDT', {
        signal: AbortSignal.timeout(10000)
      }),
      fetch('https://fapi.binance.com/fapi/v1/premiumIndex?symbol=ETHUSDT', {
        signal: AbortSignal.timeout(10000)
      })
    ]);

    const btcData = await btcRes.json();
    const ethData = await ethRes.json();

    return {
      btc: parseFloat(btcData.lastFundingRate) * 100, // Convert to percentage
      eth: parseFloat(ethData.lastFundingRate) * 100
    };
  } catch (error) {
    console.error('❌ Binance funding fetch failed:', error);
    return { btc: 0, eth: 0 };
  }
}

async function fetchPolygonStocks(symbols: string[]) {
  const apiKey = Deno.env.get('POLYGON_API_KEY');
  if (!apiKey) {
    console.warn('⚠️ POLYGON_API_KEY not set, skipping stock data');
    const emptyResults: any = {};
    symbols.forEach(sym => emptyResults[sym] = null);
    return emptyResults;
  }

  const results: any = {};

  for (const symbol of symbols) {
    try {
      const response = await fetch(
        `https://api.polygon.io/v2/aggs/ticker/${symbol}/prev?apiKey=${apiKey}`,
        { signal: AbortSignal.timeout(10000) }
      );

      if (!response.ok) {
        throw new Error(`Polygon API error for ${symbol}: ${response.status}`);
      }

      const data = await response.json();
      if (data.results && data.results[0]) {
        const result = data.results[0];
        results[symbol] = {
          symbol,
          close: result.c,
          change_percent: ((result.c - result.o) / result.o) * 100
        };
      } else {
        results[symbol] = null;
      }
    } catch (error) {
      console.error(`❌ Failed to fetch ${symbol} stock data:`, error);
      results[symbol] = null;
    }
  }

  return results;
}

async function fetchLivePrices(tickers: string[]) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  try {
    const response = await fetch(
      `${supabaseUrl}/rest/v1/live_prices?ticker=in.(${tickers.join(',')})`,
      {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`
        },
        signal: AbortSignal.timeout(10000)
      }
    );

    if (!response.ok) {
      throw new Error(`Supabase live_prices error: ${response.status}`);
    }

    const data = await response.json();
    const result: any = {};

    for (const row of data) {
      result[row.ticker] = {
        price: row.price,
        change_24h: row.change24h,
        updated_at: row.updated_at
      };
    }

    return result;
  } catch (error) {
    console.error('❌ Live prices fetch failed:', error);
    return { BTC: null, ETH: null };
  }
}

function calculateBtcDominance(coins: CoinData[]): number {
  if (coins.length === 0) return 0;
  const btc = coins.find(c => c.id === 'bitcoin');
  const totalMcap = coins.reduce((sum, c) => sum + c.market_cap, 0);
  return btc && totalMcap > 0 ? (btc.market_cap / totalMcap) * 100 : 0;
}
