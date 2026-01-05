import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CoinbaseProduct {
  id: string;
  base_currency: string;
  quote_currency: string;
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

// Helper: fetch CoinGecko tickers with pagination (PRIMARY source for geo-blocked exchanges)
async function fetchCoinGeckoTickers(exchangeId: string, cgApiKey?: string): Promise<CoinGeckoTicker[]> {
  const allTickers: CoinGeckoTicker[] = [];
  let page = 1;
  const baseUrl = cgApiKey 
    ? `https://pro-api.coingecko.com/api/v3/exchanges/${exchangeId}/tickers`
    : `https://api.coingecko.com/api/v3/exchanges/${exchangeId}/tickers`;
  
  console.log(`📡 CoinGecko: Fetching ${exchangeId} tickers (Pro API: ${!!cgApiKey})`);
  
  while (true) {
    const url = `${baseUrl}?page=${page}`;
    const fetchOptions: RequestInit = cgApiKey 
      ? { headers: { 'x-cg-pro-api-key': cgApiKey } }
      : {};
    
    try {
      const response = await fetchWithTimeout(url, 10000, 2, fetchOptions);
      
      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        console.error(`❌ CoinGecko API error for ${exchangeId} page ${page}: ${response.status} - ${errorText}`);
        break;
      }
      
      const data = await response.json();
      const tickers = data.tickers || [];
      
      if (tickers.length === 0) {
        console.log(`   Page ${page}: No more tickers (total: ${allTickers.length})`);
        break;
      }
      
      allTickers.push(...tickers);
      console.log(`   Page ${page}: +${tickers.length} tickers (total: ${allTickers.length})`);
      page++;
      
      // Rate limit protection - be more conservative
      await new Promise(resolve => setTimeout(resolve, cgApiKey ? 150 : 1500));
      
      // Safety: max 10 pages (should be enough for most exchanges)
      if (page > 10) {
        console.log(`   Reached max pages (10), stopping at ${allTickers.length} tickers`);
        break;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`❌ CoinGecko fetch error for ${exchangeId} page ${page}:`, message);
      break;
    }
  }
  
  return allTickers;
}

