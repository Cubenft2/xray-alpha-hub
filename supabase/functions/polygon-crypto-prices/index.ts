import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper function with timeout
async function fetchWithTimeout(url: string, timeoutMs: number = 5000): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  
  try {
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

// Process symbols in batches to avoid overwhelming the API
async function processBatch<T>(
  items: T[],
  batchSize: number,
  processor: (item: T) => Promise<any>
): Promise<any[]> {
  const results: any[] = [];
  
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map(processor));
    results.push(...batchResults);
  }
  
  return results;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { symbols } = await req.json();
    const symbolList = symbols || ['BTC', 'ETH'];
    const polygonApiKey = Deno.env.get('POLYGON_API_KEY');

    if (!polygonApiKey) {
      throw new Error('POLYGON_API_KEY not configured');
    }

    // Check cache first
    const cacheKey = 'polygon:prices:' + symbolList.sort().join(',');
    const { data: cached } = await supabaseClient
      .from('cache_kv')
      .select('v, expires_at')
      .eq('k', cacheKey)
      .single();

    if (cached && new Date(cached.expires_at) > new Date()) {
      return new Response(
        JSON.stringify(cached.v),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Process symbols in batches of 10 to avoid overwhelming the API
    const fetchPrice = async (symbol: string) => {
      try {
        // Fetch current price with timeout
        const priceResponse = await fetchWithTimeout(
          `https://api.polygon.io/v2/last/trade/X:${symbol}USD?apiKey=${polygonApiKey}`,
          5000
        );
        
        if (!priceResponse.ok) return null;
        const priceData = await priceResponse.json();
        const currentPrice = priceData.results?.p;
        
        if (!currentPrice) return null;
        
        // Fetch previous day's close for 24h change calculation
        let change24h = 0;
        try {
          const aggResponse = await fetchWithTimeout(
            `https://api.polygon.io/v2/aggs/ticker/X:${symbol}USD/prev?adjusted=true&apiKey=${polygonApiKey}`,
            5000
          );
          
          if (aggResponse.ok) {
            const aggData = await aggResponse.json();
            const prevClose = aggData.results?.[0]?.c;
            if (prevClose) {
              change24h = ((currentPrice - prevClose) / prevClose) * 100;
            }
          }
        } catch (aggError) {
          // Silently continue without 24h change if aggregates fail
          console.warn(`Failed to fetch aggregates for ${symbol}:`, aggError.message);
        }
        
        return {
          symbol,
          price: currentPrice,
          change24h: change24h,
          timestamp: priceData.results?.t || Date.now(),
          exchange: priceData.results?.x || 'POLYGON',
          size: priceData.results?.s || null
        };
      } catch (error) {
        console.warn(`Failed to fetch price for ${symbol}:`, error.message);
        return null;
      }
    };

    // Process in batches of 10 symbols at a time
    const prices = (await processBatch(symbolList, 10, fetchPrice)).filter(p => p !== null);

    const result = {
      success: true,
      prices,
      timestamp: new Date().toISOString(),
      source: 'polygon.io'
    };

    // Cache for 10 seconds
    const expiresAt = new Date(Date.now() + 10000);
    await supabaseClient
      .from('cache_kv')
      .upsert({
        k: cacheKey,
        v: result,
        expires_at: expiresAt.toISOString()
      });

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('polygon-crypto-prices error:', error.message);
    return new Response(
      JSON.stringify({ success: false, error: error.message, prices: [] }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
