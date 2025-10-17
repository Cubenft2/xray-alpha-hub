import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface StockData {
  ticker: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  timestamp: number;
  exchange?: string;
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

    const stockTickers = [
      { ticker: 'SPY', name: 'SPDR S&P 500 ETF' },
      { ticker: 'QQQ', name: 'Invesco QQQ ETF' },
      { ticker: 'DIA', name: 'SPDR Dow Jones ETF' },
      { ticker: 'IWM', name: 'iShares Russell 2000 ETF' },
      { ticker: 'COIN', name: 'Coinbase Global' },
      { ticker: 'MSTR', name: 'MicroStrategy' },
      { ticker: 'RIOT', name: 'Riot Platforms' },
      { ticker: 'MARA', name: 'Marathon Digital' },
      { ticker: 'CLSK', name: 'CleanSpark' },
      { ticker: 'HUT', name: 'Hut 8 Mining' },
      { ticker: 'NVDA', name: 'NVIDIA' },
      { ticker: 'AMD', name: 'Advanced Micro Devices' },
      { ticker: 'MSFT', name: 'Microsoft' },
      { ticker: 'GOOGL', name: 'Alphabet' },
      { ticker: 'META', name: 'Meta Platforms' },
      { ticker: 'AMZN', name: 'Amazon' },
      { ticker: 'AAPL', name: 'Apple' },
      { ticker: 'TSLA', name: 'Tesla' },
      { ticker: 'BITO', name: 'ProShares Bitcoin Strategy ETF' },
      { ticker: 'BITI', name: 'ProShares Short Bitcoin ETF' },
      { ticker: 'GBTC', name: 'Grayscale Bitcoin Trust' },
      { ticker: 'HOOD', name: 'Robinhood' },
      { ticker: 'SQ', name: 'Block (Square)' },
      { ticker: 'PYPL', name: 'PayPal' },
    ];

    const results: StockData[] = [];
    const errors: string[] = [];

    console.log(`📊 Fetching stock data for ${stockTickers.length} tickers...`);

    for (const stock of stockTickers) {
      try {
        const url = `https://api.polygon.io/v2/aggs/ticker/${stock.ticker}/prev?adjusted=true&apiKey=${polygonApiKey}`;
        
        const response = await fetch(url);
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error(`❌ Failed to fetch ${stock.ticker}:`, response.status, errorText);
          errors.push(`${stock.ticker}: ${response.status}`);
          continue;
        }

        const data = await response.json();
        
        if (data.results && data.results.length > 0) {
          const result = data.results[0];
          
          const change = result.c - result.o;
          const changePercent = (change / result.o) * 100;
          
          results.push({
            ticker: stock.ticker,
            name: stock.name,
            price: result.c,
            change: change,
            changePercent: changePercent,
            open: result.o,
            high: result.h,
            low: result.l,
            close: result.c,
            volume: result.v,
            timestamp: result.t
          });
          
          console.log(`✅ ${stock.ticker}: $${result.c.toFixed(2)} (${changePercent > 0 ? '+' : ''}${changePercent.toFixed(2)}%)`);
        } else {
          console.warn(`⚠️ No data for ${stock.ticker}`);
          errors.push(`${stock.ticker}: No data available`);
        }
        
        await new Promise(resolve => setTimeout(resolve, 50));
        
      } catch (error) {
        console.error(`❌ Error fetching ${stock.ticker}:`, error);
        errors.push(`${stock.ticker}: ${error.message}`);
      }
    }

    const sortedByChange = [...results].sort((a, b) => 
      Math.abs(b.changePercent) - Math.abs(a.changePercent)
    );

    console.log(`\n✅ Successfully fetched ${results.length}/${stockTickers.length} stocks`);
    console.log(`📈 Biggest mover: ${sortedByChange[0]?.ticker} (${sortedByChange[0]?.changePercent.toFixed(2)}%)`);
    
    if (errors.length > 0) {
      console.warn(`⚠️ ${errors.length} errors encountered`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: results,
        topMovers: sortedByChange.slice(0, 5),
        errors: errors.length > 0 ? errors : undefined,
        timestamp: new Date().toISOString(),
        source: 'polygon-stocks-expanded',
        count: results.length
      }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    );

  } catch (error) {
    console.error('❌ Error in polygon-stocks-expanded function:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false,
        error: 'Failed to fetch stock data', 
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
