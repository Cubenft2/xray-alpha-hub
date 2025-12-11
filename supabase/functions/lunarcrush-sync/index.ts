import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface LunarCrushCoin {
  id: string;
  symbol: string;
  name: string;
  price: number;
  market_cap: number;
  market_cap_rank: number;
  logo?: string;
  percent_change_1h?: number;
  percent_change_24h?: number;
  percent_change_7d?: number;
  volume_24h?: number;
  galaxy_score?: number;
  alt_rank?: number;
  sentiment?: number;
  social_volume_24h?: number;
  social_dominance?: number;
  interactions_24h?: number;
  categories?: string[];
  blockchains?: string[];
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  console.log('[lunarcrush-sync] Starting sync...');

  try {
    const LUNARCRUSH_API_KEY = Deno.env.get('LUNARCRUSH_API_KEY');
    if (!LUNARCRUSH_API_KEY) {
      throw new Error('LUNARCRUSH_API_KEY not configured');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch top 1000 coins from LunarCrush - use v1 endpoint (free tier compatible)
    console.log('[lunarcrush-sync] Fetching from LunarCrush API v4 (v1 endpoint)...');
    const response = await fetch(
      'https://lunarcrush.com/api4/public/coins/list/v1',
      {
        headers: {
          'Authorization': `Bearer ${LUNARCRUSH_API_KEY}`
        }
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[lunarcrush-sync] API error:', response.status, errorText);
      throw new Error(`LunarCrush API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('[lunarcrush-sync] API response structure:', Object.keys(data));
    
    // LunarCrush v4 returns data in 'data' array
    const coins: LunarCrushCoin[] = data.data || data.coins || data || [];
    console.log(`[lunarcrush-sync] Received ${coins.length} coins`);

    if (!Array.isArray(coins) || coins.length === 0) {
      console.error('[lunarcrush-sync] No coins in response:', JSON.stringify(data).slice(0, 500));
      throw new Error('No coins data in LunarCrush response');
    }

    // Log sample coin for debugging
    if (coins.length > 0) {
      console.log('[lunarcrush-sync] Sample coin structure:', JSON.stringify(coins[0]).slice(0, 500));
    }

    // Transform to crypto_snapshot format
    const records = coins.map((coin, index) => ({
      ticker: `X:${coin.symbol.toUpperCase()}USD`,
      symbol: coin.symbol.toUpperCase(),
      name: coin.name || coin.symbol,
      price: coin.price || 0,
      market_cap: coin.market_cap || null,
      market_cap_rank: coin.market_cap_rank || index + 1,
      logo_url: coin.logo || null,
      change_percent: coin.percent_change_24h || 0,
      change_24h: coin.percent_change_24h || 0,
      percent_change_1h: coin.percent_change_1h || null,
      percent_change_7d: coin.percent_change_7d || null,
      volume_24h: coin.volume_24h || null,
      galaxy_score: coin.galaxy_score || null,
      alt_rank: coin.alt_rank || null,
      sentiment: coin.sentiment || null,
      social_volume_24h: coin.social_volume_24h || null,
      social_dominance: coin.social_dominance || null,
      interactions_24h: coin.interactions_24h || null,
      categories: coin.categories || [],
      blockchains: coin.blockchains || [],
      lunarcrush_id: coin.id || null,
      updated_at: new Date().toISOString()
    }));

    console.log(`[lunarcrush-sync] Upserting ${records.length} records to crypto_snapshot...`);

    // Upsert in batches of 200
    const batchSize = 200;
    let upsertedCount = 0;
    let errorCount = 0;

    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);
      
      const { error } = await supabase
        .from('crypto_snapshot')
        .upsert(batch, { 
          onConflict: 'ticker',
          ignoreDuplicates: false 
        });

      if (error) {
        console.error(`[lunarcrush-sync] Batch ${Math.floor(i / batchSize) + 1} error:`, error.message);
        errorCount += batch.length;
      } else {
        upsertedCount += batch.length;
      }
    }

    const duration = Date.now() - startTime;
    console.log(`[lunarcrush-sync] Complete: ${upsertedCount} upserted, ${errorCount} errors in ${duration}ms`);

    return new Response(JSON.stringify({
      success: true,
      coins_received: coins.length,
      upserted: upsertedCount,
      errors: errorCount,
      duration_ms: duration
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[lunarcrush-sync] Fatal error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
