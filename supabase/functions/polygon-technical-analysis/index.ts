import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TechnicalIndicators {
  symbol: string;
  rsi?: number;
  rsiSignal?: 'overbought' | 'oversold' | 'neutral';
  macd?: {
    value: number;
    signal: number;
    histogram: number;
    trend: 'bullish' | 'bearish' | 'neutral';
  };
  sma?: {
    sma20: number;
    sma50: number;
    sma200: number;
    goldenCross?: boolean;
    deathCross?: boolean;
  };
  ema?: {
    ema12: number;
    ema26: number;
  };
  timestamp: number;
}

function calculateRSI(prices: number[], period: number = 14): number {
  if (prices.length < period + 1) return 50;
  
  let gains = 0;
  let losses = 0;
  
  for (let i = 1; i <= period; i++) {
    const change = prices[i] - prices[i - 1];
    if (change > 0) gains += change;
    else losses += Math.abs(change);
  }
  
  let avgGain = gains / period;
  let avgLoss = losses / period;
  
  for (let i = period + 1; i < prices.length; i++) {
    const change = prices[i] - prices[i - 1];
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? Math.abs(change) : 0;
    
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
  }
  
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  const rsi = 100 - (100 / (1 + rs));
  
  return rsi;
}

function calculateSMA(prices: number[], period: number): number {
  if (prices.length < period) return prices[prices.length - 1] || 0;
  const relevantPrices = prices.slice(-period);
  const sum = relevantPrices.reduce((a, b) => a + b, 0);
  return sum / period;
}

function calculateEMA(prices: number[], period: number): number {
  if (prices.length < period) return calculateSMA(prices, prices.length);
  
  const k = 2 / (period + 1);
  let ema = calculateSMA(prices.slice(0, period), period);
  
  for (let i = period; i < prices.length; i++) {
    ema = (prices[i] * k) + (ema * (1 - k));
  }
  
  return ema;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const polygonApiKey = Deno.env.get('POLYGON_API_KEY');
    
    if (!polygonApiKey) {
      throw new Error('POLYGON_API_KEY not configured');
    }

    let symbols = ['X:BTCUSD', 'X:ETHUSD', 'SPY', 'QQQ'];
    
    try {
      const body = await req.json();
      if (body.symbols && Array.isArray(body.symbols)) {
        symbols = body.symbols;
      }
    } catch {
      // Use default symbols
    }

    const results: Record<string, TechnicalIndicators> = {};
    const errors: string[] = [];

    console.log(`📊 Calculating technical indicators for ${symbols.length} symbols...`);

    for (const symbol of symbols) {
      try {
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 60);
        
        const formatDate = (date: Date) => date.toISOString().split('T')[0];
        
        const url = `https://api.polygon.io/v2/aggs/ticker/${symbol}/range/1/day/${formatDate(startDate)}/${formatDate(endDate)}?adjusted=true&sort=asc&apiKey=${polygonApiKey}`;
        
        console.log(`📈 Fetching ${symbol}...`);
        const response = await fetch(url);
        
        if (!response.ok) {
          console.error(`❌ Failed to fetch ${symbol}:`, response.status);
          errors.push(`${symbol}: ${response.status}`);
          continue;
        }

        const data = await response.json();
        
        if (!data.results || data.results.length < 20) {
          console.warn(`⚠️ Insufficient data for ${symbol}`);
          errors.push(`${symbol}: Insufficient data`);
          continue;
        }

        const closePrices = data.results.map((r: any) => r.c);
        const currentPrice = closePrices[closePrices.length - 1];
        
        const rsi = calculateRSI(closePrices, 14);
        let rsiSignal: 'overbought' | 'oversold' | 'neutral' = 'neutral';
        if (rsi > 70) rsiSignal = 'overbought';
        else if (rsi < 30) rsiSignal = 'oversold';
        
        const sma20 = calculateSMA(closePrices, 20);
        const sma50 = calculateSMA(closePrices, 50);
        const sma200 = closePrices.length >= 200 ? calculateSMA(closePrices, 200) : null;
        
        const prevSma50 = closePrices.length >= 51 ? calculateSMA(closePrices.slice(0, -1), 50) : sma50;
        const prevSma200 = closePrices.length >= 201 ? calculateSMA(closePrices.slice(0, -1), 200) : sma200;
        
        let goldenCross = false;
        let deathCross = false;
        
        if (sma200 && prevSma200) {
          if (sma50 > sma200 && prevSma50 <= prevSma200) goldenCross = true;
          if (sma50 < sma200 && prevSma50 >= prevSma200) deathCross = true;
        }
        
        const ema12 = calculateEMA(closePrices, 12);
        const ema26 = calculateEMA(closePrices, 26);
        
        const macdLine = ema12 - ema26;
        const macdTrend = macdLine > 0 ? 'bullish' : macdLine < 0 ? 'bearish' : 'neutral';
        
        results[symbol] = {
          symbol,
          rsi: Math.round(rsi * 100) / 100,
          rsiSignal,
          macd: {
            value: Math.round(macdLine * 100) / 100,
            signal: 0,
            histogram: Math.round(macdLine * 100) / 100,
            trend: macdTrend
          },
          sma: {
            sma20: Math.round(sma20 * 100) / 100,
            sma50: Math.round(sma50 * 100) / 100,
            sma200: sma200 ? Math.round(sma200 * 100) / 100 : 0,
            goldenCross,
            deathCross
          },
          ema: {
            ema12: Math.round(ema12 * 100) / 100,
            ema26: Math.round(ema26 * 100) / 100
          },
          timestamp: Date.now()
        };
        
        console.log(`✅ ${symbol}: RSI=${rsi.toFixed(1)} (${rsiSignal}), MACD=${macdTrend}`);
        
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        console.error(`❌ Error processing ${symbol}:`, error);
        errors.push(`${symbol}: ${error.message}`);
      }
    }

    console.log(`\n✅ Calculated indicators for ${Object.keys(results).length} symbols`);
    if (errors.length > 0) {
      console.warn(`⚠️ ${errors.length} errors encountered`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        indicators: results,
        errors: errors.length > 0 ? errors : undefined,
        timestamp: new Date().toISOString(),
        source: 'polygon-technical-indicators'
      }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    );

  } catch (error) {
    console.error('❌ Error in technical indicators function:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false,
        error: 'Failed to calculate technical indicators', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { 
        status: 500, 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    );
  }
});
