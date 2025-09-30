import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const coinGeckoApiKey = Deno.env.get('COINGECKO_API_KEY');
const polygonApiKey = Deno.env.get('POLYGON_API_KEY');

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Symbol mappings for CoinGecko
const symbolToCoinId: Record<string, string> = {
  'BTC': 'bitcoin',
  'ETH': 'ethereum', 
  'SOL': 'solana',
  'AVAX': 'avalanche-2',
  'XRP': 'ripple',
  'ADA': 'cardano',
  'DOT': 'polkadot',
  'LINK': 'chainlink',
  'MATIC': 'matic-network',
  'ATOM': 'cosmos',
  'NEAR': 'near',
  'FTM': 'fantom',
  'ALGO': 'algorand',
  'ICP': 'internet-computer',
  'VET': 'vechain',
  'SAND': 'the-sandbox',
  'MANA': 'decentraland',
  'CRV': 'curve-dao-token',
  'AAVE': 'aave',
  'UNI': 'uniswap',
  'SUSHI': 'sushi',
  'COMP': 'compound-governance-token',
  'YFI': 'yearn-finance',
  'HYPE': 'hyperliquid',
  'SUI': 'sui',
  'TRX': 'tron',
  'USDT': 'tether',
  'BNB': 'binancecoin',
  'DOGE': 'dogecoin'
  // ASTER removed - not a valid CoinGecko ID
};

// Known stock tickers
const stockTickers = new Set([
  'MNPR', 'EA', 'AAPL', 'GOOGL', 'MSFT', 'AMZN', 'TSLA', 'NVDA', 'META',
  'NFLX', 'AMD', 'INTC', 'COIN', 'MSTR', 'HOOD', 'SQ', 'PYPL',
  'SPY', 'QQQ', 'VTI', 'ASTER' // ASTER is not a valid CoinGecko ID
]);

interface QuoteData {
  symbol: string;
  price: number;
  change24h: number;
  timestamp: string;
  source: string;
}

async function getCachedData(key: string): Promise<any | null> {
  try {
    const { data, error } = await supabase
      .from('cache_kv')
      .select('v, expires_at')
      .eq('k', key)
      .single();

    if (error || !data) return null;
    
    const now = new Date();
    const expiresAt = new Date(data.expires_at);
    
    if (now > expiresAt) {
      // Clean up expired entry
      await supabase.from('cache_kv').delete().eq('k', key);
      return null;
    }
    
    return data.v;
  } catch (error) {
    console.error('Cache read error:', error);
    return null;
  }
}

async function setCachedData(key: string, value: any, ttlSeconds: number): Promise<void> {
  try {
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();
    
    await supabase
      .from('cache_kv')
      .upsert({
        k: key,
        v: value,
        expires_at: expiresAt
      });
  } catch (error) {
    console.error('Cache write error:', error);
  }
}

async function fetchCoinGeckoData(symbols: string[]): Promise<QuoteData[]> {
  // Filter out stock tickers and invalid symbols
  const cryptoSymbols = symbols.filter(s => !stockTickers.has(s) && symbolToCoinId[s]);
  const coinIds = cryptoSymbols.map(symbol => symbolToCoinId[symbol]).filter(Boolean);
  
  console.log('Crypto symbols to fetch:', cryptoSymbols);
  console.log('Coin IDs for CoinGecko:', coinIds);
  
  if (coinIds.length === 0) {
    console.log('No valid coin IDs to fetch');
    return [];
  }
  
  // Always use the free API endpoint - pro endpoint requires paid key
  const url = `https://api.coingecko.com/api/v3/simple/price?ids=${coinIds.join(',')}&vs_currencies=usd&include_24hr_change=true`;

  console.log('Fetching from CoinGecko...');
  
  try {
    const response = await fetch(url);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('CoinGecko error response:', errorText);
      return []; // Return empty array instead of throwing
    }
    
    const data = await response.json();
    const timestamp = new Date().toISOString();
    
    const quotes: QuoteData[] = [];
    
    for (const [symbol, coinId] of Object.entries(symbolToCoinId)) {
      if (cryptoSymbols.includes(symbol) && data[coinId]) {
        quotes.push({
          symbol,
          price: data[coinId].usd,
          change24h: data[coinId].usd_24h_change || 0,
          timestamp,
          source: 'coingecko'
        });
      }
    }
    
    console.log('Successfully fetched', quotes.length, 'quotes');
    return quotes;
  } catch (error) {
    console.error('Error fetching from CoinGecko:', error);
    return []; // Return empty array on error
  }
}

