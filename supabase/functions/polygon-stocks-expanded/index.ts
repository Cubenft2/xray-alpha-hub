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

    // Fetch all stock tickers in a single snapshot API call for real-time prices
    try {
      const tickersList = stockTickers.map(s => s.ticker).join(',');
      const url = `https://api.polygon.io/v2/snapshot/locale/us/markets/stocks/tickers?tickers=${tickersList}&apiKey=${polygonApiKey}`;
      
      console.log(`📊 Fetching snapshot data for ${stockTickers.length} tickers...`);
      const response = await fetch(url);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ Snapshot API failed:`, response.status, errorText);
        throw new Error(`Snapshot API returned ${response.status}`);
      }

      const data = await response.json();
      
      if (data.tickers && data.tickers.length > 0) {
        for (const tickerData of data.tickers) {
          const stockInfo = stockTickers.find(s => s.ticker === tickerData.ticker);
          if (!stockInfo) continue;
          
          // Use current day's data for intraday price
          const currentPrice = tickerData.day?.c || tickerData.lastTrade?.p;
          const prevClose = tickerData.prevDay?.c;
          
          if (currentPrice && prevClose) {
            const change = currentPrice - prevClose;
            const changePercent = (change / prevClose) * 100;
            
            results.push({
              ticker: stockInfo.ticker,
              name: stockInfo.name,
              price: currentPrice,
              change: change,
              changePercent: changePercent,
              open: tickerData.day?.o || prevClose,
              high: tickerData.day?.h || currentPrice,
              low: tickerData.day?.l || currentPrice,
              close: currentPrice,
              volume: tickerData.day?.v || 0,
              timestamp: tickerData.updated || Date.now()
            });
            
            console.log(`✅ ${stockInfo.ticker}: $${currentPrice.toFixed(2)} (${changePercent > 0 ? '+' : ''}${changePercent.toFixed(2)}%)`);
          } else {
            console.warn(`⚠️ Incomplete data for ${stockInfo.ticker}`);
            errors.push(`${stockInfo.ticker}: Missing price data`);
          }
        }
      } else {
        console.warn('⚠️ No tickers data in snapshot response');
        errors.push('No data available from snapshot API');
      }
      
    } catch (error) {
      console.error(`❌ Error fetching snapshot:`, error);
      errors.push(`Snapshot fetch error: ${error.message}`);
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
