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

  const derivData: DerivData[] = [];
  const timestamp = new Date().toISOString();

  // Fetch funding rates and liquidations for each symbol
  for (const symbol of symbols) {
    try {
      // Map symbol to CoinGlass format (usually just uppercase)
      const coinglassSymbol = symbol.toUpperCase();
      
      // Fetch funding rate (using v2 API example)
      const fundingUrl = `https://open-api.coinglass.com/public/v2/funding?symbol=${coinglassSymbol}`;
      const fundingResponse = await fetch(fundingUrl, {
        headers: {
          'coinglassSecret': coinglassApiKey,
        }
      });

      // Fetch liquidations (last 24h)
      const liqUrl = `https://open-api.coinglass.com/public/v2/liquidation?symbol=${coinglassSymbol}&timeType=24h`;
      const liqResponse = await fetch(liqUrl, {
        headers: {
          'coinglassSecret': coinglassApiKey,
        }
      });

      let fundingRate = 0;
      let liquidations24h = { long: 0, short: 0, total: 0 };

      if (fundingResponse.ok) {
        const fundingData = await fundingResponse.json();
        if (fundingData.success && fundingData.data?.[0]) {
          fundingRate = parseFloat(fundingData.data[0].fundingRate || 0);
        }
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
      }

      derivData.push({
        symbol,
        fundingRate,
        liquidations24h,
        timestamp,
        source: 'coinglass'
      });

    } catch (error) {
      console.error(`Error fetching CoinGlass data for ${symbol}:`, error);
      // Add placeholder data for failed requests
      derivData.push({
        symbol,
        fundingRate: 0,
        liquidations24h: { long: 0, short: 0, total: 0 },
        timestamp,
        source: 'error'
      });
    }
  }

  return derivData;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
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
    const cacheKey = `derivs:${symbols.sort().join(',')}`;
    
    // Check cache first
    const cached = await getCachedData(cacheKey);
    if (cached) {
      console.log('Returning cached derivatives data');
      return new Response(
        JSON.stringify(cached),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Fetching fresh derivatives data for:', symbols);
    
    const derivsData = await fetchCoinglassData(symbols);
    const result = {
      derivatives: derivsData,
      timestamp: new Date().toISOString(),
      cached: false
    };
    
    // Cache for 300 seconds (5 minutes)
    await setCachedData(cacheKey, result, 300);
    
    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    console.error('Error in derivs function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});