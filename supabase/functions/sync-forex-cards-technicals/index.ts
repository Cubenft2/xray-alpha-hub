import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Major forex pairs to prioritize
const MAJOR_PAIRS = [
  'EURUSD', 'USDJPY', 'GBPUSD', 'USDCHF', 'AUDUSD', 'USDCAD', 'NZDUSD',
  'EURGBP', 'EURJPY', 'GBPJPY', 'AUDJPY', 'EURAUD', 'EURCHF', 'GBPCHF'
];

// Calculate RSI
function calculateRSI(closes: number[], period = 14): number | null {
  if (closes.length < period + 1) return null;
  
  let gains = 0;
  let losses = 0;
  
  for (let i = 1; i <= period; i++) {
    const change = closes[i] - closes[i - 1];
    if (change > 0) gains += change;
    else losses -= change;
  }
  
  let avgGain = gains / period;
  let avgLoss = losses / period;
  
  for (let i = period + 1; i < closes.length; i++) {
    const change = closes[i] - closes[i - 1];
    if (change > 0) {
      avgGain = (avgGain * (period - 1) + change) / period;
      avgLoss = (avgLoss * (period - 1)) / period;
    } else {
      avgGain = (avgGain * (period - 1)) / period;
      avgLoss = (avgLoss * (period - 1) - change) / period;
    }
  }
  
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

// Calculate SMA
function calculateSMA(values: number[], period: number): number | null {
  if (values.length < period) return null;
  const slice = values.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / period;
}

// Calculate EMA
function calculateEMA(values: number[], period: number): number | null {
  if (values.length < period) return null;
  const multiplier = 2 / (period + 1);
  let ema = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
  
  for (let i = period; i < values.length; i++) {
    ema = (values[i] - ema) * multiplier + ema;
  }
  return ema;
}

// Calculate MACD
function calculateMACD(closes: number[]): { line: number; signal: number } | null {
  const ema12 = calculateEMA(closes, 12);
  const ema26 = calculateEMA(closes, 26);
  
  if (ema12 === null || ema26 === null) return null;
  
  const macdLine = ema12 - ema26;
  
  // Calculate signal line (9-period EMA of MACD)
  const macdValues: number[] = [];
  const mult12 = 2 / 13;
  const mult26 = 2 / 27;
  
  let runningEma12 = closes.slice(0, 12).reduce((a, b) => a + b, 0) / 12;
  let runningEma26 = closes.slice(0, 26).reduce((a, b) => a + b, 0) / 26;
  
  for (let i = 26; i < closes.length; i++) {
    runningEma12 = (closes[i] - runningEma12) * mult12 + runningEma12;
    runningEma26 = (closes[i] - runningEma26) * mult26 + runningEma26;
    macdValues.push(runningEma12 - runningEma26);
  }
  
  const signalLine = calculateEMA(macdValues, 9);
  
  return { line: macdLine, signal: signalLine || macdLine };
}

// Generate technical signal
function generateSignal(rsi: number | null, macd: { line: number; signal: number } | null, 
                        price: number, sma20: number | null, sma50: number | null, sma200: number | null): string {
  let bullishSignals = 0;
  let bearishSignals = 0;
  
  // RSI signals
  if (rsi !== null) {
    if (rsi < 30) bullishSignals += 2; // Oversold
    else if (rsi < 40) bullishSignals += 1;
    else if (rsi > 70) bearishSignals += 2; // Overbought
    else if (rsi > 60) bearishSignals += 1;
  }
  
  // MACD signals
  if (macd !== null) {
    if (macd.line > macd.signal) bullishSignals += 1;
    else if (macd.line < macd.signal) bearishSignals += 1;
    if (macd.line > 0) bullishSignals += 1;
    else bearishSignals += 1;
  }
  
  // Price vs SMAs
  if (sma20 !== null && price > sma20) bullishSignals += 1;
  else if (sma20 !== null) bearishSignals += 1;
  
  if (sma50 !== null && price > sma50) bullishSignals += 1;
  else if (sma50 !== null) bearishSignals += 1;
  
  if (sma200 !== null && price > sma200) bullishSignals += 1;
  else if (sma200 !== null) bearishSignals += 1;
  
  const netSignal = bullishSignals - bearishSignals;
  
  if (netSignal >= 4) return 'strong_buy';
  if (netSignal >= 2) return 'buy';
  if (netSignal <= -4) return 'strong_sell';
  if (netSignal <= -2) return 'sell';
  return 'neutral';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  
  // Parse force parameter to bypass weekend check
  const url = new URL(req.url);
  const forceRun = url.searchParams.get('force') === 'true';
  
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const polygonKey = Deno.env.get('POLYGON_API_KEY');
    const supabase = createClient(supabaseUrl, supabaseKey);

    if (!polygonKey) {
      throw new Error('POLYGON_API_KEY not configured');
    }

    console.log(`[sync-forex-cards-technicals] Starting forex technicals sync... (force=${forceRun})`);

    // Check if forex market is open (Sunday 5 PM EST - Friday 5 PM EST)
    const now = new Date();
    const dayOfWeek = now.getUTCDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    
    if (isWeekend && !forceRun) {
      console.log('[sync-forex-cards-technicals] Weekend - forex markets closed, skipping (use ?force=true to override)');
      return new Response(JSON.stringify({
        success: true,
        message: 'Forex markets closed (weekend) - use ?force=true to override',
        stats: { updated: 0, market_status: 'closed' }
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    
    if (isWeekend && forceRun) {
      console.log('[sync-forex-cards-technicals] Weekend but force=true, proceeding...');
    }

    // Fetch all active forex pairs
    const { data: forexCards, error: fetchError } = await supabase
      .from('forex_cards')
      .select('id, pair, base_currency, quote_currency, rate, is_major')
      .eq('is_active', true)
      .order('is_major', { ascending: false });

    if (fetchError) {
      throw new Error(`Failed to fetch forex_cards: ${fetchError.message}`);
    }

    if (!forexCards || forexCards.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        message: 'No forex cards to process',
        stats: { updated: 0 }
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    console.log(`[sync-forex-cards-technicals] Processing ${forexCards.length} forex pairs`);

    // Process in batches to avoid overwhelming API
    const BATCH_SIZE = 20;
    const updates: any[] = [];
    let processed = 0;
    let errors = 0;

    // Process major pairs first, then others
    const sortedPairs = [...forexCards].sort((a, b) => {
      const aIsMajor = MAJOR_PAIRS.includes(a.pair.replace('C:', ''));
      const bIsMajor = MAJOR_PAIRS.includes(b.pair.replace('C:', ''));
      if (aIsMajor && !bIsMajor) return -1;
      if (!aIsMajor && bIsMajor) return 1;
      return 0;
    });

    // Limit to top 100 pairs per run (majors + most active)
    const pairsToProcess = sortedPairs.slice(0, 100);

    for (let i = 0; i < pairsToProcess.length; i += BATCH_SIZE) {
      const batch = pairsToProcess.slice(i, i + BATCH_SIZE);
      
      const batchPromises = batch.map(async (card) => {
        try {
          // Get historical data from Polygon (250 days to ensure 200 trading days for SMA200)
          const ticker = card.pair.startsWith('C:') ? card.pair : `C:${card.pair}`;
          const to = new Date();
          const from = new Date();
          from.setDate(from.getDate() - 300); // 300 calendar days ≈ 200+ trading days
          
          const fromStr = from.toISOString().split('T')[0];
          const toStr = to.toISOString().split('T')[0];
          
          const url = `https://api.polygon.io/v2/aggs/ticker/${ticker}/range/1/day/${fromStr}/${toStr}?adjusted=true&sort=asc&limit=250&apiKey=${polygonKey}`;
          
          const response = await fetch(url);
          if (!response.ok) {
            console.warn(`[sync-forex-cards-technicals] Failed to fetch ${ticker}: ${response.status}`);
            return null;
          }
          
          const data = await response.json();
          const results = data.results || [];
          
          if (results.length < 20) {
            console.warn(`[sync-forex-cards-technicals] Insufficient data for ${ticker}: ${results.length} bars`);
            return null;
          }
          
          // Log if we have enough for SMA200
          if (results.length >= 200) {
            console.log(`[sync-forex-cards-technicals] ${ticker}: ${results.length} bars (SMA200 ✓)`);
          } else {
            console.log(`[sync-forex-cards-technicals] ${ticker}: ${results.length} bars (need 200 for SMA200)`);
          }
          
          // Extract closes for calculations
          const closes = results.map((r: any) => r.c);
          const currentPrice = closes[closes.length - 1];
          
          // Calculate all indicators
          const rsi = calculateRSI(closes);
          const sma20 = calculateSMA(closes, 20);
          const sma50 = calculateSMA(closes, 50);
          const sma200 = calculateSMA(closes, 200);
          const macd = calculateMACD(closes);
          const signal = generateSignal(rsi, macd, currentPrice, sma20, sma50, sma200);
          
          return {
            id: card.id,
            rsi_14: rsi ? Math.round(rsi * 100) / 100 : null,
            sma_20: sma20 ? Math.round(sma20 * 100000) / 100000 : null,
            sma_50: sma50 ? Math.round(sma50 * 100000) / 100000 : null,
            sma_200: sma200 ? Math.round(sma200 * 100000) / 100000 : null,
            macd_line: macd ? Math.round(macd.line * 100000) / 100000 : null,
            macd_signal: macd ? Math.round(macd.signal * 100000) / 100000 : null,
            technical_signal: signal,
            technicals_updated_at: new Date().toISOString()
          };
        } catch (err) {
          console.error(`[sync-forex-cards-technicals] Error processing ${card.pair}:`, err);
          errors++;
          return null;
        }
      });
      
      const batchResults = await Promise.all(batchPromises);
      updates.push(...batchResults.filter(u => u !== null));
      processed += batch.length;
      
      // Small delay between batches to be nice to API
      if (i + BATCH_SIZE < pairsToProcess.length) {
        await new Promise(r => setTimeout(r, 200));
      }
    }

    console.log(`[sync-forex-cards-technicals] Calculated technicals for ${updates.length} pairs`);

    // Batch update forex_cards
    let updated = 0;
    const UPDATE_BATCH = 50;
    
    for (let i = 0; i < updates.length; i += UPDATE_BATCH) {
      const batch = updates.slice(i, i + UPDATE_BATCH);
      
      const results = await Promise.all(
        batch.map(async (update) => {
          const { id, ...data } = update;
          const { error } = await supabase
            .from('forex_cards')
            .update(data)
            .eq('id', id);
          return { id, error };
        })
      );
      
      updated += results.filter(r => !r.error).length;
      
      const batchErrors = results.filter(r => r.error);
      if (batchErrors.length > 0) {
        console.error(`[sync-forex-cards-technicals] Update errors:`, batchErrors.length);
      }
    }

    const duration = Date.now() - startTime;
    console.log(`[sync-forex-cards-technicals] Complete in ${duration}ms: ${updated} updated, ${errors} errors`);

    // Log API usage
    await supabase.from('external_api_calls').insert({
      api_name: 'polygon',
      function_name: 'sync-forex-cards-technicals',
      call_count: pairsToProcess.length,
      success: true
    });

    return new Response(JSON.stringify({
      success: true,
      stats: {
        total_pairs: forexCards.length,
        processed: processed,
        updated: updated,
        errors: errors,
        duration_ms: duration
      }
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('[sync-forex-cards-technicals] Fatal error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), { 
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  }
});
