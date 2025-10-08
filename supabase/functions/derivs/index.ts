import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const coinglassApiKey = Deno.env.get('COINGLASS_API_KEY');

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// 🔒 SECURITY: Validate API key on startup
if (coinglassApiKey) {
  if (coinglassApiKey.length < 20) {
    console.warn('⚠️ CoinGlass API key looks invalid (too short)');
  } else {
    console.log('✅ CoinGlass API key loaded');
  }
} else {
  console.warn('⚠️ No CoinGlass API key - using placeholder data');
}

interface DerivData {
  symbol: string;
  fundingRate: number;
  liquidations24h: {
    long: number;
    short: number;
    total: number;
  };
  openInterest?: number;
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

// 🔒 SECURITY: Rate limiting helper
async function checkRateLimit(identifier: string, maxRequests: number, windowSeconds: number): Promise<{ allowed: boolean; remaining: number }> {
  const key = `ratelimit:derivs:${identifier}`;
  const now = Date.now();
  
  try {
    const cached = await getCachedData(key);
    const requests = cached ? cached.requests.filter((ts: number) => now - ts < windowSeconds * 1000) : [];
    
    if (requests.length >= maxRequests) {
      return { allowed: false, remaining: 0 };
    }
    
    requests.push(now);
    await setCachedData(key, { requests }, windowSeconds);
    
    return { allowed: true, remaining: maxRequests - requests.length };
  } catch (error) {
    console.error('Rate limit check error:', error);
    // Fail open to avoid blocking legitimate requests if cache fails
    return { allowed: true, remaining: maxRequests };
  }
}

async function fetchCoinglassData(symbols: string[]): Promise<DerivData[]> {
  if (!coinglassApiKey) {
    console.log('No CoinGlass API key found, returning placeholder data');
    return symbols.map(symbol => ({
      symbol,
      fundingRate: (Math.random() - 0.5) * 0.01, // Mock funding rate
      liquidations24h: {
        long: Math.random() * 50000000,
        short: Math.random() * 30000000,
        total: 0
      },
      timestamp: new Date().toISOString(),
      source: 'placeholder'
    })).map(item => ({
      ...item,
      liquidations24h: {
        ...item.liquidations24h,
        total: item.liquidations24h.long + item.liquidations24h.short
      }
    }));
  }

  const timestamp = new Date().toISOString();

  // 🚀 PERFORMANCE: Fetch all symbols in parallel
  const fetchPromises = symbols.map(async (symbol) => {
    try {
      const coinglassSymbol = symbol.toUpperCase();
      
      // Fetch funding rate and liquidations in parallel
      const [fundingResponse, liqResponse] = await Promise.all([
        fetch(`https://open-api.coinglass.com/public/v2/funding?symbol=${coinglassSymbol}`, {
          headers: { 'coinglassSecret': coinglassApiKey }
        }),
        fetch(`https://open-api.coinglass.com/public/v2/liquidation?symbol=${coinglassSymbol}&timeType=24h`, {
          headers: { 'coinglassSecret': coinglassApiKey }
        })
      ]);

      let fundingRate = 0;
      let liquidations24h = { long: 0, short: 0, total: 0 };

      if (fundingResponse.ok) {
        const fundingData = await fundingResponse.json();
        if (fundingData.success && fundingData.data?.[0]) {
          fundingRate = parseFloat(fundingData.data[0].fundingRate || 0);
        }
      } else {
        console.warn(`CoinGlass funding API error for ${symbol}: ${fundingResponse.status}`);
      }

      if (liqResponse.ok) {
        const liqData = await liqResponse.json();
        if (liqData.success && liqData.data) {
          liquidations24h = {
            long: parseFloat(liqData.data.longLiquidationUsd || 0),
            short: parseFloat(liqData.data.shortLiquidationUsd || 0),
            total: parseFloat(liqData.data.totalLiquidationUsd || 0)
          };
        }
      } else {
        console.warn(`CoinGlass liquidation API error for ${symbol}: ${liqResponse.status}`);
      }

      return {
        symbol,
        fundingRate,
        liquidations24h,
        timestamp,
        source: 'coinglass'
      };

    } catch (error) {
      console.error(`Error fetching CoinGlass data for ${symbol}:`, error);
      return {
        symbol,
        fundingRate: 0,
        liquidations24h: { long: 0, short: 0, total: 0 },
        timestamp,
        source: 'error'
      };
    }
  });

  return Promise.all(fetchPromises);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const startTime = Date.now();
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

    const symbols = symbolsParam.split(',').map(s => s.trim().toUpperCase());

    // 🔒 SECURITY: Limit number of symbols to prevent abuse
    const MAX_SYMBOLS = 10;
    if (symbols.length > MAX_SYMBOLS) {
      console.warn(`Request exceeded max symbols: ${symbols.length} > ${MAX_SYMBOLS}`);
      return new Response(
        JSON.stringify({ 
          error: `Too many symbols requested. Maximum ${MAX_SYMBOLS} allowed.`,
          requested: symbols.length,
          max: MAX_SYMBOLS
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // 🔒 SECURITY: Validate symbol format (alphanumeric only)
    const SYMBOL_REGEX = /^[A-Z0-9]{1,10}$/;
    const invalidSymbols = symbols.filter(s => !SYMBOL_REGEX.test(s));
    if (invalidSymbols.length > 0) {
      console.warn(`Invalid symbol format detected: ${invalidSymbols.join(', ')}`);
      return new Response(
        JSON.stringify({ 
          error: 'Invalid symbol format',
          invalidSymbols,
          validFormat: 'Alphanumeric, 1-10 characters'
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // 🔒 SECURITY: Rate limiting (30 requests per 5 minutes per IP)
    const clientIP = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 
                     req.headers.get('x-real-ip') || 
                     'unknown';
                     
    const { allowed, remaining } = await checkRateLimit(clientIP, 30, 300);

    if (!allowed) {
      console.warn(`⚠️ Rate limit exceeded for IP: ${clientIP}`);
      return new Response(
        JSON.stringify({ 
          error: 'Rate limit exceeded',
          retryAfter: 300,
          message: 'Too many requests. Please try again in 5 minutes.'
        }),
        { 
          status: 429, 
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json',
            'Retry-After': '300',
            'X-RateLimit-Limit': '30',
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Window': '300'
          } 
        }
      );
    }

    console.log('📊 Derivs request:', {
      ip: clientIP,
      symbols: symbols.length,
      symbolList: symbols.join(','),
      timestamp: new Date().toISOString()
    });

    const cacheKey = `derivs:${symbols.sort().join(',')}`;
    
    // Check cache first
    const cached = await getCachedData(cacheKey);
    if (cached) {
      console.log('✅ Returning cached derivatives data');
      return new Response(
        JSON.stringify(cached),
        { 
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json',
            'X-RateLimit-Limit': '30',
            'X-RateLimit-Remaining': remaining.toString(),
            'X-RateLimit-Window': '300'
          } 
        }
      );
    }

    console.log('🔄 Fetching fresh derivatives data for:', symbols);
    
    const derivsData = await fetchCoinglassData(symbols);
    const result = {
      derivatives: derivsData,
      timestamp: new Date().toISOString(),
      cached: false
    };
    
    const duration = Date.now() - startTime;
    console.log('✅ Derivs data fetched:', {
      symbols: symbols.length,
      sources: derivsData.map(d => d.source),
      duration: `${duration}ms`
    });
    
    // Cache for 300 seconds (5 minutes)
    await setCachedData(cacheKey, result, 300);
    
    return new Response(
      JSON.stringify(result),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json',
          'X-RateLimit-Limit': '30',
          'X-RateLimit-Remaining': remaining.toString(),
          'X-RateLimit-Window': '300'
        } 
      }
    );
    
  } catch (error) {
    console.error('❌ Derivs error:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});