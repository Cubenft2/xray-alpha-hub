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

interface QuoteData {
  symbol: string;
  price: number | null;
  change24h: number;
  timestamp: string;
  source: string;
}

interface TickerMapping {
  symbol: string;
  display_symbol: string;
  display_name: string;
  type: string;
  coingecko_id: string | null;
  polygon_ticker: string | null;
  preferred_exchange: string | null;
  aliases: string[] | null;
}

// Normalize symbol: uppercase, strip spaces and hyphens
function norm(symbol: string): string {
  return symbol.toUpperCase().replace(/[\s\-_]/g, '');
}

// Fetch ticker mappings from database
async function getTickerMapping(symbol: string): Promise<TickerMapping | null> {
  const normalized = norm(symbol);
  
  try {
    // Try exact match on display_symbol
    const { data, error } = await supabase
      .from('ticker_mappings')
      .select('*')
      .eq('display_symbol', normalized)
      .eq('is_active', true)
      .maybeSingle();
    
    if (data) return data as TickerMapping;
    
    // Try matching symbol column
    const { data: symbolData } = await supabase
      .from('ticker_mappings')
      .select('*')
      .eq('symbol', normalized)
      .eq('is_active', true)
      .maybeSingle();
    
    if (symbolData) return symbolData as TickerMapping;
    
    return null;
  } catch (error) {
    console.error('Error fetching ticker mapping:', error);
    return null;
  }
}

// Search CoinGecko for unknown coins
async function searchCoinGecko(query: string): Promise<string | null> {
  if (!coinGeckoApiKey) return null;
  
  try {
    const url = `https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(query)}`;
    const response = await fetch(url, {
      headers: { 'x-cg-pro-api-key': coinGeckoApiKey }
    });
    
    if (!response.ok) return null;
    
    const data = await response.json();
    if (data.coins && data.coins.length > 0) {
      console.log(`Found ${query} on CoinGecko: ${data.coins[0].id}`);
      return data.coins[0].id;
    }
    
    return null;
  } catch (error) {
    console.error('Error searching CoinGecko:', error);
    return null;
  }
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

// Resolve symbol to data source
async function resolveSymbol(symbol: string): Promise<{
  coinGeckoId?: string;
  polygonTicker?: string;
  preferredExchange?: string;
  resolved: boolean;
}> {
  // First check database mapping
  const mapping = await getTickerMapping(symbol);
  
  if (mapping) {
    return {
      coinGeckoId: mapping.coingecko_id || undefined,
      polygonTicker: mapping.polygon_ticker || undefined,
      preferredExchange: mapping.preferred_exchange || undefined,
      resolved: true
    };
  }
  
  // Try CoinGecko search as fallback
  const coinGeckoId = await searchCoinGecko(symbol);
  if (coinGeckoId) {
    return {
      coinGeckoId,
      resolved: true
    };
  }
  
  // Not found
  console.warn(`Could not resolve symbol: ${symbol}`);
  return { resolved: false };
}

// Fetch from CoinGecko
async function fetchCoinGeckoPrice(coinId: string, symbol: string): Promise<QuoteData | null> {
  try {
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd&include_24hr_change=true`;
    const response = await fetch(url);
    
    if (!response.ok) return null;
    
    const data = await response.json();
    if (data[coinId]) {
      return {
        symbol,
        price: data[coinId].usd,
        change24h: data[coinId].usd_24h_change || 0,
        timestamp: new Date().toISOString(),
        source: 'coingecko'
      };
    }
    
    return null;
  } catch (error) {
    console.error(`Error fetching ${coinId} from CoinGecko:`, error);
    return null;
  }
}

// Fetch from Polygon
async function fetchPolygonPrice(ticker: string, symbol: string): Promise<QuoteData | null> {
  if (!polygonApiKey) return null;
  
  try {
    const url = `https://api.polygon.io/v2/snapshot/locale/us/markets/stocks/tickers/${ticker}?apiKey=${polygonApiKey}`;
    const response = await fetch(url);
    
    if (!response.ok) return null;
    
    const data = await response.json();
    if (data.status === 'OK' && data.ticker) {
      const tickerData = data.ticker;
      const price = tickerData.day?.c || tickerData.prevDay?.c || 0;
      const prevClose = tickerData.prevDay?.c || price;
      const change24h = prevClose > 0 ? ((price - prevClose) / prevClose) * 100 : 0;
      
      return {
        symbol,
        price,
        change24h,
        timestamp: new Date().toISOString(),
        source: 'polygon'
      };
    }
    
    return null;
  } catch (error) {
    console.error(`Error fetching ${ticker} from Polygon:`, error);
    return null;
  }
}

// Main quote fetching with resolution pipeline
async function fetchQuotesWithResolution(symbols: string[]): Promise<{
  quotes: QuoteData[];
  missing: string[];
}> {
  const quotes: QuoteData[] = [];
  const missing: string[] = [];
  
  // Resolve all symbols and fetch quotes
  for (const symbol of symbols) {
    const resolution = await resolveSymbol(symbol);
    
    if (!resolution.resolved) {
      missing.push(symbol);
      quotes.push({
        symbol,
        price: null,
        change24h: 0,
        timestamp: new Date().toISOString(),
        source: 'missing'
      });
      continue;
    }
    
    let quote: QuoteData | null = null;
    
    // Try CoinGecko first
    if (resolution.coinGeckoId) {
      quote = await fetchCoinGeckoPrice(resolution.coinGeckoId, symbol);
    }
    
    // Try Polygon if CoinGecko failed
    if (!quote && resolution.polygonTicker) {
      quote = await fetchPolygonPrice(resolution.polygonTicker, symbol);
    }
    
    // If still no quote, mark as missing
    if (!quote) {
      missing.push(symbol);
      quotes.push({
        symbol,
        price: null,
        change24h: 0,
        timestamp: new Date().toISOString(),
        source: 'missing'
      });
    } else {
      quotes.push(quote);
    }
  }
  
  return { quotes, missing };
}

const TTL_MS = 150000; // 150 seconds cache

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    let symbols: string[] = [];
    
    // Handle both GET and POST
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
      
      symbols = symbolsParam.split(',').map(s => norm(s.trim()));
    } else {
      const body = await req.json();
      if (!body.symbols || !Array.isArray(body.symbols)) {
        return new Response(
          JSON.stringify({ error: 'symbols array required' }),
          { 
            status: 400, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }
      
      symbols = body.symbols.map((s: string) => norm(s.trim()));
    }
    
    const uniqueSymbols = [...new Set(symbols)];
    const cacheKey = `quotes:${uniqueSymbols.sort().join(',')}`;
    
    // Check cache
    const cached = await getCachedData(cacheKey);
    if (cached) {
      console.log('Returning cached quotes');
      return new Response(
        JSON.stringify({ ...cached, cached: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Fetching fresh quotes for:', uniqueSymbols);
    
    // Fetch with resolution pipeline
    const { quotes, missing } = await fetchQuotesWithResolution(uniqueSymbols);
    
    if (missing.length > 0) {
      console.warn('Missing mappings for:', missing);
    }
    
    console.log(`Successfully fetched ${quotes.length} quotes (${missing.length} missing)`);
    
    const response = {
      quotes,
      missing,
      ts: new Date().toISOString(),
      cached: false
    };
    
    // Cache the result
    await setCachedData(cacheKey, response, TTL_MS / 1000);
    
    return new Response(
      JSON.stringify(response),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    console.error('Error in quotes function:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
