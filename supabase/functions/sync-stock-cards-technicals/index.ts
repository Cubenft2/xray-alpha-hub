import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Calculate RSI from price data
function calculateRSI(prices: number[], period = 14): number | null {
  if (prices.length < period + 1) return null;
  
  const changes: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    changes.push(prices[i] - prices[i - 1]);
  }
  
  let avgGain = 0;
  let avgLoss = 0;
  
  for (let i = 0; i < period; i++) {
    if (changes[i] > 0) avgGain += changes[i];
    else avgLoss += Math.abs(changes[i]);
  }
  
  avgGain /= period;
  avgLoss /= period;
  
  for (let i = period; i < changes.length; i++) {
    const change = changes[i];
    if (change > 0) {
      avgGain = (avgGain * (period - 1) + change) / period;
      avgLoss = (avgLoss * (period - 1)) / period;
    } else {
      avgGain = (avgGain * (period - 1)) / period;
      avgLoss = (avgLoss * (period - 1) + Math.abs(change)) / period;
    }
  }
  
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

// Calculate SMA
function calculateSMA(prices: number[], period: number): number | null {
  if (prices.length < period) return null;
  const slice = prices.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / period;
}

// Calculate EMA
function calculateEMA(prices: number[], period: number): number | null {
  if (prices.length < period) return null;
  const k = 2 / (period + 1);
  let ema = prices.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < prices.length; i++) {
    ema = prices[i] * k + ema * (1 - k);
  }
  return ema;
}

// Calculate MACD
function calculateMACD(prices: number[]): { macd: number; signal: number } | null {
  const ema12 = calculateEMA(prices, 12);
  const ema26 = calculateEMA(prices, 26);
  if (ema12 === null || ema26 === null) return null;
  
  const macdLine = ema12 - ema26;
  
  // Calculate signal line (9-period EMA of MACD)
  const macdValues: number[] = [];
  for (let i = 26; i <= prices.length; i++) {
    const slice = prices.slice(0, i);
    const e12 = calculateEMA(slice, 12);
    const e26 = calculateEMA(slice, 26);
    if (e12 !== null && e26 !== null) {
      macdValues.push(e12 - e26);
    }
  }
  
  const signal = calculateEMA(macdValues, 9);
  return { macd: macdLine, signal: signal || macdLine };
}

// Determine technical signal
function determineTechnicalSignal(rsi: number | null, macd: { macd: number; signal: number } | null, price: number | null, sma20: number | null, sma50: number | null): string {
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
    if (macd.macd > macd.signal) bullishSignals += 1;
    else bearishSignals += 1;
  }
  
  // Price vs SMA signals
  if (price !== null && sma20 !== null) {
    if (price > sma20) bullishSignals += 1;
    else bearishSignals += 1;
  }
  
  if (price !== null && sma50 !== null) {
    if (price > sma50) bullishSignals += 1;
    else bearishSignals += 1;
  }
  
  // Golden/Death cross
  if (sma20 !== null && sma50 !== null) {
    if (sma20 > sma50) bullishSignals += 1;
    else bearishSignals += 1;
  }
  
  if (bullishSignals >= bearishSignals + 3) return 'strong_buy';
  if (bullishSignals >= bearishSignals + 1) return 'buy';
  if (bearishSignals >= bullishSignals + 3) return 'strong_sell';
  if (bearishSignals >= bullishSignals + 1) return 'sell';
  return 'neutral';
}

