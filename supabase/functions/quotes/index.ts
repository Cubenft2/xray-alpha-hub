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
  // SIL capability flags
  price_ok?: boolean;
  tv_ok?: boolean;
  derivs_ok?: boolean;
  social_ok?: boolean;
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

// Normalize symbol: uppercase, strip spaces and hyphens but KEEP underscores
function norm(symbol: string): string {
  return symbol.toUpperCase().replace(/[\s\-]/g, '');
}

// Fetch ticker mappings from database with capability flags
// Use canonical display_symbol → coingecko_id/polygon_ticker resolution
async function getTickerMapping(symbol: string): Promise<any | null> {
  const normalized = norm(symbol);
  
  try {
    // Try exact match on symbol or display_symbol (case-insensitive)
    const { data, error } = await supabase
      .from('ticker_mappings')
      .select(`
        *,
        price_supported,
        tradingview_supported,
        derivs_supported,
        social_supported
      `)
      .ilike('symbol', normalized)
      .eq('is_active', true)
      .maybeSingle();
    
    if (data) {
      console.log(`✅ Resolved ${symbol} → ${data.display_symbol} (via symbol match)`);
      return data;
    }
    
    // Try display_symbol match
    const { data: displayData } = await supabase
      .from('ticker_mappings')
      .select(`
        *,
        price_supported,
        tradingview_supported,
        derivs_supported,
        social_supported
      `)
      .ilike('display_symbol', normalized)
      .eq('is_active', true)
      .maybeSingle();
    
    if (displayData) {
      console.log(`✅ Resolved ${symbol} → ${displayData.display_symbol} (via display_symbol match)`);
      return displayData;
    }
    
    // Check aliases array
    const { data: aliasData } = await supabase
      .from('ticker_mappings')
      .select(`
        *,
        price_supported,
        tradingview_supported,
        derivs_supported,
        social_supported
      `)
      .contains('aliases', [normalized])
      .eq('is_active', true)
      .maybeSingle();
    
    if (aliasData) {
      console.log(`✅ Resolved ${symbol} → ${aliasData.display_symbol} (via aliases match)`);
      return aliasData;
    }
    
    console.warn(`❌ No mapping found for ${symbol} (normalized: ${normalized})`);
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
  mapping?: any;
}> {
  // First check database mapping
  const mapping = await getTickerMapping(symbol);
  
  if (mapping) {
    return {
      coinGeckoId: mapping.coingecko_id || undefined,
      polygonTicker: mapping.polygon_ticker || undefined,
      preferredExchange: mapping.preferred_exchange || undefined,
      resolved: true,
      mapping
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
async function fetchCoinGeckoPrice(coinId: string, symbol: string, mapping?: any): Promise<QuoteData | null> {
  if (!coinGeckoApiKey) {
    console.warn('CoinGecko API key not configured');
    return null;
  }
  
  try {
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd&include_24hr_change=true`;
    console.log(`📡 Fetching CoinGecko price for ${symbol} (${coinId})...`);
    const response = await fetch(url, {
      headers: {
        'x-cg-pro-api-key': coinGeckoApiKey,
        'accept': 'application/json'
      }
    });
    
    if (!response.ok) {
      console.error(`❌ CoinGecko API error for ${coinId}:`, response.status, response.statusText);
      return null;
    }
    
    const data = await response.json();
    if (data[coinId]) {
      console.log(`✅ Got CoinGecko price for ${symbol}: $${data[coinId].usd}`);
      return {
        symbol,
        price: data[coinId].usd,
        change24h: data[coinId].usd_24h_change || 0,
        timestamp: new Date().toISOString(),
        source: 'coingecko',
        // SIL capability flags from mapping
        price_ok: mapping?.price_supported !== false,
        tv_ok: mapping?.tradingview_supported !== false,
        derivs_ok: mapping?.derivs_supported === true,
        social_ok: mapping?.social_supported === true,
      };
    }
    
    console.warn(`⚠️ No data in CoinGecko response for ${coinId}`);
    return null;
  } catch (error) {
    console.error(`❌ Error fetching ${coinId} from CoinGecko:`, error);
    return null;
  }
}

// Fetch from Polygon - supports both stocks and crypto
async function fetchPolygonPrice(ticker: string, symbol: string, mapping?: any): Promise<QuoteData | null> {
  if (!polygonApiKey) return null;
  
  try {
    console.log(`📡 Fetching Polygon price for ${symbol} (${ticker})...`);
    
    // Try stocks endpoint first
    const stockUrl = `https://api.polygon.io/v2/snapshot/locale/us/markets/stocks/tickers/${ticker}?apiKey=${polygonApiKey}`;
    const stockResponse = await fetch(stockUrl);
    
    if (stockResponse.ok) {
      const data = await stockResponse.json();
      if (data.status === 'OK' && data.ticker) {
        const tickerData = data.ticker;
        const price = tickerData.day?.c || tickerData.prevDay?.c || 0;
        const prevClose = tickerData.prevDay?.c || price;
        const change24h = prevClose > 0 ? ((price - prevClose) / prevClose) * 100 : 0;
        
        console.log(`✅ Got Polygon stock price for ${symbol}: $${price}`);
        return {
          symbol,
          price,
          change24h,
          timestamp: new Date().toISOString(),
          source: 'polygon-stock',
          price_ok: mapping?.price_supported !== false,
          tv_ok: mapping?.tradingview_supported !== false,
          derivs_ok: mapping?.derivs_supported === true,
          social_ok: mapping?.social_supported === true,
        };
      }
    }
    
    // If stock fails, try crypto endpoint with X: prefix
    const cryptoTicker = ticker.startsWith('X:') ? ticker : `X:${ticker}USD`;
    const cryptoUrl = `https://api.polygon.io/v2/snapshot/locale/global/markets/crypto/tickers/${cryptoTicker}?apiKey=${polygonApiKey}`;
    const cryptoResponse = await fetch(cryptoUrl);
    
    if (cryptoResponse.ok) {
      const data = await cryptoResponse.json();
      if (data.status === 'OK' && data.ticker) {
        const tickerData = data.ticker;
        const price = tickerData.day?.c || tickerData.prevDay?.c || 0;
        const prevClose = tickerData.prevDay?.c || price;
        const change24h = prevClose > 0 ? ((price - prevClose) / prevClose) * 100 : 0;
        
        console.log(`✅ Got Polygon crypto price for ${symbol}: $${price}`);
        return {
          symbol,
          price,
          change24h,
          timestamp: new Date().toISOString(),
          source: 'polygon-crypto',
          price_ok: mapping?.price_supported !== false,
          tv_ok: mapping?.tradingview_supported !== false,
          derivs_ok: mapping?.derivs_supported === true,
          social_ok: mapping?.social_supported === true,
        };
      }
    }
    
    console.warn(`⚠️ No Polygon data found for ${ticker}`);
    return null;
  } catch (error) {
    console.error(`❌ Error fetching ${ticker} from Polygon:`, error);
    return null;
  }
}

// Main quote fetching with resolution pipeline
async function fetchQuotesWithResolution(symbols: string[]): Promise<{
  quotes: QuoteData[];
}> {
  const quotes: QuoteData[] = [];
  const missingInternal: string[] = [];
  
  // Resolve all symbols and fetch quotes
  for (const symbol of symbols) {
    const resolution = await resolveSymbol(symbol);
    
    if (!resolution.resolved) {
      console.warn(`❌ Symbol not resolved: ${symbol} - trying as stock ticker`);
      // For unresolved symbols, try Polygon as stock ticker (last resort)
      const stockQuote = await fetchPolygonPrice(symbol, symbol);
      if (stockQuote) {
        quotes.push(stockQuote);
        continue;
      }
      
      missingInternal.push(symbol);
      quotes.push({
        symbol,
        price: null,
        change24h: 0,
        timestamp: new Date().toISOString(),
        source: 'missing'
      });
      continue;
    }
    
    console.log(`✅ Resolved ${symbol}:`, {
      coinGeckoId: resolution.coinGeckoId,
      polygonTicker: resolution.polygonTicker,
      hasMapping: !!resolution.mapping
    });
    
    let quote: QuoteData | null = null;
    
    // Try Polygon first if we have a ticker (unlimited API calls)
    if (resolution.polygonTicker) {
      console.log(`📡 Trying Polygon first for ${symbol} (unlimited API)`);
      quote = await fetchPolygonPrice(resolution.polygonTicker, symbol, resolution.mapping);
    }
    
    // Fall back to CoinGecko if Polygon failed and we have an ID (500k/month limit)
    if (!quote && resolution.coinGeckoId) {
      console.log(`📡 Falling back to CoinGecko for ${symbol} (limited API)`);
      quote = await fetchCoinGeckoPrice(resolution.coinGeckoId, symbol, resolution.mapping);
    }
    
    // If still no quote but symbol looks like stock (2-5 uppercase letters), try Polygon
    if (!quote && /^[A-Z]{2,5}$/.test(symbol)) {
      console.log(`⚠️ Trying ${symbol} as stock ticker on Polygon`);
      quote = await fetchPolygonPrice(symbol, symbol, resolution.mapping);
    }
    
    // If still no quote but we have a mapping, mark as mapped but unavailable
    if (!quote && resolution.mapping) {
      console.warn(`⚠️ Symbol ${symbol} is mapped but price unavailable from all sources`);
      quotes.push({
        symbol,
        price: null,
        change24h: 0,
        timestamp: new Date().toISOString(),
        source: 'unavailable',
        // Include capability flags even though price is unavailable
        price_ok: resolution.mapping.price_supported !== false,
        tv_ok: resolution.mapping.tradingview_supported !== false,
        derivs_ok: resolution.mapping.derivs_supported === true,
        social_ok: resolution.mapping.social_supported === true,
      });
      missingInternal.push(symbol);
    } else if (!quote) {
      // Completely missing mapping
      console.error(`❌ No quote retrieved for ${symbol}`);
      missingInternal.push(symbol);
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
  
  // Log missing symbols internally but don't expose to client
  if (missingInternal.length > 0) {
    console.warn('Missing mappings for:', missingInternal);
  }
  
  return { quotes };
}

const TTL_MS = 120000; // 120 seconds cache (reduced API calls)

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
      
      // NEW: Support cache control parameters
      const bypassCache = body.bypassCache === true;
      const ttlMs = body.ttlMs ? Math.max(5000, Math.min(body.ttlMs, 120000)) : TTL_MS;
      
      const uniqueSymbols = [...new Set(symbols)];
      const cacheKey = `quotes:${uniqueSymbols.sort().join(',')}`;
      
      // Check cache unless bypassCache is requested
      if (!bypassCache) {
        const cached = await getCachedData(cacheKey);
        if (cached) {
          console.log('✅ Returning cached quotes');
          return new Response(
            JSON.stringify({ ...cached, cached: true }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      } else {
        console.log('⚡ Cache bypass requested - fetching fresh data');
      }

      console.log('🔄 Fetching fresh quotes for:', uniqueSymbols);
      
      // Fetch with resolution pipeline
      const { quotes } = await fetchQuotesWithResolution(uniqueSymbols);
      
      console.log(`✅ Successfully fetched ${quotes.length} quotes`);
      
      const response = {
        quotes,
        ts: new Date().toISOString(),
        cached: false
      };
      
      // Cache the result unless bypassCache is set
      if (!bypassCache) {
        await setCachedData(cacheKey, response, ttlMs / 1000);
        console.log(`💾 Cached result for ${ttlMs / 1000}s`);
      }
      
      return new Response(
        JSON.stringify(response),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // For GET requests, use default caching behavior
    const uniqueSymbols = [...new Set(symbols)];
    const cacheKey = `quotes:${uniqueSymbols.sort().join(',')}`;
    
    // Check cache
    const cached = await getCachedData(cacheKey);
    if (cached) {
      console.log('✅ Returning cached quotes');
      return new Response(
        JSON.stringify({ ...cached, cached: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('🔄 Fetching fresh quotes for:', uniqueSymbols);
    
    // Fetch with resolution pipeline
    const { quotes } = await fetchQuotesWithResolution(uniqueSymbols);
    
    console.log(`✅ Successfully fetched ${quotes.length} quotes`);
    
    const response = {
      quotes,
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
