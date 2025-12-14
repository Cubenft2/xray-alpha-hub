import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const POLYGON_API_KEY = Deno.env.get('POLYGON_API_KEY');

interface TickerSnapshot {
  ticker: string;
  day?: {
    o?: number;
    h?: number;
    l?: number;
    c?: number;
    v?: number;
    vw?: number;
  };
  lastTrade?: {
    p?: number;
    s?: number;
    t?: number;
  };
  min?: {
    o?: number;
    h?: number;
    l?: number;
    c?: number;
    v?: number;
  };
  prevDay?: {
    o?: number;
    h?: number;
    l?: number;
    c?: number;
    v?: number;
    vw?: number;
  };
  todaysChange?: number;
  todaysChangePerc?: number;
  updated?: number;
}

function parseQuoteCurrency(ticker: string): string {
  // X:BTCUSD -> USD, X:BTCUSDT -> USDT, X:ETHBTC -> BTC
  const symbol = ticker.replace('X:', '');
  
  // Check for known quote currencies at the end
  if (symbol.endsWith('USDT')) return 'USDT';
  if (symbol.endsWith('USDC')) return 'USDC';
  if (symbol.endsWith('USD')) return 'USD';
  if (symbol.endsWith('EUR')) return 'EUR';
  if (symbol.endsWith('GBP')) return 'GBP';
  if (symbol.endsWith('JPY')) return 'JPY';
  if (symbol.endsWith('AUD')) return 'AUD';
  if (symbol.endsWith('CAD')) return 'CAD';
  if (symbol.endsWith('CHF')) return 'CHF';
  if (symbol.endsWith('BTC')) return 'BTC';
  if (symbol.endsWith('ETH')) return 'ETH';
  if (symbol.endsWith('BNB')) return 'BNB';
  
  return 'OTHER';
}

function parseBaseSymbol(ticker: string): string {
  // X:BTCUSD -> BTC, X:ETHUSDT -> ETH
  const symbol = ticker.replace('X:', '');
  
  // Remove quote currency from end
  const quoteCurrencies = ['USDT', 'USDC', 'USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'CHF', 'BTC', 'ETH', 'BNB'];
  for (const quote of quoteCurrencies) {
    if (symbol.endsWith(quote)) {
      return symbol.slice(0, -quote.length);
    }
  }
  return symbol;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!POLYGON_API_KEY) {
      throw new Error('POLYGON_API_KEY not configured');
    }

    console.log('🔍 Fetching raw Polygon unified snapshots...');

    // Fetch all three endpoints in parallel
    const [cryptoRes, forexRes, stocksRes] = await Promise.all([
      fetch(`https://api.polygon.io/v2/snapshot/locale/global/markets/crypto/tickers?apiKey=${POLYGON_API_KEY}`),
      fetch(`https://api.polygon.io/v2/snapshot/locale/global/markets/forex/tickers?apiKey=${POLYGON_API_KEY}`),
      fetch(`https://api.polygon.io/v2/snapshot/locale/us/markets/stocks/tickers?apiKey=${POLYGON_API_KEY}`)
    ]);

    const [cryptoData, forexData, stocksData] = await Promise.all([
      cryptoRes.json(),
      forexRes.json(),
      stocksRes.json()
    ]);

    console.log(`📊 Crypto response status: ${cryptoData.status}, count: ${cryptoData.count}`);
    console.log(`📊 Forex response status: ${forexData.status}, count: ${forexData.count}`);
    console.log(`📊 Stocks response status: ${stocksData.status}, count: ${stocksData.count}`);

    // Analyze crypto tickers
    const cryptoTickers: TickerSnapshot[] = cryptoData.tickers || [];
    
    // Count by quote currency
    const byQuoteCurrency: Record<string, number> = {
      USD: 0,
      USDT: 0,
      USDC: 0,
      EUR: 0,
      GBP: 0,
      BTC: 0,
      ETH: 0,
      OTHER: 0
    };
    
    const quoteExamples: Record<string, string[]> = {
      USD: [],
      USDT: [],
      USDC: [],
      EUR: [],
      GBP: [],
      BTC: [],
      ETH: [],
      OTHER: []
    };

    // Group by base symbol
    const byBaseSymbol: Record<string, TickerSnapshot[]> = {};

    for (const ticker of cryptoTickers) {
      const quote = parseQuoteCurrency(ticker.ticker);
      const base = parseBaseSymbol(ticker.ticker);
      
      byQuoteCurrency[quote] = (byQuoteCurrency[quote] || 0) + 1;
      
      // Store up to 5 examples per quote currency
      if ((quoteExamples[quote]?.length || 0) < 5) {
        quoteExamples[quote] = quoteExamples[quote] || [];
        quoteExamples[quote].push(ticker.ticker);
      }
      
      // Group by base symbol
      if (!byBaseSymbol[base]) {
        byBaseSymbol[base] = [];
      }
      byBaseSymbol[base].push(ticker);
    }

    // Find assets with multiple pairs
    const multiPairAssets = Object.entries(byBaseSymbol)
      .filter(([_, tickers]) => tickers.length > 1)
      .sort((a, b) => b[1].length - a[1].length)
      .slice(0, 20)
      .map(([symbol, tickers]) => ({
        symbol,
        pairCount: tickers.length,
        pairs: tickers.map(t => ({
          ticker: t.ticker,
          price: t.lastTrade?.p || t.day?.c,
          volume: t.day?.v,
          updated: t.updated
        })).sort((a, b) => (b.volume || 0) - (a.volume || 0))
      }));

    // Get BTC and ETH specific pairs
    const btcPairs = cryptoTickers
      .filter(t => t.ticker.startsWith('X:BTC'))
      .map(t => ({
        ticker: t.ticker,
        price: t.lastTrade?.p || t.day?.c,
        volume: t.day?.v,
        quote: parseQuoteCurrency(t.ticker)
      }));

    const ethPairs = cryptoTickers
      .filter(t => t.ticker.startsWith('X:ETH'))
      .map(t => ({
        ticker: t.ticker,
        price: t.lastTrade?.p || t.day?.c,
        volume: t.day?.v,
        quote: parseQuoteCurrency(t.ticker)
      }));

    // Sample raw ticker for inspection
    const sampleRawTicker = cryptoTickers.find(t => t.ticker === 'X:BTCUSD') || cryptoTickers[0];

    const response = {
      timestamp: new Date().toISOString(),
      crypto: {
        total: cryptoTickers.length,
        byQuoteCurrency,
        quoteExamples,
        uniqueBaseSymbols: Object.keys(byBaseSymbol).length,
        multiPairAssets,
        btcPairs,
        ethPairs,
        sampleTickers: cryptoTickers.slice(0, 10),
        sampleRawTicker
      },
      forex: {
        total: forexData.tickers?.length || 0,
        samplePairs: (forexData.tickers || []).slice(0, 10)
      },
      stocks: {
        total: stocksData.tickers?.length || 0,
        sampleTickers: (stocksData.tickers || []).slice(0, 10)
      },
      rawCryptoResponse: cryptoData
    };

    console.log(`✅ Analysis complete: ${cryptoTickers.length} crypto, ${response.forex.total} forex, ${response.stocks.total} stocks`);

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
