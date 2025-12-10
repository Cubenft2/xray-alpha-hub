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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const POLYGON_API_KEY = Deno.env.get('POLYGON_API_KEY');
    if (!POLYGON_API_KEY) {
      throw new Error('POLYGON_API_KEY not configured');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check cache first (30 second TTL)
    const cacheKey = 'polygon_crypto_snapshot';
    const { data: cached } = await supabase
      .from('cache_kv')
      .select('v, expires_at')
      .eq('k', cacheKey)
      .single();

    if (cached && new Date(cached.expires_at) > new Date()) {
      console.log('📦 Returning cached snapshot data');
      return new Response(JSON.stringify(cached.v), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
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
      // X:BTCUSD -> BTC
      const match = t.ticker.match(/^X:([A-Z0-9]+)USD$/);
      return match ? match[1] : null;
    }).filter(Boolean) as string[];

    // Fetch asset data from database
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

    // Format response data
    const formattedData = usdPairs.map(t => {
      const match = t.ticker.match(/^X:([A-Z0-9]+)USD$/);
      const symbol = match ? match[1] : t.ticker;
      const assetInfo = assetMap.get(symbol);

      return {
        ticker: t.ticker,
        symbol,
        name: assetInfo?.name || symbol,
        logo_url: assetInfo?.logo_url || null,
        coingecko_id: assetInfo?.coingecko_id || null,
        price: t.day?.c || t.min?.c || 0,
        change24h: t.todaysChange || 0,
        changePercent: t.todaysChangePerc || 0,
        volume24h: t.day?.v || 0,
        vwap: t.day?.vw || 0,
        high24h: t.day?.h || 0,
        low24h: t.day?.l || 0,
        open24h: t.day?.o || 0,
        updated: t.updated,
      };
    }).filter(t => t.price > 0) // Only include tickers with valid prices
      .sort((a, b) => b.volume24h - a.volume24h); // Sort by volume

    console.log(`✅ Formatted ${formattedData.length} tickers with valid data`);

    // Cache the result for 30 seconds
    const expiresAt = new Date(Date.now() + 30 * 1000).toISOString();
    await supabase
      .from('cache_kv')
      .upsert({
        k: cacheKey,
        v: formattedData,
        expires_at: expiresAt,
      });

    return new Response(JSON.stringify(formattedData), {
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
