import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
// OHLCV DATA FETCHING (single call per token)
// ============================================

async function fetchOHLCV(ticker: string, apiKey: string): Promise<number[] | null> {
  try {
    const to = new Date().toISOString().split('T')[0];
    const from = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    const url = `https://api.polygon.io/v2/aggs/ticker/${ticker}/range/1/hour/${from}/${to}?adjusted=true&sort=asc&limit=200&apiKey=${apiKey}`;
    
    const response = await fetch(url);
    if (!response.ok) return null;
    
    const data = await response.json();
    if (!data.results || data.results.length === 0) return null;
    
    return data.results.map((bar: any) => bar.c);
  } catch (error) {
    return null;
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
    const polygonApiKey = Deno.env.get('POLYGON_API_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    const { data: tokens, error: fetchError } = await supabase
      .from('token_cards')
      .select('canonical_symbol, polygon_ticker, price_usd')
      .eq('polygon_supported', true)
      .eq('is_active', true)
      .not('polygon_ticker', 'is', null);
    
    if (fetchError) throw new Error(`Failed to fetch tokens: ${fetchError.message}`);
    
    console.log(`[sync-polygon-crypto-technicals] Processing ${tokens?.length || 0} tokens (hourly OHLCV + local calc)`);
    
    if (!tokens || tokens.length === 0) {
      return new Response(JSON.stringify({ success: true, message: 'No tokens' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    const now = new Date().toISOString();
    const BATCH_SIZE = 30;
    const BATCH_DELAY = 150;
    
    let processed = 0, updated = 0, errors = 0;
    
    for (let i = 0; i < tokens.length; i += BATCH_SIZE) {
      const batch = tokens.slice(i, i + BATCH_SIZE);
      
      const batchResults = await Promise.all(
        batch.map(async (token) => {
          try {
            const ticker = token.polygon_ticker;
            if (!ticker) return null;
            
            const closePrices = await fetchOHLCV(ticker, polygonApiKey);
            if (!closePrices || closePrices.length < 26) return null;
            
            const rsi14 = calculateRSI(closePrices, 14);
            const macd = calculateMACD(closePrices);
            const sma20 = calculateSMA(closePrices, 20);
            const sma50 = calculateSMA(closePrices, 50);
            const sma200 = calculateSMA(closePrices, 200);
            const ema12 = calculateEMA(closePrices, 12);
            const ema26 = calculateEMA(closePrices, 26);
            
            const currentPrice = closePrices[closePrices.length - 1];
            const { score, signal } = calculateTechnicalScore(rsi14, macd, currentPrice, sma20, sma50, sma200);
            
            return {
              canonical_symbol: token.canonical_symbol,
              technicals_updated_at: now,
              rsi_14: rsi14 !== null ? Math.round(rsi14 * 100) / 100 : null,
              macd_line: macd?.value !== undefined ? Math.round(macd.value * 1e8) / 1e8 : null,
              macd_signal: macd?.signal !== undefined ? Math.round(macd.signal * 1e8) / 1e8 : null,
              macd_histogram: macd?.histogram !== undefined ? Math.round(macd.histogram * 1e8) / 1e8 : null,
              sma_20: sma20 !== null ? Math.round(sma20 * 1e8) / 1e8 : null,
              sma_50: sma50 !== null ? Math.round(sma50 * 1e8) / 1e8 : null,
              sma_200: sma200 !== null ? Math.round(sma200 * 1e8) / 1e8 : null,
              ema_12: ema12 !== null ? Math.round(ema12 * 1e8) / 1e8 : null,
              ema_26: ema26 !== null ? Math.round(ema26 * 1e8) / 1e8 : null,
              technical_score: score,
              technical_signal: signal,
            };
          } catch (err) {
            errors++;
            return null;
          }
        })
      );
      
      const validUpdates = batchResults.filter(r => r !== null);
      processed += batch.length;
      
      if (validUpdates.length > 0) {
        const { error: upsertError } = await supabase
          .from('token_cards')
          .upsert(validUpdates, { onConflict: 'canonical_symbol' });
        
        if (upsertError) errors += validUpdates.length;
        else updated += validUpdates.length;
      }
      
      if (i + BATCH_SIZE < tokens.length) {
        await new Promise(r => setTimeout(r, BATCH_DELAY));
      }
    }
    
    const duration = Date.now() - startTime;
    console.log(`[sync-polygon-crypto-technicals] Done: ${updated}/${processed} updated, ${errors} errors, ${duration}ms`);
    
    return new Response(JSON.stringify({ success: true, processed, updated, errors, duration_ms: duration }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('[sync-polygon-crypto-technicals] Fatal:', error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
