import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface IndicatorResponse {
  results?: {
    values?: Array<{
      value?: number;
      signal?: number;
      histogram?: number;
    }>;
  };
  status?: string;
}

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function fetchWithRetry(url: string): Promise<Response | null> {
  try {
    const response = await fetch(url);
    if (response.ok) return response;
    
    // Retry once after 1 second on non-ok response
    await delay(1000);
    return await fetch(url);
  } catch (error) {
    // Retry once on connection error
    await delay(1000);
    try {
      return await fetch(url);
    } catch {
      return null;
    }
  }
}

async function fetchIndicator(
  ticker: string, 
  indicatorType: string, 
  apiKey: string,
  params: string = ''
): Promise<number | { value: number; signal: number; histogram: number } | null> {
  try {
    const url = `https://api.polygon.io/v1/indicators/${indicatorType}/${encodeURIComponent(ticker)}?timespan=day&limit=1${params}&apiKey=${apiKey}`;
    const response = await fetchWithRetry(url);
    
    if (!response || !response.ok) {
      console.warn(`[technicals] ${indicatorType} failed for ${ticker}`);
      return null;
    }
    
    const data: IndicatorResponse = await response.json();
    const values = data.results?.values;
    
    if (!values || values.length === 0) {
      return null;
    }
    
    const latest = values[0];
    
    // MACD returns value, signal, histogram
    if (indicatorType === 'macd') {
      return {
        value: latest.value ?? 0,
        signal: latest.signal ?? 0,
        histogram: latest.histogram ?? 0,
      };
    }
    
    // RSI, SMA, EMA return single value
    return latest.value ?? null;
  } catch (error) {
    console.warn(`[technicals] Error fetching ${indicatorType} for ${ticker}:`, error);
    return null;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  console.log('[sync-polygon-crypto-technicals] Starting technical indicators sync...');

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const polygonApiKey = Deno.env.get('POLYGON_API_KEY')!;

    if (!polygonApiKey) {
      throw new Error('POLYGON_API_KEY not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get active tokens from polygon_crypto_cards
    const { data: tokens, error: fetchError } = await supabase
      .from('polygon_crypto_cards')
      .select('canonical_symbol, primary_ticker')
      .eq('is_active', true)
      .not('primary_ticker', 'is', null);

    if (fetchError) {
      throw new Error(`Failed to fetch tokens: ${fetchError.message}`);
    }

    if (!tokens || tokens.length === 0) {
      console.log('[sync-polygon-crypto-technicals] No active tokens found');
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'No active tokens to process',
        tokensProcessed: 0 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[sync-polygon-crypto-technicals] Processing ${tokens.length} active tokens`);

    const batchSize = 10;
    const now = new Date().toISOString();
    let processedCount = 0;
    let updatedCount = 0;
    let errorCount = 0;

    // Process in batches
    for (let i = 0; i < tokens.length; i += batchSize) {
      const batch = tokens.slice(i, i + batchSize);
      const batchNum = Math.floor(i / batchSize) + 1;
      const totalBatches = Math.ceil(tokens.length / batchSize);
      
      console.log(`[sync-polygon-crypto-technicals] Processing batch ${batchNum}/${totalBatches}`);

      const batchPromises = batch.map(async (token) => {
        const ticker = token.primary_ticker;
        if (!ticker) return null;

        try {
          // Group 1: RSI, MACD, SMA-20, SMA-50 (4 parallel calls)
          const [rsi, macd, sma20, sma50] = await Promise.all([
            fetchIndicator(ticker, 'rsi', polygonApiKey, '&window=14'),
            fetchIndicator(ticker, 'macd', polygonApiKey, '&short_window=12&long_window=26&signal_window=9'),
            fetchIndicator(ticker, 'sma', polygonApiKey, '&window=20'),
            fetchIndicator(ticker, 'sma', polygonApiKey, '&window=50'),
          ]);

          // Small pause between groups to reduce connection resets
          await delay(200);

          // Group 2: SMA-200, EMA-12, EMA-26 (3 parallel calls)
          const [sma200, ema12, ema26] = await Promise.all([
            fetchIndicator(ticker, 'sma', polygonApiKey, '&window=200'),
            fetchIndicator(ticker, 'ema', polygonApiKey, '&window=12'),
            fetchIndicator(ticker, 'ema', polygonApiKey, '&window=26'),
          ]);

          // Build update object with only non-null values
          const update: Record<string, any> = {
            canonical_symbol: token.canonical_symbol,
            technicals_updated_at: now,
          };

          if (typeof rsi === 'number') update.rsi_14 = rsi;
          
          if (macd && typeof macd === 'object') {
            update.macd = macd.value;
            update.macd_signal = macd.signal;
            update.macd_histogram = macd.histogram;
          }
          
          if (typeof sma20 === 'number') update.sma_20 = sma20;
          if (typeof sma50 === 'number') update.sma_50 = sma50;
          if (typeof sma200 === 'number') update.sma_200 = sma200;
          if (typeof ema12 === 'number') update.ema_12 = ema12;
          if (typeof ema26 === 'number') update.ema_26 = ema26;

          return update;
        } catch (error) {
          console.warn(`[technicals] Error processing ${ticker}:`, error);
          errorCount++;
          return null;
        }
      });

      const batchResults = await Promise.all(batchPromises);
      const validUpdates = batchResults.filter(u => u !== null);
      processedCount += batch.length;

      // Upsert batch results
      if (validUpdates.length > 0) {
        const { error: upsertError } = await supabase
          .from('polygon_crypto_cards')
          .upsert(validUpdates, { onConflict: 'canonical_symbol' });

        if (upsertError) {
          console.warn(`[technicals] Upsert error for batch ${batchNum}:`, upsertError);
          errorCount += validUpdates.length;
        } else {
          updatedCount += validUpdates.length;
        }
      }

      // Delay between batches to avoid rate limiting (increased to 500ms)
      if (i + batchSize < tokens.length) {
        await delay(500);
      }
    }

    const duration = Date.now() - startTime;
    const result = {
      success: true,
      tokensProcessed: processedCount,
      tokensUpdated: updatedCount,
      errors: errorCount,
      durationMs: duration,
    };

    console.log(`[sync-polygon-crypto-technicals] Complete:`, result);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[sync-polygon-crypto-technicals] Fatal error:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
