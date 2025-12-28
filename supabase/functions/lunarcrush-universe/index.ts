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

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('📊 Reading token_cards from database (no LunarCrush API call)...');

    // Read from token_cards table instead of calling LunarCrush API
    const { data: tokenCards, error: dbError } = await supabase
      .from('token_cards')
      .select(`
        id, canonical_symbol, name, logo_url, market_cap, market_cap_rank,
        price_usd, volume_24h_usd, change_24h_pct, change_1h_pct, change_7d_pct, change_30d_pct,
        galaxy_score, alt_rank, sentiment, social_volume_24h, social_dominance, interactions_24h,
        volatility, circulating_supply, max_supply, categories, primary_chain, is_active
      `)
      .eq('is_active', true)
      .not('market_cap_rank', 'is', null)
      .order('market_cap_rank', { ascending: true })
      .limit(3000);

    if (dbError) {
      console.error('❌ Database error:', dbError.message);
      throw new Error(`Database error: ${dbError.message}`);
    }

    // Transform token_cards to CoinData format
    const allCoins: CoinData[] = (tokenCards || []).map((card: any) => ({
      id: card.id,
      name: card.name || card.canonical_symbol,
      symbol: card.canonical_symbol,
      price: card.price_usd || 0,
      price_btc: 0, // Not available from token_cards
      market_cap: card.market_cap || 0,
      percent_change_1h: card.change_1h_pct || 0,
      percent_change_24h: card.change_24h_pct || 0,
      percent_change_7d: card.change_7d_pct || 0,
      percent_change_30d: card.change_30d_pct || 0,
      volume_24h: card.volume_24h_usd || 0,
      max_supply: card.max_supply,
      circulating_supply: card.circulating_supply || 0,
      close: card.price_usd || 0,
      galaxy_score: card.galaxy_score || 0,
      alt_rank: card.alt_rank || 0,
      volatility: card.volatility || 0,
      market_cap_rank: card.market_cap_rank || 9999,
      logo_url: card.logo_url,
      categories: Array.isArray(card.categories) ? card.categories : [],
      social_volume: card.social_volume_24h || 0,
      social_dominance: card.social_dominance || 0,
      interactions_24h: card.interactions_24h || 0,
      sentiment: card.sentiment || 50,
      blockchains: card.primary_chain ? [card.primary_chain] : [],
    }));

    console.log(`📊 Loaded ${allCoins.length} tokens from token_cards`);

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

    // Calculate metadata
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
      source: 'token_cards', // Indicate data comes from DB, not API
    };

    const result = {
      success: true,
      data: paginatedCoins,
      metadata,
    };

    console.log(`📊 Returning ${paginatedCoins.length}/${totalFiltered} coins from token_cards (offset: ${offset})`);

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
