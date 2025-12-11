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
    const cgCacheKey = 'coingecko_market_data';
    let marketCapMap = new Map<string, { market_cap: number; market_cap_rank: number }>();
    
    const { data: cgCached } = await supabase
      .from('cache_kv')
      .select('v, expires_at')
      .eq('k', cgCacheKey)
      .single();

    if (cgCached && new Date(cgCached.expires_at) > new Date()) {
      console.log('📦 Using cached CoinGecko market data');
      const cgData = cgCached.v as CoinGeckoMarket[];
      cgData.forEach(coin => {
        marketCapMap.set(coin.id, { 
          market_cap: coin.market_cap, 
          market_cap_rank: coin.market_cap_rank 
        });
        // Also map by symbol for fallback matching
        marketCapMap.set(coin.symbol.toLowerCase(), { 
          market_cap: coin.market_cap, 
          market_cap_rank: coin.market_cap_rank 
        });
      });
    } else {
      console.log('🔄 Fetching fresh CoinGecko market data...');
      try {
        const cgHeaders: Record<string, string> = { 'Accept': 'application/json' };
        if (COINGECKO_API_KEY) {
          cgHeaders['x-cg-pro-api-key'] = COINGECKO_API_KEY;
        }
        
        const cgUrl = COINGECKO_API_KEY 
          ? 'https://pro-api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=250&page=1&sparkline=false'
          : 'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=250&page=1&sparkline=false';
        
        const cgResponse = await fetch(cgUrl, { headers: cgHeaders });
        
        if (cgResponse.ok) {
          const cgData: CoinGeckoMarket[] = await cgResponse.json();
          console.log(`📊 Fetched ${cgData.length} coins from CoinGecko`);
          
          cgData.forEach(coin => {
            marketCapMap.set(coin.id, { 
              market_cap: coin.market_cap, 
              market_cap_rank: coin.market_cap_rank 
            });
            marketCapMap.set(coin.symbol.toLowerCase(), { 
              market_cap: coin.market_cap, 
              market_cap_rank: coin.market_cap_rank 
            });
          });
          
          // Cache CoinGecko data for 1 HOUR (was 5 minutes)
          const cgExpiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
          await supabase
            .from('cache_kv')
            .upsert({
              k: cgCacheKey,
              v: cgData,
              expires_at: cgExpiresAt,
            });
        } else {
          console.warn('⚠️ CoinGecko API error:', cgResponse.status);
        }
      } catch (cgError) {
        console.warn('⚠️ CoinGecko fetch failed:', cgError);
      }
    }

    // Read from live_prices table (populated by polygon-rest-poller)
    console.log('🔄 Reading prices from live_prices table...');
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
    const snapshotRows = livePrices
      .map(p => {
        // Extract symbol from ticker (e.g., "X:BTCUSD" -> "BTC")
        const tickerMatch = p.ticker.match(/^X:([A-Z0-9]+)USD$/);
        const symbolFromTicker = tickerMatch ? tickerMatch[1] : null;
        
        // Get asset info
        const assetInfo = p.asset_id ? assetMap.get(p.asset_id) : null;
        const symbol = assetInfo?.symbol || symbolFromTicker || p.display;
        const coingeckoId = assetInfo?.coingecko_id;
        
        // Try to get market cap data
        let marketData = coingeckoId ? marketCapMap.get(coingeckoId) : null;
        if (!marketData && symbol) {
          marketData = marketCapMap.get(symbol.toLowerCase());
        }

        if (!symbol || p.price <= 0) return null;

        return {
          symbol,
          ticker: p.ticker,
          name: assetInfo?.name || symbol,
          logo_url: assetInfo?.logo_url || null,
          coingecko_id: coingeckoId || null,
          price: p.price,
          change_24h: 0, // live_prices doesn't have absolute change
          change_percent: p.change24h || 0,
          volume_24h: 0, // Not available from live_prices
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

    console.log(`📝 Upserting ${snapshotRows.length} rows to crypto_snapshot table...`);

    // Batch upsert in chunks of 500
    const BATCH_SIZE = 500;
    let totalUpserted = 0;

    for (let i = 0; i < snapshotRows.length; i += BATCH_SIZE) {
      const batch = snapshotRows.slice(i, i + BATCH_SIZE);
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
