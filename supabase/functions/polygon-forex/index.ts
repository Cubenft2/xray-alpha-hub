import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ForexPairData {
  pair: string;
  price: number;
  change: number;
  changePercent: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  timestamp: number;
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

    const forexPairs = [
      { symbol: 'C:EURUSD', name: 'EUR/USD' },
      { symbol: 'C:GBPUSD', name: 'GBP/USD' },
      { symbol: 'C:USDJPY', name: 'USD/JPY' },
      { symbol: 'C:USDCNH', name: 'USD/CNH' },
      { symbol: 'C:AUDUSD', name: 'AUD/USD' },
    ];

    const results: ForexPairData[] = [];
    const errors: string[] = [];

    console.log(`📊 Fetching forex data for ${forexPairs.length} pairs...`);

    for (const pair of forexPairs) {
      try {
        // Use snapshot API for real-time forex rates
        const url = `https://api.polygon.io/v2/last/nbbo/${pair.symbol}?apiKey=${polygonApiKey}`;
        
        const response = await fetch(url);
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error(`❌ Failed to fetch ${pair.name}:`, response.status, errorText);
          errors.push(`${pair.name}: ${response.status}`);
          continue;
        }

        const data = await response.json();
        
        if (data.results) {
          const currentPrice = data.results.P; // Bid price
          
          // Get previous day's close for comparison
          const prevUrl = `https://api.polygon.io/v2/aggs/ticker/${pair.symbol}/prev?adjusted=true&apiKey=${polygonApiKey}`;
          const prevResponse = await fetch(prevUrl);
          
          let prevClose = currentPrice; // Fallback
          if (prevResponse.ok) {
            const prevData = await prevResponse.json();
            if (prevData.results && prevData.results.length > 0) {
              prevClose = prevData.results[0].c;
            }
          }
          
          const change = currentPrice - prevClose;
          const changePercent = (change / prevClose) * 100;
          
          results.push({
            pair: pair.name,
            price: currentPrice,
            change: change,
            changePercent: changePercent,
            open: prevClose,
            high: currentPrice,
            low: currentPrice,
            close: currentPrice,
            volume: 0,
            timestamp: data.results.t || Date.now()
          });
          
          console.log(`✅ ${pair.name}: ${currentPrice.toFixed(4)} (${changePercent > 0 ? '+' : ''}${changePercent.toFixed(2)}%)`);
        } else {
          console.warn(`⚠️ No data for ${pair.name}`);
          errors.push(`${pair.name}: No data available`);
        }
        
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        console.error(`❌ Error fetching ${pair.name}:`, error);
        errors.push(`${pair.name}: ${error.message}`);
      }
    }

    try {
      const dxyUrl = `https://api.polygon.io/v2/aggs/ticker/I:DXY/prev?adjusted=true&apiKey=${polygonApiKey}`;
      const dxyResponse = await fetch(dxyUrl);
      
      if (dxyResponse.ok) {
        const dxyData = await dxyResponse.json();
        if (dxyData.results && dxyData.results.length > 0) {
          const result = dxyData.results[0];
          const change = result.c - result.o;
          const changePercent = (change / result.o) * 100;
          
          results.push({
            pair: 'DXY',
            price: result.c,
            change: change,
            changePercent: changePercent,
            open: result.o,
            high: result.h,
            low: result.l,
            close: result.c,
            volume: result.v || 0,
            timestamp: result.t
          });
          
          console.log(`✅ DXY: ${result.c.toFixed(2)} (${changePercent > 0 ? '+' : ''}${changePercent.toFixed(2)}%)`);
        }
      }
    } catch (error) {
      console.log('ℹ️ DXY not available (expected on Currencies Starter plan)');
    }

    console.log(`\n✅ Successfully fetched ${results.length} forex pairs`);
    if (errors.length > 0) {
      console.warn(`⚠️ ${errors.length} errors encountered`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: results,
        errors: errors.length > 0 ? errors : undefined,
        timestamp: new Date().toISOString(),
        source: 'polygon-forex'
      }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    );

  } catch (error) {
    console.error('❌ Error in polygon-forex function:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false,
        error: 'Failed to fetch forex data', 
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
