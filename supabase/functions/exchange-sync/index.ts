import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface BinanceSymbol {
  symbol: string;
  baseAsset: string;
  quoteAsset: string;
  status: string;
}

interface CoinbaseProduct {
  id: string;
  base_currency: string;
  quote_currency: string;
  status: string;
}

interface BybitSymbol {
  symbol: string;
  baseCoin: string;
  quoteCoin: string;
  status: string;
}

interface MEXCSymbol {
  symbol: string;
  baseAsset: string;
  quoteAsset: string;
  status: string;
}

interface GateIOPair {
  id: string;
  base: string;
  quote: string;
  trade_status: string;
}

interface KrakenPair {
  altname: string;
  wsname: string;
  base: string;
  quote: string;
  status: string;
}

interface KuCoinSymbol {
  symbol: string;
  baseCurrency: string;
  quoteCurrency: string;
  enableTrading: boolean;
}

interface OKXInstrument {
  instId: string;
  baseCcy: string;
  quoteCcy: string;
  state: string;
}

interface BitgetProduct {
  symbol: string;
  baseCoin: string;
  quoteCoin: string;
  status: string;
}

interface HTXSymbol {
  symbol: string;
  'base-currency': string;
  'quote-currency': string;
  state: string;
}

interface CoinGeckoTicker {
  base: string;
  target: string;
  market?: { name?: string };
}

// Regional endpoints for geo-blocked exchanges
const BINANCE_ENDPOINTS = [
  'https://api.binance.com',
  'https://api1.binance.com',
  'https://api2.binance.com',
  'https://api3.binance.com',
  'https://api4.binance.com',
];

const BYBIT_ENDPOINTS = [
  'https://api.bybit.com',
  'https://api.bytick.com',
  'https://api.bybit.nl',
];

// Helper: fetch with timeout and retry
async function fetchWithTimeout(
  url: string, 
  timeoutMs = 8000, 
  retries = 1,
  options: RequestInit = {}
): Promise<Response> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
      const response = await fetch(url, { 
        ...options,
        signal: controller.signal 
      });
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      if (attempt === retries) throw error;
      console.log(`Retry ${attempt + 1} for ${url}`);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  throw new Error('Fetch failed after retries');
}

// Helper: try multiple endpoints until one works
async function fetchWithEndpointFallback(
  endpoints: string[],
  path: string,
  timeoutMs = 8000
): Promise<{ response: Response; endpoint: string } | null> {
  for (const endpoint of endpoints) {
    try {
      const url = `${endpoint}${path}`;
      const response = await fetchWithTimeout(url, timeoutMs, 0);
      if (response.ok) {
        return { response, endpoint };
      }
      console.log(`⚠️ ${endpoint} returned ${response.status}, trying next...`);
    } catch (error) {
      console.log(`⚠️ ${endpoint} failed: ${error.message}, trying next...`);
    }
  }
  return null;
}

