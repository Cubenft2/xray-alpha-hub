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
  percent_change_1h: number;
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
  logo_url?: string;
  categories?: string[];
  social_volume?: number;
  social_dominance?: number;
  interactions_24h?: number;
  sentiment?: number;
  blockchains?: string[];
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Parse pagination and filter params from request body
    let limit = 100;
    let offset = 0;
    let sortBy = 'market_cap_rank';
    let sortDir: 'asc' | 'desc' = 'asc';
    let search = '';
    let changeFilter: 'all' | 'gainers' | 'losers' = 'all';
    let category = 'all';
    let minVolume = 0;
    let minGalaxyScore = 0;
    let minMarketCap = 0;

    if (req.method === 'POST') {
      try {
        const body = await req.json();
        limit = Math.min(Math.max(body.limit || 100, 1), 200);
        offset = Math.max(body.offset || 0, 0);
        sortBy = body.sortBy || 'market_cap_rank';
        sortDir = body.sortDir === 'desc' ? 'desc' : 'asc';
        search = (body.search || '').toLowerCase().trim();
        changeFilter = body.changeFilter || 'all';
        category = body.category || 'all';
        minVolume = body.minVolume || 0;
        minGalaxyScore = body.minGalaxyScore || 0;
        minMarketCap = body.minMarketCap || 0;
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

    const cacheKey = 'lunarcrush:universe:v4';
    const cacheTTL = 300; // 5 minutes
    const MAX_COINS = 3000;

    // Try to get cached full dataset
    let allCoins: CoinData[] = [];
    let cacheHit = false;

    const { data: cachedData } = await supabase
      .from('cache_kv')
      .select('v')
      .eq('k', cacheKey)
      .maybeSingle();

    const now = Date.now();
    if (cachedData?.v?.data && cachedData?.v?.cached_at) {
      const cachedAt = new Date(cachedData.v.cached_at).getTime();
      const age = (now - cachedAt) / 1000;
      
      if (age < cacheTTL) {
        console.log(`✅ Using cached LunarCrush data (${Math.round(age)}s old)`);
        allCoins = cachedData.v.data;
        cacheHit = true;
      } else {
        console.log(`⏰ Cache expired (${Math.round(age)}s old, TTL: ${cacheTTL}s)`);
      }
    }

    // If no cache, fetch from API
    if (!cacheHit) {
      const expiredCoins = cachedData?.v?.data || [];

      console.log('🔄 Fetching fresh LunarCrush universe data...');
      
      try {
        const response = await fetch('https://lunarcrush.com/api4/public/coins/list/v1', {
          headers: {
            'Authorization': `Bearer ${lunarCrushApiKey}`,
          },
        });

        if (!response.ok) {
          // Always try to use expired cache on any API error
          if (expiredCoins.length > 0) {
            console.log(`⚠️ API error ${response.status}! Using expired cache as fallback (${expiredCoins.length} coins)`);
            allCoins = expiredCoins;
          } else {
            throw new Error(`LunarCrush API error: ${response.status} ${response.statusText}`);
          }
        } else {
        const apiData = await response.json();
        const rawCoins = apiData.data || [];
        
        // Map API fields to our interface
        allCoins = rawCoins
          .filter((coin: any) => coin.market_cap_rank && coin.market_cap_rank <= MAX_COINS)
          .map((coin: any) => {
            const social_volume = coin.interactions_24h || coin.social_volume_24h || coin.social_volume || 0;
            const categories = coin.categories ? 
              (Array.isArray(coin.categories) ? coin.categories : [coin.categories]) : 
              [];
            const blockchains = coin.blockchains ?
              (Array.isArray(coin.blockchains) ? coin.blockchains : [coin.blockchains]) :
              [];
            
            return {
              ...coin,
              logo_url: coin.logo || coin.logo_url || null,
              percent_change_1h: coin.percent_change_1h || coin.change_1h || 0,
              percent_change_7d: coin.percent_change_7d || coin.change_7d || 0,
              social_volume,
              social_dominance: coin.social_dominance || 0,
              interactions_24h: coin.interactions_24h || 0,
              sentiment: coin.sentiment || 50,
              categories,
              blockchains,
            };
          });

        console.log(`📊 Filtered to ${allCoins.length} coins (top ${MAX_COINS} by market cap)`);

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
      } catch (fetchError) {
        // Network error - try to use expired cache
        if (expiredCoins.length > 0) {
          console.log(`⚠️ Fetch failed: ${fetchError.message}. Using expired cache (${expiredCoins.length} coins)`);
          allCoins = expiredCoins;
        } else {
          throw fetchError;
        }
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

    // Category filter
    if (category !== 'all') {
      filteredCoins = filteredCoins.filter((coin) => {
        if (!coin.categories || !Array.isArray(coin.categories)) return false;
        return coin.categories.some((cat: string) => 
          cat.toLowerCase().includes(category.toLowerCase())
        );
      });
    }

    // Volume threshold
    if (minVolume > 0) {
      filteredCoins = filteredCoins.filter((coin) => (coin.volume_24h || 0) >= minVolume);
    }

    // Galaxy Score threshold
    if (minGalaxyScore > 0) {
      filteredCoins = filteredCoins.filter((coin) => (coin.galaxy_score || 0) >= minGalaxyScore);
    }

    // Market Cap threshold
    if (minMarketCap > 0) {
      filteredCoins = filteredCoins.filter((coin) => (coin.market_cap || 0) >= minMarketCap);
    }

    // Server-side sorting
    const validSortKeys = [
      'market_cap_rank', 'price', 'percent_change_1h', 'percent_change_24h', 'percent_change_7d',
      'market_cap', 'volume_24h', 'galaxy_score', 'alt_rank', 'name', 'symbol', 'social_volume', 'sentiment'
    ];
    const safeSortBy = validSortKeys.includes(sortBy) ? sortBy : 'market_cap_rank';

    filteredCoins.sort((a: any, b: any) => {
      const aVal = a[safeSortBy] ?? 0;
      const bVal = b[safeSortBy] ?? 0;
      
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

    // Calculate metadata including average sentiment
    const avgSentiment = allCoins.reduce((sum, c) => sum + (c.sentiment || 50), 0) / (allCoins.length || 1);

    const metadata = {
      total_coins: totalFiltered,
      total_all_coins: allCoins.length,
      total_market_cap: allCoins.reduce((sum, c) => sum + (c.market_cap || 0), 0),
      total_volume_24h: allCoins.reduce((sum, c) => sum + (c.volume_24h || 0), 0),
      average_galaxy_score: allCoins.reduce((sum, c) => sum + (c.galaxy_score || 0), 0) / (allCoins.length || 1),
      average_sentiment: avgSentiment,
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