// Helper: sync exchange data from CoinGecko (for geo-blocked exchanges)
async function syncFromCoinGecko(
  supabase: any,
  exchangeName: string,
  coinGeckoExchangeId: string,
  cgApiKey?: string
): Promise<{ synced: number; active: number }> {
  const startTime = Date.now();
  console.log(`🔄 Fetching ${exchangeName} data via CoinGecko (primary - direct APIs geo-blocked)...`);
  
  const tickers = await fetchCoinGeckoTickers(coinGeckoExchangeId, cgApiKey);
  
  if (tickers.length === 0) {
    console.error(`❌ CoinGecko returned 0 tickers for ${exchangeName}`);
    return { synced: 0, active: 0 };
  }
  
  console.log(`✅ CoinGecko: Found ${tickers.length} ${exchangeName} tickers`);
  
  const records = tickers.map((t: CoinGeckoTicker) => ({
    exchange: exchangeName.toLowerCase(),
    symbol: `${t.base}${t.target}`,
    base_asset: t.base,
    quote_asset: t.target,
    is_active: true,
    synced_at: new Date().toISOString(),
  }));
  
  const batchSize = 500;
  let successfulBatches = 0;
  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize);
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
  
  console.log(`✅ ${exchangeName} complete: ${records.length} pairs, ${successfulBatches} batches (${Date.now() - startTime}ms)`);
  
  return { synced: records.length, active: records.length };
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

    const cronSecretHeader = req.headers.get('x-cron-secret');
    const isCronJob = cronSecret && cronSecretHeader === cronSecret;
    
    console.log(isCronJob ? '⏰ Starting exchange sync (cron job)...' : '👤 Starting exchange sync (admin request)...');

    const cgApiKey = Deno.env.get('COINGECKO_API_KEY');

    const results: Record<string, { synced: number; active: number; fallback?: boolean }> = {
      binance: { synced: 0, active: 0 },
      coinbase: { synced: 0, active: 0 },
      bybit: { synced: 0, active: 0 },
      mexc: { synced: 0, active: 0 },
      gateio: { synced: 0, active: 0 },
      kraken: { synced: 0, active: 0 },
      kucoin: { synced: 0, active: 0 },
      okx: { synced: 0, active: 0 },
      bitget: { synced: 0, active: 0 },
      htx: { synced: 0, active: 0 },
    };

    // ============================================
    // GEO-BLOCKED EXCHANGES - Use CoinGecko as PRIMARY
    // ============================================

    // Sync Binance via CoinGecko (direct API geo-blocked from Supabase servers)
    try {
      const binanceResult = await syncFromCoinGecko(supabase, 'binance', 'binance', cgApiKey);
      results.binance = binanceResult;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('❌ Error syncing Binance:', message);
    }

    // Sync Bybit via CoinGecko (direct API geo-blocked from Supabase servers)
    try {
      const bybitResult = await syncFromCoinGecko(supabase, 'bybit', 'bybit_spot', cgApiKey);
      results.bybit = bybitResult;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('❌ Error syncing Bybit:', message);
    }

    // Sync Bitget via CoinGecko (direct API geo-blocked from Supabase servers)
    try {
      const bitgetResult = await syncFromCoinGecko(supabase, 'bitget', 'bitget', cgApiKey);
      results.bitget = bitgetResult;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('❌ Error syncing Bitget:', message);
    }

    // ============================================
    // NON-BLOCKED EXCHANGES - Use Direct API
    // ============================================

    // Sync Coinbase
    try {
      const coinbaseResponse = await fetchWithTimeout('https://api.exchange.coinbase.com/products', 8000, 1);
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
        console.log(`✅ Coinbase: ${results.coinbase.synced} pairs, ${results.coinbase.active} active`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('❌ Error syncing Coinbase:', message);
    }

    // Sync MEXC
    // MEXC API uses status: "1" for active pairs (not "ENABLED" or "TRADING")
    try {
      const mexcResponse = await fetchWithTimeout('https://api.mexc.com/api/v3/exchangeInfo', 8000, 1);
      if (mexcResponse.ok) {
        const mexcData = await mexcResponse.json();
        const symbols: MEXCSymbol[] = mexcData?.symbols || [];
        
        // Log sample status values for debugging
        if (symbols.length > 0) {
          const sampleStatuses = [...new Set(symbols.slice(0, 100).map(s => s.status))];
          console.log(`📊 MEXC status values sample: ${JSON.stringify(sampleStatuses)}`);
        }
        
        const mexcRecords = symbols.map(s => ({
          exchange: 'mexc',
          symbol: s.symbol,
          base_asset: s.baseAsset,
          quote_asset: s.quoteAsset,
          // MEXC uses "1" for active, or check for ENABLED/TRADING as fallback
          is_active: s.status === '1' || String(s.status) === '1' || ['ENABLED', 'TRADING'].includes(String(s.status).toUpperCase()),
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
        console.log(`✅ MEXC: ${results.mexc.synced} pairs, ${results.mexc.active} active`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('❌ Error syncing MEXC:', message);
    }

    // Sync Gate.io
    try {
      const gateioResponse = await fetchWithTimeout('https://api.gateio.ws/api/v4/spot/currency_pairs', 8000, 1);
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
        console.log(`✅ Gate.io: ${results.gateio.synced} pairs, ${results.gateio.active} active`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('❌ Error syncing Gate.io:', message);
    }

    // Sync Kraken
    try {
      const krakenResponse = await fetchWithTimeout('https://api.kraken.com/0/public/AssetPairs', 8000, 1);
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
        console.log(`✅ Kraken: ${results.kraken.synced} pairs, ${results.kraken.active} active`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('❌ Error syncing Kraken:', message);
    }

    // Sync KuCoin
    try {
      const kucoinResponse = await fetchWithTimeout('https://api.kucoin.com/api/v1/symbols', 8000, 1);
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
        console.log(`✅ KuCoin: ${results.kucoin.synced} pairs, ${results.kucoin.active} active`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('❌ Error syncing KuCoin:', message);
    }

    // Sync OKX
    try {
      const okxResponse = await fetchWithTimeout('https://www.okx.com/api/v5/public/instruments?instType=SPOT', 8000, 1);
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
        console.log(`✅ OKX: ${results.okx.synced} pairs, ${results.okx.active} active`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('❌ Error syncing OKX:', message);
    }

    // Sync HTX (Huobi)
    try {
      const htxResponse = await fetchWithTimeout('https://api.huobi.pro/v1/common/symbols', 8000, 1);
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
        console.log(`✅ HTX: ${results.htx.synced} pairs, ${results.htx.active} active`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('❌ Error syncing HTX:', message);
    }

    console.log('🏁 Exchange sync complete:', results);

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
    const message = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({ 
        error: message,
        details: message,
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
