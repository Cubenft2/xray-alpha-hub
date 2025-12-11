import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CoinGeckoMarket {
  id: string;
  symbol: string;
  market_cap: number;
  market_cap_rank: number;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const COINGECKO_API_KEY = Deno.env.get('COINGECKO_API_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('🚀 Starting crypto snapshot sync from live_prices...');

    // Fetch CoinGecko market data (cached for 1 HOUR to minimize API calls)
    const cgCacheKey = 'coingecko_market_data_1000';
    let marketCapById = new Map<string, { market_cap: number; market_cap_rank: number }>();
    let marketCapBySymbol = new Map<string, { market_cap: number; market_cap_rank: number }>();
    
    const { data: cgCached } = await supabase
      .from('cache_kv')
      .select('v, expires_at')
      .eq('k', cgCacheKey)
      .single();

    if (cgCached && new Date(cgCached.expires_at) > new Date()) {
      console.log('📦 Using cached CoinGecko market data (1,000 tokens)');
      const cgData = cgCached.v as CoinGeckoMarket[];
      cgData.forEach(coin => {
        const data = { market_cap: coin.market_cap, market_cap_rank: coin.market_cap_rank };
        marketCapById.set(coin.id, data);
        marketCapBySymbol.set(coin.symbol.toLowerCase(), data);
      });
    } else {
      console.log('🔄 Fetching 4 pages from CoinGecko (1,000 tokens)...');
      try {
        const cgHeaders: Record<string, string> = { 'Accept': 'application/json' };
        const baseUrl = COINGECKO_API_KEY 
          ? 'https://pro-api.coingecko.com/api/v3/coins/markets'
          : 'https://api.coingecko.com/api/v3/coins/markets';
        
        if (COINGECKO_API_KEY) {
          cgHeaders['x-cg-pro-api-key'] = COINGECKO_API_KEY;
        }
        
        let allCoins: CoinGeckoMarket[] = [];
        const pages = [1, 2, 3, 4]; // 4 pages × 250 = 1,000 tokens
        
        for (const page of pages) {
          const cgUrl = `${baseUrl}?vs_currency=usd&order=market_cap_desc&per_page=250&page=${page}&sparkline=false`;
          const cgResponse = await fetch(cgUrl, { headers: cgHeaders });
          
          if (cgResponse.ok) {
            const pageData: CoinGeckoMarket[] = await cgResponse.json();
            allCoins = [...allCoins, ...pageData];
            console.log(`📊 Page ${page}: fetched ${pageData.length} coins`);
          } else {
            console.warn(`⚠️ CoinGecko page ${page} error:`, cgResponse.status);
          }
          
          // Rate limit delay between pages
          if (page < 4) {
            await new Promise(r => setTimeout(r, 250));
          }
        }
        
        console.log(`📊 Total fetched: ${allCoins.length} coins from CoinGecko`);
        
        allCoins.forEach(coin => {
          const data = { market_cap: coin.market_cap, market_cap_rank: coin.market_cap_rank };
          marketCapById.set(coin.id, data);
          marketCapBySymbol.set(coin.symbol.toLowerCase(), data);
        });
        
        // Cache CoinGecko data for 1 HOUR
        if (allCoins.length > 0) {
          const cgExpiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
          await supabase
            .from('cache_kv')
            .upsert({
              k: cgCacheKey,
              v: allCoins,
              expires_at: cgExpiresAt,
            });
        }
      } catch (cgError) {
        console.warn('⚠️ CoinGecko fetch failed:', cgError);
      }
    }

    // Pre-fetch coingecko_ids from database for better matching
    const { data: cgAssets } = await supabase
      .from('coingecko_assets')
      .select('asset_id, coingecko_id');
    
    const assetIdToCgId = new Map<string, string>();
    cgAssets?.forEach(a => {
      if (a.coingecko_id) {
        assetIdToCgId.set(a.asset_id, a.coingecko_id);
      }
    });
    console.log(`📚 Loaded ${assetIdToCgId.size} coingecko_id mappings from database`);

    // Read from live_prices table (populated by polygon-rest-poller)
    // Filter to ONLY crypto tickers (X:XXXUSD format)
    console.log('🔄 Reading CRYPTO prices from live_prices table (X: prefix only)...');
    const { data: livePrices, error: livePricesError } = await supabase
      .from('live_prices')
      .select(`
        ticker,
        price,
        change24h,
        display,
        asset_id,
        updated_at
      `)
      .eq('source', 'polygon')
      .like('ticker', 'X:%')
      .not('price', 'is', null);

    if (livePricesError) {
      throw new Error(`Failed to fetch live_prices: ${livePricesError.message}`);
    }

    console.log(`📊 Found ${livePrices?.length || 0} prices in live_prices table`);

    if (!livePrices || livePrices.length === 0) {
      return new Response(JSON.stringify({ 
        success: true, 
        count: 0,
        message: 'No prices found in live_prices table'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get asset IDs that have prices
    const assetIds = livePrices
      .filter(p => p.asset_id)
      .map(p => p.asset_id);

    // Fetch asset metadata
    const { data: assets } = await supabase
      .from('assets')
      .select(`
        id,
        symbol,
        name,
        logo_url,
        coingecko_assets(coingecko_id)
      `)
      .in('id', assetIds);

    // Create asset lookup map
    const assetMap = new Map<string, { 
      symbol: string; 
      name: string; 
      logo_url: string | null; 
      coingecko_id: string | null 
    }>();
    
    assets?.forEach(a => {
      const cgAsset = a.coingecko_assets as { coingecko_id: string } | null;
      assetMap.set(a.id, {
        symbol: a.symbol,
        name: a.name,
        logo_url: a.logo_url,
        coingecko_id: cgAsset?.coingecko_id || null,
      });
    });

    // Format data for crypto_snapshot table
    let matchedByIdCount = 0;
    let matchedBySymbolCount = 0;
    
    const snapshotRows = livePrices
      .map(p => {
        // Extract symbol from ticker (e.g., "X:BTCUSD" -> "BTC")
        const tickerMatch = p.ticker.match(/^X:([A-Z0-9]+)USD$/);
        const symbolFromTicker = tickerMatch ? tickerMatch[1] : null;
        
        // Get asset info
        const assetInfo = p.asset_id ? assetMap.get(p.asset_id) : null;
        const symbol = assetInfo?.symbol || symbolFromTicker || p.display;
        
        // Get coingecko_id from multiple sources (priority order)
        const coingeckoId = assetInfo?.coingecko_id || 
                           (p.asset_id ? assetIdToCgId.get(p.asset_id) : null);
        
        // Try to get market cap data with priority matching
        let marketData = null;
        
        // Priority 1: Match by coingecko_id (most accurate)
        if (coingeckoId && marketCapById.has(coingeckoId)) {
          marketData = marketCapById.get(coingeckoId);
          matchedByIdCount++;
        }
        // Priority 2: Match by symbol (fallback)
        else if (symbol && marketCapBySymbol.has(symbol.toLowerCase())) {
          marketData = marketCapBySymbol.get(symbol.toLowerCase());
          matchedBySymbolCount++;
        }

        if (!symbol || p.price <= 0) return null;

        return {
          symbol,
          ticker: p.ticker,
          name: assetInfo?.name || symbol,
          logo_url: assetInfo?.logo_url || null,
          coingecko_id: coingeckoId || null,
          price: p.price,
          change_24h: 0,
          change_percent: p.change24h || 0,
          volume_24h: 0,
          vwap: 0,
          high_24h: 0,
          low_24h: 0,
          open_24h: 0,
          market_cap: marketData?.market_cap || null,
          market_cap_rank: marketData?.market_cap_rank || null,
          updated_at: new Date().toISOString(),
        };
      })
      .filter(Boolean);

    console.log(`📊 Market cap matched: ${matchedByIdCount} by ID, ${matchedBySymbolCount} by symbol, ${snapshotRows.length - matchedByIdCount - matchedBySymbolCount} unmatched`);

    // Deduplicate by symbol (keep first occurrence - usually has best data)
    const uniqueBySymbol = new Map<string, typeof snapshotRows[0]>();
    snapshotRows.forEach(row => {
      if (row && !uniqueBySymbol.has(row.symbol)) {
        uniqueBySymbol.set(row.symbol, row);
      }
    });
    const deduplicatedRows = Array.from(uniqueBySymbol.values());
    
    console.log(`📝 Upserting ${deduplicatedRows.length} unique rows to crypto_snapshot table (${snapshotRows.length - deduplicatedRows.length} duplicates removed)...`);

    // Batch upsert in chunks of 500
    const BATCH_SIZE = 500;
    let totalUpserted = 0;

    for (let i = 0; i < deduplicatedRows.length; i += BATCH_SIZE) {
      const batch = deduplicatedRows.slice(i, i + BATCH_SIZE);
      const { error: upsertError } = await supabase
        .from('crypto_snapshot')
        .upsert(batch, { onConflict: 'symbol' });

      if (upsertError) {
        console.error(`❌ Batch upsert error:`, upsertError);
      } else {
        totalUpserted += batch.length;
      }
    }

    console.log(`✅ Successfully synced ${totalUpserted} crypto snapshots from live_prices`);

    return new Response(JSON.stringify({ 
      success: true, 
      count: totalUpserted,
      source: 'live_prices',
      message: `Synced ${totalUpserted} crypto snapshots from live_prices table`
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
