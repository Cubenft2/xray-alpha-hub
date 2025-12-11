import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PolygonTicker {
  ticker: string;
  todaysChange: number;
  todaysChangePerc: number;
  updated: number;
  day: {
    o: number;
    h: number;
    l: number;
    c: number;
    v: number;
    vw: number;
  };
  min?: {
    o: number;
    h: number;
    l: number;
    c: number;
    v: number;
    vw: number;
  };
  prevDay?: {
    o: number;
    h: number;
    l: number;
    c: number;
    v: number;
    vw: number;
  };
}

interface SnapshotResponse {
  tickers: PolygonTicker[];
  status: string;
  count: number;
}

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
    const POLYGON_API_KEY = Deno.env.get('POLYGON_API_KEY');
    const COINGECKO_API_KEY = Deno.env.get('COINGECKO_API_KEY');
    
    if (!POLYGON_API_KEY) {
      throw new Error('POLYGON_API_KEY not configured');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('🚀 Starting crypto snapshot sync...');

    // Fetch CoinGecko market data (cached for 5 minutes)
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
          });
          
          // Cache CoinGecko data for 5 minutes
          const cgExpiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
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

    // Fetch from Polygon snapshot API
    console.log('🔄 Fetching fresh snapshot from Polygon.io...');
    const url = `https://api.polygon.io/v2/snapshot/locale/global/markets/crypto/tickers?apiKey=${POLYGON_API_KEY}`;
    
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Polygon API error: ${response.status}`);
    }

    const data: SnapshotResponse = await response.json();
    console.log(`📊 Received ${data.count} tickers from Polygon`);

    // Filter to USD pairs only and extract symbols
    const usdPairs = data.tickers.filter(t => t.ticker.endsWith('USD') && !t.ticker.endsWith('USDT'));
    console.log(`💵 Filtered to ${usdPairs.length} USD pairs`);

    // Extract symbols for database lookup
    const symbols = usdPairs.map(t => {
      const match = t.ticker.match(/^X:([A-Z0-9]+)USD$/);
      return match ? match[1] : null;
    }).filter(Boolean) as string[];

    // Fetch asset data from database including coingecko_id
    const { data: assets } = await supabase
      .from('assets')
      .select(`
        symbol,
        name,
        logo_url,
        coingecko_assets(coingecko_id)
      `)
      .in('symbol', symbols);

    // Create lookup map
    const assetMap = new Map<string, { name: string; logo_url: string | null; coingecko_id: string | null }>();
    assets?.forEach(a => {
      const cgAsset = a.coingecko_assets as { coingecko_id: string } | null;
      assetMap.set(a.symbol, {
        name: a.name,
        logo_url: a.logo_url,
        coingecko_id: cgAsset?.coingecko_id || null,
      });
    });

    // Format data for database upsert
    const snapshotRows = usdPairs
      .map(t => {
        const match = t.ticker.match(/^X:([A-Z0-9]+)USD$/);
        const symbol = match ? match[1] : t.ticker;
        const assetInfo = assetMap.get(symbol);
        const coingeckoId = assetInfo?.coingecko_id;
        const marketData = coingeckoId ? marketCapMap.get(coingeckoId) : null;
        const price = t.day?.c || t.min?.c || 0;

        if (price <= 0) return null;

        return {
          symbol,
          ticker: t.ticker,
          name: assetInfo?.name || symbol,
          logo_url: assetInfo?.logo_url || null,
          coingecko_id: coingeckoId || null,
          price,
          change_24h: t.todaysChange || 0,
          change_percent: t.todaysChangePerc || 0,
          volume_24h: t.day?.v || 0,
          vwap: t.day?.vw || 0,
          high_24h: t.day?.h || 0,
          low_24h: t.day?.l || 0,
          open_24h: t.day?.o || 0,
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

    console.log(`✅ Successfully synced ${totalUpserted} crypto snapshots to database`);

    return new Response(JSON.stringify({ 
      success: true, 
      count: totalUpserted,
      message: `Synced ${totalUpserted} crypto snapshots`
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
