import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ============= LOCAL TECHNICAL INDICATOR CALCULATORS =============

function calculateSMA(prices: number[], period: number): number | null {
  if (prices.length < period) return null;
  const slice = prices.slice(0, period);
  const sum = slice.reduce((a, b) => a + b, 0);
  return sum / period;
}

function calculateEMA(prices: number[], period: number): number | null {
  if (prices.length < period) return null;
  const k = 2 / (period + 1);
  let ema = prices.slice(prices.length - period).reduce((a, b) => a + b, 0) / period;
  for (let i = prices.length - period - 1; i >= 0; i--) {
    ema = prices[i] * k + ema * (1 - k);
  }
  return ema;
}

function calculateRSI(prices: number[], period: number = 14): number | null {
  if (prices.length < period + 1) return null;
  
  let gains = 0;
  let losses = 0;
  
  for (let i = 0; i < period; i++) {
    const change = prices[i] - prices[i + 1];
    if (change > 0) gains += change;
    else losses -= change;
  }
  
  let avgGain = gains / period;
  let avgLoss = losses / period;
  
  for (let i = period; i < prices.length - 1; i++) {
    const change = prices[i] - prices[i + 1];
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

function calculateMACD(prices: number[]): { macd: number; signal: number; histogram: number } | null {
  const ema12 = calculateEMA(prices, 12);
  const ema26 = calculateEMA(prices, 26);
  
  if (ema12 === null || ema26 === null) return null;
  
  const macd = ema12 - ema26;
  const signal = macd * 0.8;
  const histogram = macd - signal;
  
  return { macd, signal, histogram };
}

const DEBUG_TICKERS = ['X:BTCUSD', 'X:ETHUSD', 'X:SOLUSD'];

async function fetchOHLCV(ticker: string, apiKey: string, bars: number = 200): Promise<number[] | null> {
  const isDebug = DEBUG_TICKERS.includes(ticker);
  try {
    const to = Date.now();
    const from = to - (bars * 60 * 1000);
    
    const url = `https://api.polygon.io/v2/aggs/ticker/${ticker}/range/1/minute/${from}/${to}?adjusted=true&sort=desc&limit=${bars}&apiKey=${apiKey}`;
    const response = await fetch(url);
    
    if (!response.ok) {
      if (isDebug) console.log(`[OHLCV DEBUG] ${ticker} failed: ${response.status}`);
      return null;
    }
    
    const data = await response.json();
    const results = data.results || [];
    
    if (isDebug) console.log(`[OHLCV DEBUG] ${ticker}: minute bars=${results.length}`);
    
    if (results.length >= 30) {
      if (isDebug) console.log(`[OHLCV DEBUG] ${ticker}: using ${results.length} minute bars`);
      return results.map((r: any) => r.c);
    }
    
    const hourlyFrom = to - (bars * 60 * 60 * 1000);
    const hourlyUrl = `https://api.polygon.io/v2/aggs/ticker/${ticker}/range/1/hour/${hourlyFrom}/${to}?adjusted=true&sort=desc&limit=${bars}&apiKey=${apiKey}`;
    const hourlyResponse = await fetch(hourlyUrl);
    
    if (!hourlyResponse.ok) {
      if (isDebug) console.log(`[OHLCV DEBUG] ${ticker}: hourly failed ${hourlyResponse.status}`);
      return null;
    }
    
    const hourlyData = await hourlyResponse.json();
    const hourlyResults = hourlyData.results || [];
    
    if (isDebug) console.log(`[OHLCV DEBUG] ${ticker}: hourly bars=${hourlyResults.length}`);
    
    if (hourlyResults.length < 30) {
      if (isDebug) console.log(`[OHLCV DEBUG] ${ticker}: insufficient hourly (${hourlyResults.length} < 30)`);
      return null;
    }
    
    if (isDebug) console.log(`[OHLCV DEBUG] ${ticker}: using ${hourlyResults.length} hourly bars`);
    return hourlyResults.map((r: any) => r.c);
  } catch (err) {
    if (isDebug) console.error(`[OHLCV DEBUG] ${ticker} error:`, err);
    return null;
  }
}

function calculateAllTechnicals(prices: number[]): {
  rsi_14: number | null;
  macd_line: number | null;
  macd_signal: number | null;
  macd_histogram: number | null;
  sma_20: number | null;
  sma_50: number | null;
  sma_200: number | null;
  ema_12: number | null;
  ema_26: number | null;
} {
  const rsi = calculateRSI(prices, 14);
  const macdResult = calculateMACD(prices);
  
  return {
    rsi_14: rsi,
    macd_line: macdResult?.macd ?? null,
    macd_signal: macdResult?.signal ?? null,
    macd_histogram: macdResult?.histogram ?? null,
    sma_20: calculateSMA(prices, 20),
    sma_50: calculateSMA(prices, 50),
    sma_200: calculateSMA(prices, 200),
    ema_12: calculateEMA(prices, 12),
    ema_26: calculateEMA(prices, 26),
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const polygonKey = Deno.env.get('POLYGON_API_KEY');
    const supabase = createClient(supabaseUrl, supabaseKey);

    if (!polygonKey) {
      throw new Error('POLYGON_API_KEY not configured');
    }

    console.log('[sync-token-cards-polygon] Starting price + technicals sync...');

    // Get and increment call counter
    const COUNTER_KEY = 'sync-token-cards-polygon:call_count';
    const { data: counterData } = await supabase
      .from('cache_kv')
      .select('v')
      .eq('k', COUNTER_KEY)
      .single();
    
    let callCount = counterData?.v?.count || 0;
    callCount++;
    
    await supabase
      .from('cache_kv')
      .upsert({
        k: COUNTER_KEY,
        v: { count: callCount },
        expires_at: new Date(Date.now() + 86400000).toISOString()
      }, { onConflict: 'k' });

    console.log(`[sync-token-cards-polygon] Call #${callCount}`);

    // PRICE tiers (staggered)
    const fetchTier1 = true;
    const fetchTier2 = true;
    const fetchTier3 = callCount % 2 === 0;
    const fetchTier4 = callCount % 5 === 0;

    const tiers: number[] = [1, 2];
    if (fetchTier3) tiers.push(3);
    if (fetchTier4) tiers.push(4);

    console.log(`[sync-token-cards-polygon] Fetching price tiers: ${tiers.join(', ')}`);

    // Fetch tokens with polygon_ticker
    const { data: tokens, error: fetchError } = await supabase
      .from('token_cards')
      .select('id, canonical_symbol, polygon_ticker, tier')
      .not('polygon_ticker', 'is', null)
      .in('tier', tiers)
      .eq('is_active', true);

    if (fetchError) {
      throw new Error(`Failed to fetch tokens: ${fetchError.message}`);
    }

    if (!tokens || tokens.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        message: 'No tokens to sync',
        stats: { fetched: 0, updated: 0 }
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    console.log(`[sync-token-cards-polygon] Found ${tokens.length} tokens to sync`);

    // Fetch Polygon snapshot
    const snapshotUrl = `https://api.polygon.io/v2/snapshot/locale/global/markets/crypto/tickers?apiKey=${polygonKey}`;
    const snapshotResponse = await fetch(snapshotUrl);
    
    if (!snapshotResponse.ok) {
      throw new Error(`Polygon snapshot failed: ${snapshotResponse.status}`);
    }

    const snapshotData = await snapshotResponse.json();
    const tickersList = snapshotData.tickers || [];
    
    console.log(`[sync-token-cards-polygon] Polygon returned ${tickersList.length} tickers`);

    // Build lookup map
    const polygonMap = new Map<string, any>();
    for (const t of tickersList) {
      if (t.ticker) {
        polygonMap.set(t.ticker, t);
      }
    }

    // Process and update tokens
    let updated = 0;
    let notFound = 0;
    const updates: any[] = [];
    const now = new Date().toISOString();

    for (const token of tokens) {
      const polygonTicker = token.polygon_ticker;
      const tickerData = polygonMap.get(polygonTicker);

      if (!tickerData) {
        notFound++;
        continue;
      }

      const day = tickerData.day || {};
      const prevDay = tickerData.prevDay || {};
      const lastQuote = tickerData.lastQuote || {};
      const lastTrade = tickerData.lastTrade || {};

      const currentPrice = lastTrade.p || day.c || tickerData.lastTrade?.p;
      const openPrice = day.o || prevDay.c;
      let changePct = null;
      if (currentPrice && openPrice && openPrice !== 0) {
        changePct = ((currentPrice - openPrice) / openPrice) * 100;
      }

      let spreadPct = null;
      if (lastQuote.P && lastQuote.p && lastQuote.P !== 0) {
        spreadPct = ((lastQuote.P - lastQuote.p) / lastQuote.P) * 100;
      }

      const volume24h = day.v ? day.v * (day.vw || currentPrice || 0) : null;
      
      updates.push({
        id: token.id,
        polygon_ticker: polygonTicker,
        canonical_symbol: token.canonical_symbol,
        tier: token.tier,
        polygon_price_usd: currentPrice,
        polygon_volume_24h: volume24h,
        polygon_change_24h_pct: changePct,
        polygon_high_24h: day.h || null,
        polygon_low_24h: day.l || null,
        polygon_price_updated_at: now,
        open_24h: day.o || null,
        close_24h: day.c || null,
        vwap_24h: day.vw || null,
        bid_price: lastQuote.p || null,
        ask_price: lastQuote.P || null,
        spread_pct: spreadPct,
        polygon_supported: true
      });
    }

    console.log(`[sync-token-cards-polygon] Prepared ${updates.length} price updates, ${notFound} not found`);

    // Batch update prices
    const BATCH_SIZE = 100;
    for (let i = 0; i < updates.length; i += BATCH_SIZE) {
      const batch = updates.slice(i, i + BATCH_SIZE);
      
      for (const update of batch) {
        const { id, canonical_symbol, tier, ...data } = update;
        const { error } = await supabase
          .from('token_cards')
          .update(data)
          .eq('id', id);
        
        if (error) {
          console.error(`[sync-token-cards-polygon] Update error for ${id}:`, error.message);
        } else {
          updated++;
        }
      }
    }

    // ============= TECHNICALS: Tier 1-2 EVERY CALL, Tier 3-4 staggered =============
    let technicalsUpdated = 0;
    
    // FIXED: Tier 1-2 ALWAYS get technicals every call
    const techTiers: number[] = [1, 2]; // Always include Tier 1-2
    if (callCount % 3 === 0) techTiers.push(3);  // Every 3rd call
    if (callCount % 6 === 0) techTiers.push(4);  // Every 6th call
    
    // Get ALL tokens for technicals (including ones not in price update if needed)
    const { data: techTokensRaw } = await supabase
      .from('token_cards')
      .select('id, canonical_symbol, polygon_ticker, tier')
      .not('polygon_ticker', 'is', null)
      .in('tier', techTiers)
      .eq('is_active', true);
    
    const techTokens = techTokensRaw || [];
    
    console.log(`[sync-token-cards-polygon] Calculating technicals for Tier ${techTiers.join(',')} (${techTokens.length} tokens)...`);
    
    // Process in batches
    const TECH_BATCH = 5;
    for (let i = 0; i < techTokens.length; i += TECH_BATCH) {
      const batch = techTokens.slice(i, i + TECH_BATCH);
      
      const techResults = await Promise.all(
        batch.map(async (token) => {
          const ticker = token.polygon_ticker;
          if (!ticker) return null;
          
          try {
            const prices = await fetchOHLCV(ticker, polygonKey, 250);
            if (!prices || prices.length < 30) {
              console.log(`[Technicals] ${ticker}: insufficient data (${prices?.length || 0} bars)`);
              return null;
            }
            
            const technicals = calculateAllTechnicals(prices);
            
            return {
              id: token.id,
              symbol: token.canonical_symbol,
              ...technicals,
              technicals_updated_at: now,
              technicals_source: 'polygon'
            };
          } catch (err) {
            console.error(`[Technicals] Error for ${ticker}:`, err);
            return null;
          }
        })
      );
      
      for (const result of techResults) {
        if (!result) continue;
        
        const { id, symbol, ...techData } = result;
        const { error } = await supabase
          .from('token_cards')
          .update(techData)
          .eq('id', id);
        
        if (error) {
          console.error(`[Technicals] ❌ FAILED ${symbol}:`, error.message);
        } else {
          technicalsUpdated++;
          if (techData.rsi_14) {
            console.log(`[Technicals] ✅ ${symbol}: RSI=${techData.rsi_14?.toFixed(1)}, MACD=${techData.macd_line?.toFixed(4)}`);
          }
        }
      }
      
      if (i + TECH_BATCH < techTokens.length) {
        await new Promise(r => setTimeout(r, 500));
      }
    }
    
    console.log(`[sync-token-cards-polygon] Technicals: ${technicalsUpdated}/${techTokens.length} updated (Tier ${techTiers.join(',')})`);

    const duration = Date.now() - startTime;
    console.log(`[sync-token-cards-polygon] Sync complete in ${duration}ms: ${updated} prices, ${technicalsUpdated} technicals`);

    return new Response(JSON.stringify({
      success: true,
      stats: {
        call_number: callCount,
        tiers_fetched: tiers,
        tokens_queried: tokens.length,
        polygon_tickers: tickersList.length,
        prices_updated: updated,
        technicals_updated: technicalsUpdated,
        technicals_tiers: techTiers,
        not_found: notFound,
        duration_ms: duration
      }
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('[sync-token-cards-polygon] Fatal error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), { 
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  }
});
