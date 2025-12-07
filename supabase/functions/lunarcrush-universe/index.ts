import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CoinData {
  id: number;
  name: string;
  symbol: string;
  price: number;
  price_btc: number;
  market_cap: number;
  percent_change_24h: number;
  percent_change_7d: number;
  percent_change_30d: number;
  volume_24h: number;
  max_supply: number | null;
  circulating_supply: number;
  close: number;
  galaxy_score: number;
  alt_rank: number;
  volatility: number;
  market_cap_rank: number;
  categories?: string[];
  social_volume?: number;
  sentiment?: number;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Parse pagination params from request body
    let limit = 50;
    let offset = 0;
    let sortBy = 'market_cap_rank';
    let sortDir: 'asc' | 'desc' = 'asc';
    let search = '';
    let changeFilter: 'all' | 'gainers' | 'losers' = 'all';

    if (req.method === 'POST') {
      try {
        const body = await req.json();
        limit = Math.min(Math.max(body.limit || 50, 1), 200); // Cap at 200
        offset = Math.max(body.offset || 0, 0);
        sortBy = body.sortBy || 'market_cap_rank';
        sortDir = body.sortDir === 'desc' ? 'desc' : 'asc';
        search = (body.search || '').toLowerCase().trim();
        changeFilter = body.changeFilter || 'all';
      } catch {
        // Use defaults if body parsing fails
      }
    }

    const lunarCrushApiKey = Deno.env.get('LUNARCRUSH_API_KEY');
    
    if (!lunarCrushApiKey) {
      console.error('❌ LUNARCRUSH_API_KEY not configured');
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'LunarCrush API key not configured' 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const cacheKey = 'lunarcrush:universe:v1';
    const cacheTTL = 600; // 10 minutes

    // Try to get cached full dataset
    let allCoins: CoinData[] = [];
    let cacheHit = false;

    const { data: cachedData } = await supabase
      .from('cache_kv')
      .select('v, expires_at')
      .eq('k', cacheKey)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();

    if (cachedData?.v?.data) {
      console.log('✅ Using cached LunarCrush universe data');
      allCoins = cachedData.v.data;
      cacheHit = true;
    }

    // If no cache, fetch from API
    if (!cacheHit) {
      // Check for expired cache as fallback
      const { data: expiredCache } = await supabase
        .from('cache_kv')
        .select('v, expires_at')
        .eq('k', cacheKey)
        .maybeSingle();

      console.log('Fetching fresh LunarCrush universe data...');
      const response = await fetch('https://lunarcrush.com/api4/public/coins/list/v1', {
        headers: {
          'Authorization': `Bearer ${lunarCrushApiKey}`,
        },
      });

      if (!response.ok) {
        // If rate limited and we have expired cache, use that
        if (response.status === 429 && expiredCache?.v?.data) {
          console.log('⚠️ Rate limited! Using expired cache');
          allCoins = expiredCache.v.data;
        } else {
          throw new Error(`LunarCrush API error: ${response.status} ${response.statusText}`);
        }
      } else {
        const apiData = await response.json();
        const rawCoins = apiData.data || [];
        
        // Map API fields to our interface
        allCoins = rawCoins.map((coin: any) => {
          const social_volume = coin.interactions_24h || coin.social_volume_24h || coin.social_volume || 0;
          return {
            ...coin,
            social_volume,
            sentiment: coin.sentiment || 0,
          };
        });

        // Cache the full dataset
        const expiresAt = new Date(Date.now() + cacheTTL * 1000).toISOString();
        await supabase
          .from('cache_kv')
          .upsert({
            k: cacheKey,
            v: { data: allCoins, cached_at: new Date().toISOString() },
            expires_at: expiresAt,
          });

        console.log(`✅ Fetched and cached ${allCoins.length} coins from LunarCrush`);
      }
    }

    // Apply server-side filtering
    let filteredCoins = allCoins;

    // Search filter
    if (search) {
      filteredCoins = filteredCoins.filter(
        (coin) =>
          coin.symbol.toLowerCase().includes(search) ||
          coin.name.toLowerCase().includes(search)
      );
    }

    // Change filter (gainers/losers)
    if (changeFilter === 'gainers') {
      filteredCoins = filteredCoins.filter((coin) => coin.percent_change_24h > 0);
    } else if (changeFilter === 'losers') {
      filteredCoins = filteredCoins.filter((coin) => coin.percent_change_24h < 0);
    }

    // Server-side sorting
    const validSortKeys = ['market_cap_rank', 'price', 'percent_change_24h', 'market_cap', 'volume_24h', 'galaxy_score', 'alt_rank', 'name', 'symbol'];
    const safeSortBy = validSortKeys.includes(sortBy) ? sortBy : 'market_cap_rank';

    filteredCoins.sort((a: any, b: any) => {
      const aVal = a[safeSortBy] ?? 0;
      const bVal = b[safeSortBy] ?? 0;
      
      // Handle string comparison for name/symbol
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        const comparison = aVal.localeCompare(bVal);
        return sortDir === 'asc' ? comparison : -comparison;
      }
      
      const comparison = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      return sortDir === 'asc' ? comparison : -comparison;
    });

    const totalFiltered = filteredCoins.length;

    // Apply pagination
    const paginatedCoins = filteredCoins.slice(offset, offset + limit);

    // Calculate metadata
    const metadata = {
      total_coins: totalFiltered,
      total_all_coins: allCoins.length,
      total_market_cap: allCoins.reduce((sum, c) => sum + (c.market_cap || 0), 0),
      total_volume_24h: allCoins.reduce((sum, c) => sum + (c.volume_24h || 0), 0),
      average_galaxy_score: allCoins.reduce((sum, c) => sum + (c.galaxy_score || 0), 0) / allCoins.length,
      last_updated: new Date().toISOString(),
      page_size: limit,
      offset: offset,
      has_more: offset + limit < totalFiltered,
    };

    const result = {
      success: true,
      data: paginatedCoins,
      metadata,
    };

    console.log(`📊 Returning ${paginatedCoins.length}/${totalFiltered} coins (offset: ${offset}, limit: ${limit})`);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('❌ LunarCrush Universe Error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