// Helper: fetch CoinGecko tickers with pagination
async function fetchCoinGeckoTickers(exchangeId: string, cgApiKey?: string): Promise<any[]> {
  const allTickers: any[] = [];
  let page = 1;
  const baseUrl = cgApiKey 
    ? `https://pro-api.coingecko.com/api/v3/exchanges/${exchangeId}/tickers`
    : `https://api.coingecko.com/api/v3/exchanges/${exchangeId}/tickers`;
  
  while (true) {
    const url = `${baseUrl}?page=${page}`;
    // FIX: Actually pass the API key headers to fetch
    const fetchOptions: RequestInit = cgApiKey 
      ? { headers: { 'x-cg-pro-api-key': cgApiKey } }
      : {};
    const response = await fetchWithTimeout(url, 8000, 1, fetchOptions);
    
    if (!response.ok) {
      console.error(`CoinGecko API error for ${exchangeId} page ${page}: ${response.status}`);
      break;
    }
    
    const data = await response.json();
    const tickers = data.tickers || [];
    
    if (tickers.length === 0) break;
    
    allTickers.push(...tickers);
    page++;
    
    // Rate limit protection
    await new Promise(resolve => setTimeout(resolve, cgApiKey ? 100 : 1000));
    
    // Safety: max 10 pages
    if (page > 10) break;
  }
  
  return allTickers;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    const cronSecret = Deno.env.get('CRON_SECRET');

    // Check authentication - allow cron secret or any request (JWT verification disabled in config)
    // Since verify_jwt = false, this function can be called from admin panel directly
    // The admin panel itself is protected by ProtectedRoute which requires admin role
    const cronSecretHeader = req.headers.get('x-cron-secret');
    const isCronJob = cronSecret && cronSecretHeader === cronSecret;
    
    console.log(isCronJob ? '⏰ Cron job request' : '👤 Admin panel request');
    
    console.log(isCronJob ? '⏰ Starting exchange sync (cron job)...' : '👤 Starting exchange sync (admin request)...');

    const cgApiKey = Deno.env.get('COINGECKO_API_KEY');

    const results = {
      binance: { synced: 0, active: 0, fallback: false },
      binance_us: { synced: 0, active: 0 },
      coinbase: { synced: 0, active: 0 },
      bybit: { synced: 0, active: 0, fallback: false },
      mexc: { synced: 0, active: 0 },
      gateio: { synced: 0, active: 0 },
      kraken: { synced: 0, active: 0 },
      kucoin: { synced: 0, active: 0 },
      okx: { synced: 0, active: 0 },
      bitget: { synced: 0, active: 0 },
      htx: { synced: 0, active: 0 },
    };

    // Sync Binance - try multiple endpoints to bypass geo-blocking
    try {
      const startTime = Date.now();
      console.log('🔄 Fetching Binance data (trying multiple endpoints)...');
      
      // Try all Binance endpoints first
      const binanceResult = await fetchWithEndpointFallback(BINANCE_ENDPOINTS, '/api/v3/exchangeInfo');
      let binanceResponse: Response | null = binanceResult?.response || null;
      let exchangeName = 'binance';
      let usedFallback = false;
      
      if (binanceResult) {
        console.log(`✅ Binance API success via ${binanceResult.endpoint} (${Date.now() - startTime}ms)`);
      } else {
        console.log('⚠️ All Binance.com endpoints blocked, trying Binance.US...');
        binanceResponse = await fetchWithTimeout('https://api.binance.us/api/v3/exchangeInfo');
        if (binanceResponse.ok) {
          exchangeName = 'binance_us';
          console.log(`✅ Binance.US API responded: ${binanceResponse.status} (${Date.now() - startTime}ms)`);
        }
      }
      
      // If both failed, try CoinGecko fallback
      if (!binanceResponse.ok) {
        console.log('⚠️ Direct API failed, using CoinGecko fallback for Binance...');
        usedFallback = true;
        const tickers = await fetchCoinGeckoTickers('binance', cgApiKey);
        console.log(`✅ CoinGecko: Found ${tickers.length} Binance tickers`);
        
        const binanceRecords = tickers.map((t: CoinGeckoTicker) => ({
          exchange: 'binance',
          symbol: `${t.base}${t.target}`,
          base_asset: t.base,
          quote_asset: t.target,
          is_active: true,
          synced_at: new Date().toISOString(),
        }));
        
        const batchSize = 500;
        let successfulBatches = 0;
        for (let i = 0; i < binanceRecords.length; i += batchSize) {
          const batch = binanceRecords.slice(i, i + batchSize);
          const { error } = await supabase
            .from('exchange_pairs')
            .upsert(batch, { 
              onConflict: 'exchange,symbol',
              ignoreDuplicates: false 
            });
          
          if (error) {
            console.error(`❌ Error upserting Binance CG batch ${i}-${i+batchSize}:`, error.message);
          } else {
            successfulBatches++;
          }
        }
        
        results.binance.synced = binanceRecords.length;
        results.binance.active = binanceRecords.length;
        results.binance.fallback = true;
        console.log(`✅ Binance (CoinGecko fallback) complete: ${results.binance.synced} pairs, ${successfulBatches} batches (${Date.now() - startTime}ms)`);
      } else {
        // Direct API success
        const binanceData = await binanceResponse.json();
        const symbols: BinanceSymbol[] = binanceData.symbols || [];
        console.log(`✅ ${exchangeName}: Found ${symbols.length} symbols`);
        
        const binanceRecords = symbols.map(s => ({
          exchange: exchangeName,
          symbol: s.symbol,
          base_asset: s.baseAsset,
          quote_asset: s.quoteAsset,
          is_active: s.status === 'TRADING',
          synced_at: new Date().toISOString(),
        }));

        const batchSize = 500;
        let successfulBatches = 0;
        for (let i = 0; i < binanceRecords.length; i += batchSize) {
          const batch = binanceRecords.slice(i, i + batchSize);
          const { error } = await supabase
            .from('exchange_pairs')
            .upsert(batch, { 
              onConflict: 'exchange,symbol',
              ignoreDuplicates: false 
            });
          
          if (error) {
            console.error(`❌ Error upserting ${exchangeName} batch ${i}-${i+batchSize}:`, error.message);
          } else {
            successfulBatches++;
          }
        }

        if (exchangeName === 'binance_us') {
          results.binance_us.synced = binanceRecords.length;
          results.binance_us.active = binanceRecords.filter(r => r.is_active).length;
          console.log(`✅ Binance.US complete: ${results.binance_us.synced} pairs, ${results.binance_us.active} active, ${successfulBatches} batches (${Date.now() - startTime}ms)`);
        } else {
          results.binance.synced = binanceRecords.length;
          results.binance.active = binanceRecords.filter(r => r.is_active).length;
          console.log(`✅ Binance complete: ${results.binance.synced} pairs, ${results.binance.active} active, ${successfulBatches} batches (${Date.now() - startTime}ms)`);
        }
      }
    } catch (error) {
      console.error('❌ Error syncing Binance:', {
        message: error.message,
        stack: error.stack,
        name: error.name
      });
    }

    // Sync Coinbase (optional)
    try {
      const coinbaseResponse = await fetch('https://api.exchange.coinbase.com/products');
      if (coinbaseResponse.ok) {
        const products: CoinbaseProduct[] = await coinbaseResponse.json();
        
        const coinbaseRecords = products.map(p => ({
          exchange: 'coinbase',
          symbol: p.id,
          base_asset: p.base_currency,
          quote_asset: p.quote_currency,
          is_active: p.status === 'online',
          synced_at: new Date().toISOString(),
        }));

        // Batch upsert
        const batchSize = 500;
        for (let i = 0; i < coinbaseRecords.length; i += batchSize) {
          const batch = coinbaseRecords.slice(i, i + batchSize);
          const { error } = await supabase
            .from('exchange_pairs')
            .upsert(batch, { 
              onConflict: 'exchange,symbol',
              ignoreDuplicates: false 
            });
          
          if (error) {
            console.error('Error upserting Coinbase batch:', error);
          }
        }

        results.coinbase.synced = coinbaseRecords.length;
        results.coinbase.active = coinbaseRecords.filter(r => r.is_active).length;
        console.log(`Coinbase: ${results.coinbase.synced} pairs, ${results.coinbase.active} active`);
      }
    } catch (error) {
      console.error('Error syncing Coinbase:', error);
    }

    // Sync Bybit - try multiple endpoints to bypass geo-blocking
    try {
      const startTime = Date.now();
      console.log('🔄 Fetching Bybit data (trying multiple endpoints)...');
      
      // Try all Bybit endpoints first
      const bybitResult = await fetchWithEndpointFallback(BYBIT_ENDPOINTS, '/v5/market/instruments-info?category=spot');
      let bybitResponse: Response | null = bybitResult?.response || null;
      
      if (bybitResult) {
        console.log(`✅ Bybit API success via ${bybitResult.endpoint} (${Date.now() - startTime}ms)`);
      }
      
      if (!bybitResult) {
        console.log('⚠️ All Bybit endpoints blocked, using CoinGecko fallback...');
        console.log('⚠️ Bybit.com blocked, using CoinGecko fallback...');
        results.bybit.fallback = true;
        
        const tickers = await fetchCoinGeckoTickers('bybit_spot', cgApiKey);
        console.log(`✅ CoinGecko: Found ${tickers.length} Bybit tickers`);
        
        const bybitRecords = tickers.map((t: CoinGeckoTicker) => ({
          exchange: 'bybit',
          symbol: `${t.base}${t.target}`,
          base_asset: t.base,
          quote_asset: t.target,
          is_active: true,
          synced_at: new Date().toISOString(),
        }));
        
        const batchSize = 500;
        let successfulBatches = 0;
        for (let i = 0; i < bybitRecords.length; i += batchSize) {
          const batch = bybitRecords.slice(i, i + batchSize);
          const { error } = await supabase
            .from('exchange_pairs')
            .upsert(batch, { 
              onConflict: 'exchange,symbol',
              ignoreDuplicates: false 
            });
          
          if (error) {
            console.error(`❌ Error upserting Bybit CG batch ${i}-${i+batchSize}:`, error.message);
          } else {
            successfulBatches++;
          }
        }
        
        results.bybit.synced = bybitRecords.length;
        results.bybit.active = bybitRecords.length;
        console.log(`✅ Bybit (CoinGecko fallback) complete: ${results.bybit.synced} pairs, ${successfulBatches} batches (${Date.now() - startTime}ms)`);
      } else if (bybitResult && bybitResponse) {
        const bybitData = await bybitResponse.json();
        const symbols: BybitSymbol[] = bybitData?.result?.list || [];
        console.log(`✅ Bybit: Found ${symbols.length} symbols`);
        
        const bybitRecords = symbols.map(s => ({
          exchange: 'bybit',
          symbol: s.symbol,
          base_asset: s.baseCoin,
          quote_asset: s.quoteCoin,
          is_active: s.status === 'Trading',
          synced_at: new Date().toISOString(),
        }));

        const batchSize = 500;
        let successfulBatches = 0;
        for (let i = 0; i < bybitRecords.length; i += batchSize) {
          const batch = bybitRecords.slice(i, i + batchSize);
          const { error } = await supabase
            .from('exchange_pairs')
            .upsert(batch, { 
              onConflict: 'exchange,symbol',
              ignoreDuplicates: false 
            });
          
          if (error) {
            console.error(`❌ Error upserting Bybit batch ${i}-${i+batchSize}:`, error.message);
          } else {
            successfulBatches++;
          }
        }

        results.bybit.synced = bybitRecords.length;
        results.bybit.active = bybitRecords.filter(r => r.is_active).length;
        console.log(`✅ Bybit complete: ${results.bybit.synced} pairs, ${results.bybit.active} active, ${successfulBatches} batches (${Date.now() - startTime}ms)`);
      } else {
        console.error(`❌ Bybit API error: ${bybitResponse.status} ${bybitResponse.statusText}`);
        const errorText = await bybitResponse.text();
        console.error('Response body:', errorText);
      }
    } catch (error) {
      console.error('❌ Error syncing Bybit:', {
        message: error.message,
        stack: error.stack,
        name: error.name
      });
    }

    // Sync MEXC
    try {
      const mexcResponse = await fetch('https://api.mexc.com/api/v3/exchangeInfo');
      if (mexcResponse.ok) {
        const mexcData = await mexcResponse.json();
        const symbols: MEXCSymbol[] = mexcData?.symbols || [];
        
        const mexcRecords = symbols.map(s => ({
          exchange: 'mexc',
          symbol: s.symbol,
          base_asset: s.baseAsset,
          quote_asset: s.quoteAsset,
          is_active: ['ENABLED', 'TRADING'].includes(s.status?.toUpperCase()),
          synced_at: new Date().toISOString(),
        }));

        const batchSize = 500;
        for (let i = 0; i < mexcRecords.length; i += batchSize) {
          const batch = mexcRecords.slice(i, i + batchSize);
          const { error } = await supabase
            .from('exchange_pairs')
            .upsert(batch, { 
              onConflict: 'exchange,symbol',
              ignoreDuplicates: false 
            });
          
          if (error) {
            console.error('Error upserting MEXC batch:', error);
          }
        }

        results.mexc.synced = mexcRecords.length;
        results.mexc.active = mexcRecords.filter(r => r.is_active).length;
        console.log(`MEXC: ${results.mexc.synced} pairs, ${results.mexc.active} active`);
      }
    } catch (error) {
      console.error('Error syncing MEXC:', error);
    }

    // Sync Gate.io
    try {
      const gateioResponse = await fetch('https://api.gateio.ws/api/v4/spot/currency_pairs');
      if (gateioResponse.ok) {
        const pairs: GateIOPair[] = await gateioResponse.json();
        
        const gateioRecords = pairs.map(p => ({
          exchange: 'gateio',
          symbol: p.id,
          base_asset: p.base,
          quote_asset: p.quote,
          is_active: p.trade_status === 'tradable',
          synced_at: new Date().toISOString(),
        }));

        const batchSize = 500;
        for (let i = 0; i < gateioRecords.length; i += batchSize) {
          const batch = gateioRecords.slice(i, i + batchSize);
          const { error } = await supabase
            .from('exchange_pairs')
            .upsert(batch, { 
              onConflict: 'exchange,symbol',
              ignoreDuplicates: false 
            });
          
          if (error) {
            console.error('Error upserting Gate.io batch:', error);
          }
        }

        results.gateio.synced = gateioRecords.length;
        results.gateio.active = gateioRecords.filter(r => r.is_active).length;
        console.log(`Gate.io: ${results.gateio.synced} pairs, ${results.gateio.active} active`);
      }
    } catch (error) {
      console.error('Error syncing Gate.io:', error);
    }

    // Sync Kraken
    try {
      const krakenResponse = await fetch('https://api.kraken.com/0/public/AssetPairs');
      if (krakenResponse.ok) {
        const krakenData = await krakenResponse.json();
        const pairs = krakenData?.result || {};
        
        const krakenRecords = Object.entries(pairs).map(([key, p]: [string, any]) => ({
          exchange: 'kraken',
          symbol: p.wsname || p.altname || key,
          base_asset: p.base,
          quote_asset: p.quote,
          is_active: p.status === 'online',
          synced_at: new Date().toISOString(),
        }));

        const batchSize = 500;
        for (let i = 0; i < krakenRecords.length; i += batchSize) {
          const batch = krakenRecords.slice(i, i + batchSize);
          const { error } = await supabase
            .from('exchange_pairs')
            .upsert(batch, { 
              onConflict: 'exchange,symbol',
              ignoreDuplicates: false 
            });
          
          if (error) {
            console.error('Error upserting Kraken batch:', error);
          }
        }

        results.kraken.synced = krakenRecords.length;
        results.kraken.active = krakenRecords.filter(r => r.is_active).length;
        console.log(`Kraken: ${results.kraken.synced} pairs, ${results.kraken.active} active`);
      }
    } catch (error) {
      console.error('Error syncing Kraken:', error);
    }

    // Sync KuCoin
    try {
      const kucoinResponse = await fetch('https://api.kucoin.com/api/v1/symbols');
      if (kucoinResponse.ok) {
        const kucoinData = await kucoinResponse.json();
        const symbols: KuCoinSymbol[] = kucoinData?.data || [];
        
        const kucoinRecords = symbols.map(s => ({
          exchange: 'kucoin',
          symbol: s.symbol,
          base_asset: s.baseCurrency,
          quote_asset: s.quoteCurrency,
          is_active: s.enableTrading,
          synced_at: new Date().toISOString(),
        }));

        const batchSize = 500;
        for (let i = 0; i < kucoinRecords.length; i += batchSize) {
          const batch = kucoinRecords.slice(i, i + batchSize);
          const { error } = await supabase
            .from('exchange_pairs')
            .upsert(batch, { 
              onConflict: 'exchange,symbol',
              ignoreDuplicates: false 
            });
          
          if (error) {
            console.error('Error upserting KuCoin batch:', error);
          }
        }

        results.kucoin.synced = kucoinRecords.length;
        results.kucoin.active = kucoinRecords.filter(r => r.is_active).length;
        console.log(`KuCoin: ${results.kucoin.synced} pairs, ${results.kucoin.active} active`);
      }
    } catch (error) {
      console.error('Error syncing KuCoin:', error);
    }

    // Sync OKX
    try {
      const okxResponse = await fetch('https://www.okx.com/api/v5/public/instruments?instType=SPOT');
      if (okxResponse.ok) {
        const okxData = await okxResponse.json();
        const instruments: OKXInstrument[] = okxData?.data || [];
        
        const okxRecords = instruments.map(i => ({
          exchange: 'okx',
          symbol: i.instId,
          base_asset: i.baseCcy,
          quote_asset: i.quoteCcy,
          is_active: i.state === 'live',
          synced_at: new Date().toISOString(),
        }));

        const batchSize = 500;
        for (let i = 0; i < okxRecords.length; i += batchSize) {
          const batch = okxRecords.slice(i, i + batchSize);
          const { error } = await supabase
            .from('exchange_pairs')
            .upsert(batch, { 
              onConflict: 'exchange,symbol',
              ignoreDuplicates: false 
            });
          
          if (error) {
            console.error('Error upserting OKX batch:', error);
          }
        }

        results.okx.synced = okxRecords.length;
        results.okx.active = okxRecords.filter(r => r.is_active).length;
        console.log(`OKX: ${results.okx.synced} pairs, ${results.okx.active} active`);
      }
    } catch (error) {
      console.error('Error syncing OKX:', error);
    }

    // Sync Bitget
    try {
      const bitgetResponse = await fetch('https://api.bitget.com/api/spot/v1/public/products');
      if (bitgetResponse.ok) {
        const bitgetData = await bitgetResponse.json();
        const products: BitgetProduct[] = bitgetData?.data || [];
        
        const bitgetRecords = products.map(p => ({
          exchange: 'bitget',
          symbol: p.symbol,
          base_asset: p.baseCoin,
          quote_asset: p.quoteCoin,
          is_active: p.status === 'online',
          synced_at: new Date().toISOString(),
        }));

        const batchSize = 500;
        for (let i = 0; i < bitgetRecords.length; i += batchSize) {
          const batch = bitgetRecords.slice(i, i + batchSize);
          const { error } = await supabase
            .from('exchange_pairs')
            .upsert(batch, { 
              onConflict: 'exchange,symbol',
              ignoreDuplicates: false 
            });
          
          if (error) {
            console.error('Error upserting Bitget batch:', error);
          }
        }

        results.bitget.synced = bitgetRecords.length;
        results.bitget.active = bitgetRecords.filter(r => r.is_active).length;
        console.log(`Bitget: ${results.bitget.synced} pairs, ${results.bitget.active} active`);
      }
    } catch (error) {
      console.error('Error syncing Bitget:', error);
    }

    // Sync HTX (Huobi)
    try {
      const htxResponse = await fetch('https://api.huobi.pro/v1/common/symbols');
      if (htxResponse.ok) {
        const htxData = await htxResponse.json();
        const symbols: HTXSymbol[] = htxData?.data || [];
        
        const htxRecords = symbols.map(s => ({
          exchange: 'htx',
          symbol: s.symbol,
          base_asset: s['base-currency'],
          quote_asset: s['quote-currency'],
          is_active: s.state === 'online',
          synced_at: new Date().toISOString(),
        }));

        const batchSize = 500;
        for (let i = 0; i < htxRecords.length; i += batchSize) {
          const batch = htxRecords.slice(i, i + batchSize);
          const { error } = await supabase
            .from('exchange_pairs')
            .upsert(batch, { 
              onConflict: 'exchange,symbol',
              ignoreDuplicates: false 
            });
          
          if (error) {
            console.error('Error upserting HTX batch:', error);
          }
        }

        results.htx.synced = htxRecords.length;
        results.htx.active = htxRecords.filter(r => r.is_active).length;
        console.log(`HTX: ${results.htx.synced} pairs, ${results.htx.active} active`);
      }
    } catch (error) {
      console.error('Error syncing HTX:', error);
    }

    return new Response(
      JSON.stringify({
        success: true,
        results,
        timestamp: new Date().toISOString(),
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Error in exchange-sync:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        details: error.toString(),
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