Deno.serve(async (req) => {
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

    console.log('🚀 sync-stock-cards-technicals: Starting technical indicators sync...');

    // Get stocks from stock_cards that need technicals update
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    
    const { data: stocks, error: stocksError } = await supabase
      .from('stock_cards')
      .select('symbol, price_usd')
      .eq('is_active', true)
      .or(`technicals_updated_at.is.null,technicals_updated_at.lt.${fifteenMinutesAgo}`)
      .not('price_usd', 'is', null)
      .limit(200); // Process 200 stocks per run

    if (stocksError) {
      throw new Error(`Failed to fetch stocks: ${stocksError.message}`);
    }

    console.log(`📊 Processing technicals for ${stocks?.length || 0} stocks`);

    if (!stocks || stocks.length === 0) {
      return new Response(JSON.stringify({ 
        success: true, 
        processed: 0,
        message: 'No stocks need technicals update'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const BATCH_SIZE = 20;
    let successCount = 0;
    let errorCount = 0;
    const updates: any[] = [];

    for (let i = 0; i < stocks.length; i += BATCH_SIZE) {
      const batch = stocks.slice(i, i + BATCH_SIZE);
      
      const promises = batch.map(async (stock) => {
        try {
          // Fetch 50-day historical data from Polygon
          const to = new Date().toISOString().split('T')[0];
          const from = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
          
          const url = `https://api.polygon.io/v2/aggs/ticker/${stock.symbol}/range/1/day/${from}/${to}?adjusted=true&sort=asc&apiKey=${polygonKey}`;
          const response = await fetch(url);
          
          if (!response.ok) {
            console.warn(`⚠️ Failed to fetch history for ${stock.symbol}: ${response.status}`);
            return null;
          }

          const data = await response.json();
          
          if (!data.results || data.results.length < 20) {
            return null;
          }

          const closePrices = data.results.map((r: any) => r.c);
          const currentPrice = stock.price_usd || closePrices[closePrices.length - 1];

          // Calculate all technicals
          const rsi14 = calculateRSI(closePrices, 14);
          const sma20 = calculateSMA(closePrices, 20);
          const sma50 = calculateSMA(closePrices, 50);
          const sma200 = calculateSMA(closePrices, 200);
          const macdData = calculateMACD(closePrices);
          const technicalSignal = determineTechnicalSignal(rsi14, macdData, currentPrice, sma20, sma50);

          return {
            symbol: stock.symbol,
            rsi_14: rsi14 ? Math.round(rsi14 * 100) / 100 : null,
            sma_20: sma20 ? Math.round(sma20 * 100) / 100 : null,
            sma_50: sma50 ? Math.round(sma50 * 100) / 100 : null,
            sma_200: sma200 ? Math.round(sma200 * 100) / 100 : null,
            macd_line: macdData ? Math.round(macdData.macd * 10000) / 10000 : null,
            macd_signal: macdData ? Math.round(macdData.signal * 10000) / 10000 : null,
            technical_signal: technicalSignal,
            technicals_updated_at: new Date().toISOString(),
          };
        } catch (error) {
          console.error(`❌ Error processing ${stock.symbol}:`, error);
          return null;
        }
      });

      const results = await Promise.all(promises);
      
      for (const result of results) {
        if (result) {
          updates.push(result);
          successCount++;
        } else {
          errorCount++;
        }
      }

      // Small delay between batches
      if (i + BATCH_SIZE < stocks.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    // Batch update stock_cards with technicals
    if (updates.length > 0) {
      for (let i = 0; i < updates.length; i += 100) {
        const batch = updates.slice(i, i + 100);
        
        for (const update of batch) {
          const { error: updateError } = await supabase
            .from('stock_cards')
            .update({
              rsi_14: update.rsi_14,
              sma_20: update.sma_20,
              sma_50: update.sma_50,
              sma_200: update.sma_200,
              macd_line: update.macd_line,
              macd_signal: update.macd_signal,
              technical_signal: update.technical_signal,
              technicals_updated_at: update.technicals_updated_at,
            })
            .eq('symbol', update.symbol);

          if (updateError) {
            console.error(`❌ Update error for ${update.symbol}:`, updateError.message);
          }
        }
      }
      
      console.log(`✅ Updated technicals for ${updates.length} stocks`);
    }

    const duration = Date.now() - startTime;
    console.log(`🏁 sync-stock-cards-technicals complete: ${successCount} processed, ${errorCount} errors in ${duration}ms`);

    // Log API call
    try {
      await supabase.from('external_api_calls').insert({
        api_name: 'polygon',
        function_name: 'sync-stock-cards-technicals',
        call_count: successCount,
        success: true,
      });
    } catch (e) {
      // Ignore logging errors
    }

    return new Response(JSON.stringify({
      success: true,
      stocks_processed: successCount,
      technicals_updated: updates.length,
      errors: errorCount,
      duration_ms: duration,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ sync-stock-cards-technicals error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
