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

    // Fetch top 3000 coins from LunarCrush by market cap (3 pages of 1000)
    console.log('[lunarcrush-sync] Fetching 3000 coins from LunarCrush API v4 (3 pages)...');
    
    let allCoins: LunarCrushCoin[] = [];
    
    for (let page = 0; page < 3; page++) {
      const offset = page * 1000;
      const response = await fetch(
        `https://lunarcrush.com/api4/public/coins/list/v1?limit=1000&offset=${offset}&sort=market_cap&desc=1`,
        {
          headers: {
            'Authorization': `Bearer ${LUNARCRUSH_API_KEY}`
          }
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[lunarcrush-sync] Page ${page + 1} error:`, response.status, errorText);
        // Continue to next page instead of failing completely
        continue;
      }

      const data = await response.json();
      const pageCoins: LunarCrushCoin[] = data.data || [];
      console.log(`[lunarcrush-sync] Page ${page + 1}: ${pageCoins.length} coins (offset: ${offset})`);
      allCoins = [...allCoins, ...pageCoins];
      
      // Rate limit delay between pages (300ms)
      if (page < 2) {
        await new Promise(r => setTimeout(r, 300));
      }
    }
    
    console.log(`[lunarcrush-sync] Total fetched: ${allCoins.length} coins`);
    const rawCoins = allCoins;

    if (!Array.isArray(rawCoins) || rawCoins.length === 0) {
      console.error('[lunarcrush-sync] No coins in response:', JSON.stringify(data).slice(0, 500));
      throw new Error('No coins data in LunarCrush response');
    }

    // Log sample coin for debugging
    if (rawCoins.length > 0) {
      console.log('[lunarcrush-sync] Sample coin structure:', JSON.stringify(rawCoins[0]).slice(0, 500));
    }

    // Deduplicate by symbol - keep highest market cap rank (lowest number = best)
    const coinsBySymbol = new Map<string, LunarCrushCoin>();
    for (const coin of rawCoins) {
      const symbol = coin.symbol?.toUpperCase();
      if (!symbol) continue;
      
      const existing = coinsBySymbol.get(symbol);
      if (!existing || (coin.market_cap_rank && (!existing.market_cap_rank || coin.market_cap_rank < existing.market_cap_rank))) {
        coinsBySymbol.set(symbol, coin);
      }
    }
    const coins = Array.from(coinsBySymbol.values());
    console.log(`[lunarcrush-sync] After deduplication: ${coins.length} unique coins`);

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
          onConflict: 'symbol',
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
