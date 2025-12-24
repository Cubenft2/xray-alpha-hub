import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ============================================
// CONFIGURATION
// ============================================

const CACHE_KEY = 'coingecko_technicals_cursor';
const CACHE_TTL_HOURS = 24; // Reset cursor daily
const MAX_RUNTIME_MS = 55000; // 55 seconds max (leave buffer for edge function timeout)
const API_DELAY_MS = 150; // 150ms between API calls
const BATCH_SIZE = 20; // Upsert batch size
const TOP_1000_ALWAYS_REFRESH = true; // Always refresh top 1000

// ============================================
// LOCAL INDICATOR CALCULATORS
// ============================================

function calculateSMA(prices: number[], period: number): number | null {
  if (prices.length < period) return null;
  const slice = prices.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / period;
}

function calculateEMA(prices: number[], period: number): number | null {
  if (prices.length < period) return null;
  const k = 2 / (period + 1);
  let ema = prices.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < prices.length; i++) {
    ema = prices[i] * k + ema * (1 - k);
  }
  return ema;
}

function calculateRSI(prices: number[], period: number = 14): number | null {
  if (prices.length < period + 1) return null;
  
  let gains = 0;
  let losses = 0;
  
  for (let i = prices.length - period; i < prices.length; i++) {
    const diff = prices[i] - prices[i - 1];
    if (diff >= 0) gains += diff;
    else losses -= diff;
  }
  
  const avgGain = gains / period;
  const avgLoss = losses / period;
  
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

function calculateMACD(prices: number[]): { value: number; signal: number; histogram: number } | null {
  if (prices.length < 26) return null;
  
  const ema12 = calculateEMA(prices, 12);
  const ema26 = calculateEMA(prices, 26);
  
  if (ema12 === null || ema26 === null) return null;
  
  const macdLine = ema12 - ema26;
  
  const macdValues: number[] = [];
  for (let i = 26; i <= prices.length; i++) {
    const slice = prices.slice(0, i);
    const e12 = calculateEMA(slice, 12);
    const e26 = calculateEMA(slice, 26);
    if (e12 !== null && e26 !== null) {
      macdValues.push(e12 - e26);
    }
  }
  
  const signalLine = macdValues.length >= 9 ? calculateEMA(macdValues, 9) : macdLine;
  const histogram = macdLine - (signalLine || macdLine);
  
  return { value: macdLine, signal: signalLine || macdLine, histogram };
}

// ============================================
// TECHNICAL SCORE CALCULATION
// ============================================

function calculateTechnicalScore(
  rsi: number | null,
  macd: { value: number; signal: number; histogram: number } | null,
  currentPrice: number | null,
  sma20: number | null,
  sma50: number | null,
  sma200: number | null
): { score: number; signal: string } {
  let score = 50;
  
  if (rsi !== null) {
    if (rsi < 30) score += 15;
    else if (rsi < 40) score += 8;
    else if (rsi > 70) score -= 15;
    else if (rsi > 60) score -= 8;
  }
  
  if (macd !== null) {
    if (macd.histogram > 0 && macd.value > macd.signal) score += 15;
    else if (macd.histogram > 0) score += 8;
    else if (macd.histogram < 0 && macd.value < macd.signal) score -= 15;
    else if (macd.histogram < 0) score -= 8;
  }
  
  if (currentPrice !== null && sma20 !== null && sma50 !== null) {
    if (currentPrice > sma20 && currentPrice > sma50) {
      score += 15;
      if (sma20 > sma50) score += 5;
    } else if (currentPrice < sma20 && currentPrice < sma50) {
      score -= 15;
      if (sma20 < sma50) score -= 5;
    }
  }
  
  if (currentPrice !== null && sma200 !== null) {
    if (currentPrice > sma200) score += 5;
    else score -= 5;
  }
  
  score = Math.max(0, Math.min(100, score));
  
  let signal: string;
  if (score >= 65) signal = 'buy';
  else if (score <= 35) signal = 'sell';
  else signal = 'neutral';
  
  return { score, signal };
}

// ============================================
// COINGECKO API FETCHING
// ============================================

async function fetchCoinGeckoOHLC(coinId: string, apiKey: string): Promise<number[] | null> {
  try {
    const url = `https://pro-api.coingecko.com/api/v3/coins/${coinId}/market_chart?vs_currency=usd&days=30&interval=daily&x_cg_pro_api_key=${apiKey}`;
    
    const response = await fetch(url);
    if (!response.ok) {
      if (response.status === 429) {
        console.log(`[CoinGecko] Rate limited for ${coinId}`);
      }
      return null;
    }
    
    const data = await response.json();
    if (!data.prices || data.prices.length < 26) return null;
    
    return data.prices.map((p: [number, number]) => p[1]);
  } catch (error) {
    console.error(`[CoinGecko] Error fetching ${coinId}:`, error);
    return null;
  }
}

// ============================================
// CURSOR MANAGEMENT
// ============================================

async function getCursor(supabase: any): Promise<{ lastRank: number; phase: string; runCount: number }> {
  try {
    const { data } = await supabase
      .from('cache_kv')
      .select('v')
      .eq('k', CACHE_KEY)
      .single();
    
    if (data?.v) {
      return data.v as { lastRank: number; phase: string; runCount: number };
    }
  } catch {
    // No cursor found
  }
  return { lastRank: 0, phase: 'top1000', runCount: 0 };
}

async function setCursor(supabase: any, cursor: { lastRank: number; phase: string; runCount: number }): Promise<void> {
  const expiresAt = new Date(Date.now() + CACHE_TTL_HOURS * 60 * 60 * 1000).toISOString();
  
  await supabase
    .from('cache_kv')
    .upsert({
      k: CACHE_KEY,
      v: cursor,
      expires_at: expiresAt,
    }, { onConflict: 'k' });
}

async function clearCursor(supabase: any): Promise<void> {
  await supabase.from('cache_kv').delete().eq('k', CACHE_KEY);
}

// ============================================
// API CALL LOGGING
// ============================================

async function logApiCall(supabase: any, success: boolean, errorMsg?: string) {
  try {
    await supabase.from('external_api_calls').insert({
      api_name: 'coingecko',
      function_name: 'sync-token-cards-coingecko-technicals',
      success,
      call_count: 1,
      error_message: errorMsg || null,
    });
  } catch {
    // Ignore logging errors
  }
}

// ============================================
// MAIN HANDLER
// ============================================

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const coingeckoApiKey = Deno.env.get('COINGECKO_API_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Parse options from request
    let forceReset = false;
    let targetLimit = 500; // Default tokens per run
    try {
      const body = await req.json();
      forceReset = body.reset === true;
      if (body.limit) targetLimit = Math.min(body.limit, 1000);
    } catch {
      // Use defaults
    }
    
    // Get or reset cursor
    let cursor = forceReset ? { lastRank: 0, phase: 'top1000', runCount: 0 } : await getCursor(supabase);
    
    if (forceReset) {
      await clearCursor(supabase);
      console.log('[CG-Technicals] Cursor reset requested');
    }
    
    console.log(`[CG-Technicals] Starting run #${cursor.runCount + 1}, phase: ${cursor.phase}, lastRank: ${cursor.lastRank}`);
    
    // ============================================
    // PHASE 1: Top 1000 (always refresh if enabled)
    // ============================================
    
    let tokens: any[] = [];
    let isTop1000Phase = cursor.phase === 'top1000';
    
    if (isTop1000Phase) {
      // Fetch Top 1000 tokens that need technicals update
      // Either: no technicals yet, OR stale (>6 hours for top 1000)
      const staleThreshold = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
      
      const { data, error } = await supabase
        .from('token_cards')
        .select('canonical_symbol, coingecko_id, price_usd, market_cap_rank, technicals_updated_at')
        .eq('is_active', true)
        .or('polygon_supported.is.null,polygon_supported.eq.false')
        .not('coingecko_id', 'is', null)
        .not('market_cap_rank', 'is', null)
        .lte('market_cap_rank', 1000)
        .gt('market_cap_rank', cursor.lastRank)
        .or(`technicals_updated_at.is.null,technicals_updated_at.lt.${staleThreshold}`)
        .order('market_cap_rank', { ascending: true })
        .limit(targetLimit);
      
      if (error) throw new Error(`Failed to fetch Top 1000: ${error.message}`);
      
      tokens = data || [];
      console.log(`[CG-Technicals] Top 1000 phase: found ${tokens.length} tokens needing update (rank > ${cursor.lastRank})`);
      
      // If no more Top 1000 to process, move to next phase
      if (tokens.length === 0) {
        cursor.phase = 'top3000';
        cursor.lastRank = 1000; // Start from rank 1001
        console.log('[CG-Technicals] Top 1000 complete, moving to Top 3000 phase');
      }
    }
    
    // ============================================
    // PHASE 2: Ranks 1001-3000
    // ============================================
    
    if (cursor.phase === 'top3000' && tokens.length === 0) {
      const staleThreshold = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(); // 12 hour threshold for 1001-3000
      
      const { data, error } = await supabase
        .from('token_cards')
        .select('canonical_symbol, coingecko_id, price_usd, market_cap_rank, technicals_updated_at')
        .eq('is_active', true)
        .or('polygon_supported.is.null,polygon_supported.eq.false')
        .not('coingecko_id', 'is', null)
        .not('market_cap_rank', 'is', null)
        .gt('market_cap_rank', cursor.lastRank)
        .lte('market_cap_rank', 3000)
        .or(`technicals_updated_at.is.null,technicals_updated_at.lt.${staleThreshold}`)
        .order('market_cap_rank', { ascending: true })
        .limit(targetLimit);
      
      if (error) throw new Error(`Failed to fetch Top 3000: ${error.message}`);
      
      tokens = data || [];
      console.log(`[CG-Technicals] Top 3000 phase: found ${tokens.length} tokens needing update (rank > ${cursor.lastRank})`);
      
      // If no more 1001-3000 to process, move to backlog
      if (tokens.length === 0) {
        cursor.phase = 'backlog';
        cursor.lastRank = 3000;
        console.log('[CG-Technicals] Top 3000 complete, moving to backlog phase');
      }
    }
    
    // ============================================
    // PHASE 3: Backlog (ranks > 3000)
    // ============================================
    
    if (cursor.phase === 'backlog' && tokens.length === 0) {
      const staleThreshold = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(); // 24 hour threshold for backlog
      
      const { data, error } = await supabase
        .from('token_cards')
        .select('canonical_symbol, coingecko_id, price_usd, market_cap_rank, technicals_updated_at')
        .eq('is_active', true)
        .or('polygon_supported.is.null,polygon_supported.eq.false')
        .not('coingecko_id', 'is', null)
        .gt('market_cap_rank', cursor.lastRank)
        .or(`technicals_updated_at.is.null,technicals_updated_at.lt.${staleThreshold}`)
        .order('market_cap_rank', { ascending: true, nullsFirst: false })
        .limit(targetLimit);
      
      if (error) throw new Error(`Failed to fetch backlog: ${error.message}`);
      
      tokens = data || [];
      console.log(`[CG-Technicals] Backlog phase: found ${tokens.length} tokens needing update (rank > ${cursor.lastRank})`);
      
      // If backlog is empty, reset to start fresh cycle
      if (tokens.length === 0) {
        cursor.phase = 'top1000';
        cursor.lastRank = 0;
        cursor.runCount++;
        await setCursor(supabase, cursor);
        console.log(`[CG-Technicals] Full cycle complete! Run count: ${cursor.runCount}`);
        
        return new Response(JSON.stringify({ 
          success: true, 
          message: 'Full cycle complete, cursor reset',
          run_count: cursor.runCount
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }
    
    if (tokens.length === 0) {
      return new Response(JSON.stringify({ success: true, message: 'No tokens to process' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    // ============================================
    // PROCESS TOKENS
    // ============================================
    
    const now = new Date().toISOString();
    let processed = 0, updated = 0, errors = 0, apiCalls = 0;
    const updates: any[] = [];
    let lastProcessedRank = cursor.lastRank;
    
    for (const token of tokens) {
      // Check time limit
      if (Date.now() - startTime > MAX_RUNTIME_MS) {
        console.log(`[CG-Technicals] Time limit reached after ${processed} tokens`);
        break;
      }
      
      try {
        const closePrices = await fetchCoinGeckoOHLC(token.coingecko_id, coingeckoApiKey);
        apiCalls++;
        
        if (!closePrices || closePrices.length < 26) {
          await logApiCall(supabase, true);
          processed++;
          lastProcessedRank = Math.max(lastProcessedRank, token.market_cap_rank || 0);
          continue;
        }
        
        await logApiCall(supabase, true);
        
        const rsi14 = calculateRSI(closePrices, 14);
        const macd = calculateMACD(closePrices);
        const sma20 = calculateSMA(closePrices, 20);
        const sma50 = closePrices.length >= 50 ? calculateSMA(closePrices, 50) : null;
        const sma200 = null; // Not enough daily data
        const ema12 = calculateEMA(closePrices, 12);
        const ema26 = calculateEMA(closePrices, 26);
        
        const currentPrice = closePrices[closePrices.length - 1];
        const { score, signal } = calculateTechnicalScore(rsi14, macd, currentPrice, sma20, sma50, sma200);
        
        updates.push({
          canonical_symbol: token.canonical_symbol,
          technicals_updated_at: now,
          technicals_source: 'coingecko',
          rsi_14: rsi14 !== null ? Math.round(rsi14 * 100) / 100 : null,
          macd_line: macd?.value !== undefined ? Math.round(macd.value * 1e8) / 1e8 : null,
          macd_signal: macd?.signal !== undefined ? Math.round(macd.signal * 1e8) / 1e8 : null,
          macd_histogram: macd?.histogram !== undefined ? Math.round(macd.histogram * 1e8) / 1e8 : null,
          sma_20: sma20 !== null ? Math.round(sma20 * 1e8) / 1e8 : null,
          sma_50: sma50 !== null ? Math.round(sma50 * 1e8) / 1e8 : null,
          sma_200: sma200,
          ema_12: ema12 !== null ? Math.round(ema12 * 1e8) / 1e8 : null,
          ema_26: ema26 !== null ? Math.round(ema26 * 1e8) / 1e8 : null,
          technical_score: score,
          technical_signal: signal,
        });
        
        processed++;
        lastProcessedRank = Math.max(lastProcessedRank, token.market_cap_rank || 0);
        
        // Batch upsert
        if (updates.length >= BATCH_SIZE) {
          const { error: upsertError } = await supabase
            .from('token_cards')
            .upsert(updates, { onConflict: 'canonical_symbol' });
          
          if (upsertError) {
            console.error(`[CG-Technicals] Upsert error:`, upsertError);
            errors += updates.length;
          } else {
            updated += updates.length;
          }
          updates.length = 0;
        }
        
        // Rate limit delay
        await new Promise(r => setTimeout(r, API_DELAY_MS));
        
      } catch (err) {
        console.error(`[CG-Technicals] Error for ${token.canonical_symbol}:`, err);
        await logApiCall(supabase, false, String(err));
        errors++;
        processed++;
        lastProcessedRank = Math.max(lastProcessedRank, token.market_cap_rank || 0);
      }
    }
    
    // Final batch upsert
    if (updates.length > 0) {
      const { error: upsertError } = await supabase
        .from('token_cards')
        .upsert(updates, { onConflict: 'canonical_symbol' });
      
      if (upsertError) {
        console.error(`[CG-Technicals] Final upsert error:`, upsertError);
        errors += updates.length;
      } else {
        updated += updates.length;
      }
    }
    
    // Update cursor for next run
    cursor.lastRank = lastProcessedRank;
    await setCursor(supabase, cursor);
    
    const duration = Date.now() - startTime;
    console.log(`[CG-Technicals] Done: ${updated}/${processed} updated, ${errors} errors, ${apiCalls} API calls, phase: ${cursor.phase}, lastRank: ${lastProcessedRank}, ${duration}ms`);
    
    return new Response(JSON.stringify({ 
      success: true, 
      processed, 
      updated, 
      errors, 
      api_calls: apiCalls,
      phase: cursor.phase,
      last_rank: lastProcessedRank,
      duration_ms: duration 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('[CG-Technicals] Fatal:', error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
