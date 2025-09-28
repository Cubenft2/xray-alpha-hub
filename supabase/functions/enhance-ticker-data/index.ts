import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const coingeckoApiKey = Deno.env.get('COINGECKO_API_KEY')!;

interface TickerData {
  symbol: string;
  name: string;
  price: number | null;
  change_24h: number | null;
  isStock: boolean;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { content } = await req.json();
    
    console.log('🔍 Analyzing content for ticker mentions...');
    
    // Extract all ticker patterns from content - looking for "Name (SYMBOL)" format
    const tickerRegex = /([A-Za-z0-9\s&.-]+)\s*\(([A-Z0-9]{2,10})\)/g;
    const matches = [...content.matchAll(tickerRegex)];
    
    if (matches.length === 0) {
      console.log('⚠️ No ticker patterns found in content');
      return new Response(JSON.stringify({ 
        enhancedContent: content,
        tickersFound: []
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const uniqueTickers = new Map<string, { name: string, symbol: string }>();
    matches.forEach(match => {
      const name = match[1].trim();
      const symbol = match[2].toUpperCase();
      uniqueTickers.set(symbol, { name, symbol });
    });

    console.log(`📊 Found ${uniqueTickers.size} unique tickers:`, Array.from(uniqueTickers.keys()));

    // Fetch price data for crypto tickers
    const tickerData = new Map<string, TickerData>();
    const cryptoSymbols = Array.from(uniqueTickers.values());
    
    if (cryptoSymbols.length > 0) {
      try {
        // Try to fetch crypto data for all symbols
        const symbolList = cryptoSymbols.map(t => t.symbol.toLowerCase()).join(',');
        console.log(`🔄 Fetching crypto data for: ${symbolList}`);
        
        const cryptoResponse = await fetch(
          `https://api.coingecko.com/api/v3/simple/price?ids=${symbolList}&vs_currencies=usd&include_24hr_change=true&x_cg_demo_api_key=${coingeckoApiKey}`
        );

        if (cryptoResponse.ok) {
          const cryptoData = await cryptoResponse.json();
          console.log('✅ Crypto price data fetched successfully');
          
          // Map the price data back to symbols
          Object.entries(cryptoData).forEach(([id, data]: [string, any]) => {
            const ticker = cryptoSymbols.find(t => t.symbol.toLowerCase() === id);
            if (ticker) {
              tickerData.set(ticker.symbol, {
                symbol: ticker.symbol,
                name: ticker.name,
                price: data.usd || null,
                change_24h: data.usd_24h_change || null,
                isStock: false
              });
            }
          });
        } else {
          console.log('⚠️ Primary crypto API failed, trying alternative approach...');
          
          // Fallback: Try symbol-based search for major cryptos
          const majorCryptos = ['BTC', 'ETH', 'SOL', 'ADA', 'DOT', 'MATIC', 'AVAX', 'LINK', 'UNI', 'LTC', 'XRP', 'DOGE'];
          const symbolsToFetch = cryptoSymbols.filter(t => majorCryptos.includes(t.symbol));
          
          if (symbolsToFetch.length > 0) {
            const fallbackIds = symbolsToFetch.map(t => {
              const idMap: {[key: string]: string} = {
                'BTC': 'bitcoin',
                'ETH': 'ethereum', 
                'SOL': 'solana',
                'ADA': 'cardano',
                'DOT': 'polkadot',
                'MATIC': 'polygon',
                'AVAX': 'avalanche-2',
                'LINK': 'chainlink',
                'UNI': 'uniswap',
                'LTC': 'litecoin',
                'XRP': 'ripple',
                'DOGE': 'dogecoin'
              };
              return idMap[t.symbol];
            }).filter(Boolean).join(',');
            
            const fallbackResponse = await fetch(
              `https://api.coingecko.com/api/v3/simple/price?ids=${fallbackIds}&vs_currencies=usd&include_24hr_change=true&x_cg_demo_api_key=${coingeckoApiKey}`
            );
            
            if (fallbackResponse.ok) {
              const fallbackData = await fallbackResponse.json();
              console.log('✅ Fallback crypto data fetched successfully');
              
              const idToSymbol: {[key: string]: string} = {
                'bitcoin': 'BTC',
                'ethereum': 'ETH',
                'solana': 'SOL',
                'cardano': 'ADA',
                'polkadot': 'DOT',  
                'polygon': 'MATIC',
                'avalanche-2': 'AVAX',
                'chainlink': 'LINK',
                'uniswap': 'UNI',
                'litecoin': 'LTC',
                'ripple': 'XRP',
                'dogecoin': 'DOGE'
              };
              
              Object.entries(fallbackData).forEach(([id, data]: [string, any]) => {
                const symbol = idToSymbol[id];
                const ticker = uniqueTickers.get(symbol);
                if (ticker) {
                  tickerData.set(symbol, {
                    symbol,
                    name: ticker.name,
                    price: data.usd || null,
                    change_24h: data.usd_24h_change || null,
                    isStock: false
                  });
                }
              });
            }
          }
        }
      } catch (err) {
        console.error('❌ Error fetching crypto data:', err);
      }
    }

    // Mark remaining tickers as potential stocks (no price data for now)
    uniqueTickers.forEach((ticker, symbol) => {
      if (!tickerData.has(symbol)) {
        tickerData.set(symbol, {
          symbol,
          name: ticker.name,
          price: null,
          change_24h: null,
          isStock: true
        });
      }
    });

    console.log(`💾 Enhanced ticker data for ${tickerData.size} tickers`);

    return new Response(JSON.stringify({ 
      success: true,
      tickersFound: Array.from(tickerData.values()),
      enhancedTickerData: Object.fromEntries(tickerData)
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('💥 Ticker enhancement failed:', error);
    
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      success: false,
      tickersFound: []
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});