// Fetch real stock data from Polygon.io
async function fetchStockData(symbols: string[]): Promise<QuoteData[]> {
  const recognizedStocks = symbols.filter(s => stockTickers.has(s));
  
  console.log('Stock symbols requested:', recognizedStocks);
  
  if (recognizedStocks.length === 0) return [];
  
  if (!polygonApiKey) {
    console.warn('POLYGON_API_KEY not configured, returning placeholder data');
    return recognizedStocks.map(symbol => ({
      symbol,
      price: symbol === 'MNPR' ? 12.50 : symbol === 'EA' ? 145.30 : Math.random() * 500 + 100,
      change24h: (Math.random() - 0.5) * 5,
      timestamp: new Date().toISOString(),
      source: 'placeholder'
    }));
  }
  
  const stockQuotes: QuoteData[] = [];
  
  // Fetch each stock individually from Polygon
  for (const symbol of recognizedStocks) {
    try {
      // Get snapshot for current price
      const snapshotUrl = `https://api.polygon.io/v2/snapshot/locale/us/markets/stocks/tickers/${symbol}?apiKey=${polygonApiKey}`;
      
      console.log(`Fetching ${symbol} from Polygon...`);
      const response = await fetch(snapshotUrl);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Polygon error for ${symbol}:`, response.status, errorText);
        continue;
      }
      
      const data = await response.json();
      
      if (data.status === 'OK' && data.ticker) {
        const ticker = data.ticker;
        const price = ticker.day?.c || ticker.prevDay?.c || 0;
        const prevClose = ticker.prevDay?.c || price;
        const change24h = prevClose > 0 ? ((price - prevClose) / prevClose) * 100 : 0;
        
        stockQuotes.push({
          symbol,
          price,
          change24h,
          timestamp: new Date().toISOString(),
          source: 'polygon'
        });
        
        console.log(`✅ ${symbol}: $${price} (${change24h.toFixed(2)}%)`);
      } else {
        console.warn(`No data available for ${symbol}`);
      }
      
    } catch (error) {
      console.error(`Error fetching ${symbol}:`, error);
    }
  }
  
  console.log(`Successfully fetched ${stockQuotes.length}/${recognizedStocks.length} stock quotes`);
  
  // Return what we got, even if some failed
  return stockQuotes;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    let symbols: string[] = [];
    
    // Handle both GET (URL params) and POST (request body) requests
    if (req.method === 'GET') {
      const url = new URL(req.url);
      const symbolsParam = url.searchParams.get('symbols');
      
      if (!symbolsParam) {
        return new Response(
          JSON.stringify({ error: 'symbols parameter required' }),
          { 
            status: 400, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }
      
      symbols = symbolsParam.split(',').map(s => s.trim().toUpperCase());
    } else {
      // Handle POST request with body
      const body = await req.json();
      if (!body.symbols || !Array.isArray(body.symbols)) {
        return new Response(
          JSON.stringify({ error: 'symbols array required in request body' }),
          { 
            status: 400, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }
      
      symbols = body.symbols.map((s: string) => s.trim().toUpperCase());
    }
    const cacheKey = `quotes:${symbols.sort().join(',')}`;
    
    // Check cache first
    const cached = await getCachedData(cacheKey);
    if (cached) {
      console.log('Returning cached quotes data');
      return new Response(
        JSON.stringify(cached),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Fetching fresh quotes data for:', symbols);
    
    // Fetch crypto and stock data concurrently
    const [cryptoQuotes, stockQuotes] = await Promise.all([
      fetchCoinGeckoData(symbols),
      fetchStockData(symbols)
    ]);
    
    console.log('Crypto quotes received:', cryptoQuotes.length);
    console.log('Stock quotes received:', stockQuotes.length);
    
    const allQuotes = [...cryptoQuotes, ...stockQuotes];
    
    if (allQuotes.length === 0) {
      console.warn('No quotes returned for any symbols');
      return new Response(
        JSON.stringify({ 
          quotes: [], 
          timestamp: new Date().toISOString(),
          cached: false,
          message: 'No valid quotes found for requested symbols'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const result = {
      quotes: allQuotes,
      timestamp: new Date().toISOString(),
      cached: false
    };
    
    console.log('Returning result with', allQuotes.length, 'total quotes');
    
    // Cache for 30 seconds to get fresh data quickly after fixes
    await setCachedData(cacheKey, result, 30);
    
    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    console.error('Error in quotes function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});