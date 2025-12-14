import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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

interface ReferenceTicker {
  ticker: string;
  name: string;
  market: string;
  locale: string;
  active: boolean;
  currency_symbol?: string;
  base_currency_symbol?: string;
  base_currency_name?: string;
  currency_name?: string;
}

function parseQuoteCurrency(ticker: string): string {
  const symbol = ticker.replace('X:', '');
  
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
  const symbol = ticker.replace('X:', '');
  
  const quoteCurrencies = ['USDT', 'USDC', 'USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'CHF', 'BTC', 'ETH', 'BNB'];
  for (const quote of quoteCurrencies) {
    if (symbol.endsWith(quote)) {
      return symbol.slice(0, -quote.length);
    }
  }
  return symbol;
}

async function fetchAllReferencePages(baseUrl: string): Promise<ReferenceTicker[]> {
  const allResults: ReferenceTicker[] = [];
  let nextUrl: string | null = `${baseUrl}&apiKey=${POLYGON_API_KEY}`;
  let pageCount = 0;
  
  while (nextUrl) {
    pageCount++;
    const response = await fetch(nextUrl);
    const data = await response.json();
    
    if (data.results) {
      allResults.push(...data.results);
    }
    
    // Polygon returns next_url for pagination
    nextUrl = data.next_url ? `${data.next_url}&apiKey=${POLYGON_API_KEY}` : null;
    
    console.log(`📄 Page ${pageCount}: Fetched ${allResults.length} reference tickers so far...`);
  }
  
  return allResults;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!POLYGON_API_KEY) {
      throw new Error('POLYGON_API_KEY not configured');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('🔍 Fetching raw Polygon unified snapshots and reference tickers...');

    // Fetch all four endpoints in parallel (reference is paginated, so we handle it separately)
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

    console.log(`📊 Crypto snapshot status: ${cryptoData.status}, count: ${cryptoData.count}`);
    console.log(`📊 Forex snapshot status: ${forexData.status}, count: ${forexData.count}`);
    console.log(`📊 Stocks snapshot status: ${stocksData.status}, count: ${stocksData.count}`);

    // Fetch all reference tickers (paginated)
    console.log('📄 Fetching all reference tickers (paginated)...');
    const referenceTickers = await fetchAllReferencePages(
      'https://api.polygon.io/v3/reference/tickers?market=crypto&active=true&limit=1000'
    );
    console.log(`📊 Reference tickers total: ${referenceTickers.length}`);

    // Fetch forex status from database
    console.log('💱 Fetching forex status from database...');
    
    // Get forex prices from live_prices
    const { data: forexPrices, count: forexPriceCount } = await supabase
      .from('live_prices')
      .select('ticker, display, price, change24h, updated_at', { count: 'exact' })
      .like('ticker', 'C:%')
      .order('ticker')
      .limit(12);

    // Get forex pair count from poly_fx_pairs
    const { count: forexPairCount } = await supabase
      .from('poly_fx_pairs')
      .select('*', { count: 'exact', head: true });

    // Get forex asset count from assets table
    const { count: forexAssetCount } = await supabase
      .from('assets')
      .select('*', { count: 'exact', head: true })
      .eq('type', 'forex');

    // Check freshness (stale if > 5 minutes old)
    const lastForexUpdate = forexPrices?.[0]?.updated_at;
    const forexIsFresh = lastForexUpdate && (Date.now() - new Date(lastForexUpdate).getTime() < 5 * 60 * 1000);

    // Get major forex pairs specifically
    const majorPairs = ['C:EURUSD', 'C:GBPUSD', 'C:USDJPY', 'C:USDCHF', 'C:AUDUSD', 'C:USDCAD', 'C:XAUUSD', 'C:XAGUSD'];
    const { data: majorForexPrices } = await supabase
      .from('live_prices')
      .select('ticker, display, price, change24h, updated_at')
      .in('ticker', majorPairs);

    // Analyze crypto snapshot tickers
    const cryptoTickers: TickerSnapshot[] = cryptoData.tickers || [];
    const snapshotTickerSet = new Set(cryptoTickers.map(t => t.ticker));
    
    // Count snapshot by quote currency
    const snapshotByQuoteCurrency: Record<string, number> = {};
    const snapshotQuoteExamples: Record<string, string[]> = {};
    const snapshotByBaseSymbol: Record<string, TickerSnapshot[]> = {};

    for (const ticker of cryptoTickers) {
      const quote = parseQuoteCurrency(ticker.ticker);
      const base = parseBaseSymbol(ticker.ticker);
      
      snapshotByQuoteCurrency[quote] = (snapshotByQuoteCurrency[quote] || 0) + 1;
      
      if (!snapshotQuoteExamples[quote]) snapshotQuoteExamples[quote] = [];
      if (snapshotQuoteExamples[quote].length < 5) {
        snapshotQuoteExamples[quote].push(ticker.ticker);
      }
      
      if (!snapshotByBaseSymbol[base]) snapshotByBaseSymbol[base] = [];
      snapshotByBaseSymbol[base].push(ticker);
    }

    // Analyze reference tickers
    const referenceTickerSet = new Set(referenceTickers.map(t => t.ticker));
    const referenceByQuoteCurrency: Record<string, number> = {};
    const referenceQuoteExamples: Record<string, string[]> = {};
    const referenceByBaseSymbol: Record<string, ReferenceTicker[]> = {};

    for (const ticker of referenceTickers) {
      const quote = parseQuoteCurrency(ticker.ticker);
      const base = parseBaseSymbol(ticker.ticker);
      
      referenceByQuoteCurrency[quote] = (referenceByQuoteCurrency[quote] || 0) + 1;
      
      if (!referenceQuoteExamples[quote]) referenceQuoteExamples[quote] = [];
      if (referenceQuoteExamples[quote].length < 5) {
        referenceQuoteExamples[quote].push(ticker.ticker);
      }
      
      if (!referenceByBaseSymbol[base]) referenceByBaseSymbol[base] = [];
      referenceByBaseSymbol[base].push(ticker);
    }

    // Compare reference vs snapshot
    const inReferenceNotSnapshot = referenceTickers
      .filter(t => !snapshotTickerSet.has(t.ticker))
      .map(t => t.ticker)
      .slice(0, 100); // Sample 100

    const inSnapshotNotReference = cryptoTickers
      .filter(t => !referenceTickerSet.has(t.ticker))
      .map(t => t.ticker);

    const gap = referenceTickers.length - cryptoTickers.length;
    const gapPercentage = referenceTickers.length > 0 
      ? ((gap / referenceTickers.length) * 100).toFixed(1)
      : '0';

    // Find assets with multiple pairs (snapshot)
    const multiPairAssets = Object.entries(snapshotByBaseSymbol)
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

    // Fetch polygon_crypto_cards status
    console.log('🎴 Fetching polygon_crypto_cards status...');
    
    const { count: totalCards } = await supabase
      .from('polygon_crypto_cards')
      .select('*', { count: 'exact', head: true });
    
    const { count: activeCards } = await supabase
      .from('polygon_crypto_cards')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true);
    
    const { count: referenceOnlyCards } = await supabase
      .from('polygon_crypto_cards')
      .select('*', { count: 'exact', head: true })
      .eq('in_reference', true)
      .eq('in_snapshot', false);
    
    const { data: lastCardUpdate } = await supabase
      .from('polygon_crypto_cards')
      .select('price_updated_at')
      .not('price_updated_at', 'is', null)
      .order('price_updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    
    const { data: sampleCards } = await supabase
      .from('polygon_crypto_cards')
      .select('canonical_symbol, name, price_usd, change_24h_pct, volume_24h, is_active, primary_ticker, price_updated_at')
      .eq('is_active', true)
      .not('price_usd', 'is', null)
      .order('volume_24h', { ascending: false, nullsFirst: false })
      .limit(10);

    const cardsLastUpdate = lastCardUpdate?.price_updated_at;
    const cardsIsFresh = cardsLastUpdate && (Date.now() - new Date(cardsLastUpdate).getTime() < 2 * 60 * 1000);

    const response = {
      timestamp: new Date().toISOString(),
      crypto: {
        total: cryptoTickers.length,
        byQuoteCurrency: snapshotByQuoteCurrency,
        quoteExamples: snapshotQuoteExamples,
        uniqueBaseSymbols: Object.keys(snapshotByBaseSymbol).length,
        multiPairAssets,
        btcPairs,
        ethPairs,
        sampleTickers: cryptoTickers.slice(0, 10),
        sampleRawTicker
      },
      cryptoCards: {
        totalCards: totalCards || 0,
        activeCards: activeCards || 0,
        referenceOnlyCards: referenceOnlyCards || 0,
        lastUpdate: cardsLastUpdate,
        isFresh: cardsIsFresh,
        sampleCards: sampleCards || []
      },
      reference: {
        total: referenceTickers.length,
        byQuoteCurrency: referenceByQuoteCurrency,
        quoteExamples: referenceQuoteExamples,
        uniqueBaseSymbols: Object.keys(referenceByBaseSymbol).length,
        sampleTickers: referenceTickers.slice(0, 20)
      },
      comparison: {
        referenceTotal: referenceTickers.length,
        snapshotTotal: cryptoTickers.length,
        gap: gap,
        gapPercentage: parseFloat(gapPercentage),
        inReferenceNotSnapshot,
        inSnapshotNotReference
      },
      forex: {
        total: forexData.tickers?.length || 0,
        samplePairs: (forexData.tickers || []).slice(0, 10),
        // Database status
        priceCount: forexPriceCount || 0,
        pairCount: forexPairCount || 0,
        assetCount: forexAssetCount || 0,
        lastUpdate: lastForexUpdate,
        isFresh: forexIsFresh,
        majorPairs: majorForexPrices || [],
      },
      stocks: {
        total: stocksData.tickers?.length || 0,
        sampleTickers: (stocksData.tickers || []).slice(0, 10)
      },
      rawCryptoResponse: cryptoData
    };

    console.log(`✅ Analysis complete: ${cryptoTickers.length} snapshot, ${referenceTickers.length} reference, ${gap} gap (${gapPercentage}%)`);
    console.log(`💱 Forex status: ${forexPriceCount} prices, ${forexPairCount} pairs, ${forexAssetCount} assets, fresh: ${forexIsFresh}`);
    console.log(`🎴 Crypto Cards: ${totalCards} total, ${activeCards} active, ${referenceOnlyCards} reference-only, fresh: ${cardsIsFresh}`);

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
