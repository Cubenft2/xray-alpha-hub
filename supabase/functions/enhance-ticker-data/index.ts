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
        console.log(`🔄 Fetching comprehensive exchange data...`);
        
        // First, try to get exchange aggregated data
        const supabase = createClient(supabaseUrl, supabaseServiceKey);
        const symbols = cryptoSymbols.map(t => t.symbol);
        
        const exchangeResponse = await supabase.functions.invoke('exchange-data-aggregator', {
          body: { symbols }
        });
        
        if (exchangeResponse.data?.success && exchangeResponse.data.data?.length > 0) {
          console.log('✅ Exchange aggregated data fetched successfully');
          
          exchangeResponse.data.data.forEach((tokenData: any) => {
            const ticker = uniqueTickers.get(tokenData.symbol);
            if (ticker) {
              tickerData.set(tokenData.symbol, {
                symbol: tokenData.symbol,
                name: ticker.name,
                price: tokenData.current_price || null,
                change_24h: tokenData.weighted_change_24h || null,
                isStock: false
              });
            }
          });
        }
        
        // For any remaining symbols, try CoinGecko fallback
        const remainingSymbols = cryptoSymbols.filter(t => !tickerData.has(t.symbol));
        
        if (remainingSymbols.length > 0) {
          console.log(`🔄 Fetching CoinGecko data for remaining symbols: ${remainingSymbols.map(t => t.symbol).join(', ')}`);
          
          // Try to fetch crypto data for remaining symbols using symbol search
          for (const ticker of remainingSymbols) {
            try {
              // Search for the coin first to get its ID
              const searchResponse = await fetch(
                `https://api.coingecko.com/api/v3/search?query=${ticker.symbol}`,
                {
                  headers: {
                    'x-cg-pro-api-key': coingeckoApiKey,
                    'accept': 'application/json'
                  }
                }
              );
              
              if (searchResponse.ok) {
                const searchData = await searchResponse.json();
                const coin = searchData.coins?.find((c: any) => 
                  c.symbol.toLowerCase() === ticker.symbol.toLowerCase()
                );
                
                if (coin) {
                  // Get market data using coin ID
                  const marketResponse = await fetch(
                    `https://api.coingecko.com/api/v3/simple/price?ids=${coin.id}&vs_currencies=usd&include_24hr_change=true`,
                    {
                      headers: {
                        'x-cg-pro-api-key': coingeckoApiKey,
                        'accept': 'application/json'
                      }
                    }
                  );
                  
                  if (marketResponse.ok) {
                    const marketData = await marketResponse.json();
                    const coinData = marketData[coin.id];
                    
                    if (coinData) {
                      tickerData.set(ticker.symbol, {
                        symbol: ticker.symbol,
                        name: ticker.name,
                        price: coinData.usd || null,
                        change_24h: coinData.usd_24h_change || null,
                        isStock: false
                      });
                      console.log(`✅ CoinGecko data found for ${ticker.symbol}`);
                    }
                  }
                }
              }
            } catch (err) {
              console.error(`❌ Error fetching CoinGecko data for ${ticker.symbol}:`, err);
            }
            
            // Add delay to respect rate limits
            await new Promise(resolve => setTimeout(resolve, 200));
          }
        }
        
      } catch (err) {
        console.error('❌ Error fetching exchange data:', err);
        
        // Ultimate fallback: Try CoinGecko for major cryptos
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
          
          try {
            const fallbackResponse = await fetch(
              `https://api.coingecko.com/api/v3/simple/price?ids=${fallbackIds}&vs_currencies=usd&include_24hr_change=true`,
              {
                headers: {
                  'x-cg-pro-api-key': coingeckoApiKey,
                  'accept': 'application/json'
                }
              }
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
                if (ticker && !tickerData.has(symbol)) {
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
          } catch (fallbackErr) {
            console.error('❌ Fallback CoinGecko request failed:', fallbackErr);
          }
        }
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