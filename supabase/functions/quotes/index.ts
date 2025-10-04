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

// Batch fetch from CoinGecko - handles up to 100 IDs per request
async function fetchCoinGeckoPricesBatch(
  requests: Array<{ coinId: string; symbol: string; mapping?: any }>
): Promise<Map<string, QuoteData>> {
  const results = new Map<string, QuoteData>();
  
  if (!coinGeckoApiKey) {
    console.warn('CoinGecko API key not configured');
    return results;
  }
  
  if (requests.length === 0) return results;
  
  // Batch in groups of 100 (CoinGecko limit)
  const BATCH_SIZE = 100;
  const batches: typeof requests[] = [];
  
  for (let i = 0; i < requests.length; i += BATCH_SIZE) {
    batches.push(requests.slice(i, i + BATCH_SIZE));
  }
  
  console.log(`📡 Batching ${requests.length} CoinGecko requests into ${batches.length} API call(s)`);
  
  for (const batch of batches) {
    const coinIds = batch.map(r => r.coinId).join(',');
    
    try {
      const url = `https://api.coingecko.com/api/v3/simple/price?ids=${coinIds}&vs_currencies=usd&include_24hr_change=true`;
      console.log(`📡 Fetching batch of ${batch.length} coins from CoinGecko...`);
      
      const response = await fetch(url, {
        headers: {
          'x-cg-pro-api-key': coinGeckoApiKey,
          'accept': 'application/json'
        }
      });
      
      if (!response.ok) {
        console.error(`❌ CoinGecko batch API error:`, response.status, response.statusText);
        continue;
      }
      
      const data = await response.json();
      
      // Map results back to symbols
      for (const req of batch) {
        const priceData = data[req.coinId];
        if (priceData) {
          results.set(req.symbol, {
            symbol: req.symbol,
            price: priceData.usd,
            change24h: priceData.usd_24h_change || 0,
            timestamp: new Date().toISOString(),
            source: 'coingecko',
            price_ok: req.mapping?.price_supported !== false,
            tv_ok: req.mapping?.tradingview_supported !== false,
            derivs_ok: req.mapping?.derivs_supported === true,
            social_ok: req.mapping?.social_supported === true,
          });
        }
      }
      
      console.log(`✅ Got ${results.size} prices from CoinGecko batch`);
      
    } catch (error) {
      console.error(`❌ Error fetching CoinGecko batch:`, error);
    }
  }
  
  return results;
}

// Fetch from Polygon
async function fetchPolygonPrice(ticker: string, symbol: string, mapping?: any): Promise<QuoteData | null> {
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
        source: 'polygon',
        // SIL capability flags from mapping
        price_ok: mapping?.price_supported !== false,
        tv_ok: mapping?.tradingview_supported !== false,
        derivs_ok: mapping?.derivs_supported === true,
        social_ok: mapping?.social_supported === true,
      };
    }
    
    return null;
  } catch (error) {
    console.error(`Error fetching ${ticker} from Polygon:`, error);
    return null;
  }
}

// Main quote fetching with resolution pipeline - now with batching
async function fetchQuotesWithResolution(symbols: string[]): Promise<{
  quotes: QuoteData[];
}> {
  const quotes: QuoteData[] = [];
  const missingInternal: string[] = [];
  
  // Step 1: Resolve all symbols upfront
  const resolutions = new Map<string, Awaited<ReturnType<typeof resolveSymbol>>>();
  
  console.log(`🔍 Resolving ${symbols.length} symbols...`);
  for (const symbol of symbols) {
    const resolution = await resolveSymbol(symbol);
    resolutions.set(symbol, resolution);
  }
  
  // Step 2: Batch CoinGecko requests
  const coinGeckoRequests: Array<{ coinId: string; symbol: string; mapping?: any }> = [];
  const polygonRequests: Array<{ ticker: string; symbol: string; mapping?: any }> = [];
  
  for (const [symbol, resolution] of resolutions.entries()) {
    if (!resolution.resolved) {
      console.warn(`❌ Symbol not resolved: ${symbol}`);
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
    
    if (resolution.coinGeckoId) {
      coinGeckoRequests.push({
        coinId: resolution.coinGeckoId,
        symbol,
        mapping: resolution.mapping
      });
    } else if (resolution.polygonTicker) {
      polygonRequests.push({
        ticker: resolution.polygonTicker,
        symbol,
        mapping: resolution.mapping
      });
    }
  }
  
  // Step 3: Execute batched CoinGecko fetch
  const coinGeckoResults = await fetchCoinGeckoPricesBatch(coinGeckoRequests);
  
  // Step 4: Execute Polygon requests (these can't be batched easily)
  const polygonResults = new Map<string, QuoteData>();
  if (polygonRequests.length > 0) {
    console.log(`📡 Fetching ${polygonRequests.length} Polygon prices...`);
    for (const req of polygonRequests) {
      const result = await fetchPolygonPrice(req.ticker, req.symbol, req.mapping);
      if (result) {
        polygonResults.set(req.symbol, result);
      }
    }
  }
  
  // Step 5: Combine results
  for (const symbol of symbols) {
    // Skip already processed missing symbols
    if (quotes.some(q => q.symbol === symbol)) continue;
    
    const resolution = resolutions.get(symbol);
    if (!resolution?.resolved) continue;
    
    // Check CoinGecko results first
    let quote = coinGeckoResults.get(symbol);
    
    // Fallback to Polygon
    if (!quote) {
      quote = polygonResults.get(symbol);
    }
    
    if (quote) {
      quotes.push(quote);
    } else if (resolution.mapping) {
      // Mapped but no price available
      console.warn(`⚠️ Symbol ${symbol} is mapped but price unavailable`);
      quotes.push({
        symbol,
        price: null,
        change24h: 0,
        timestamp: new Date().toISOString(),
        source: 'unavailable',
        price_ok: resolution.mapping.price_supported !== false,
        tv_ok: resolution.mapping.tradingview_supported !== false,
        derivs_ok: resolution.mapping.derivs_supported === true,
        social_ok: resolution.mapping.social_supported === true,
      });
      missingInternal.push(symbol);
    } else {
      // No mapping and no quote
      console.error(`❌ No quote retrieved for ${symbol}`);
      missingInternal.push(symbol);
      quotes.push({
        symbol,
        price: null,
        change24h: 0,
        timestamp: new Date().toISOString(),
        source: 'missing'
      });
    }
  }
  
  if (missingInternal.length > 0) {
    console.warn('Missing prices for:', missingInternal);
  }
  
  console.log(`✅ Returning ${quotes.length} quotes (${quotes.filter(q => q.price !== null).length} with prices)`);
  
  return { quotes };
}

const TTL_MS = 60000; // 60 seconds cache

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
    const { quotes } = await fetchQuotesWithResolution(uniqueSymbols);
    
    console.log(`Successfully fetched ${quotes.length} quotes`);
    
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
