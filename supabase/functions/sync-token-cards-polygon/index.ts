import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const polygonKey = Deno.env.get('POLYGON_API_KEY');
    const supabase = createClient(supabaseUrl, supabaseKey);

    if (!polygonKey) {
      throw new Error('POLYGON_API_KEY not configured');
    }

    console.log('[sync-token-cards-polygon] Starting price sync...');

    // Get and increment call counter for tiered refresh
    const COUNTER_KEY = 'sync-token-cards-polygon:call_count';
    const { data: counterData } = await supabase
      .from('cache_kv')
      .select('v')
      .eq('k', COUNTER_KEY)
      .single();
    
    let callCount = counterData?.v?.count || 0;
    callCount++;
    
    // Update counter
    await supabase
      .from('cache_kv')
      .upsert({
        k: COUNTER_KEY,
        v: { count: callCount },
        expires_at: new Date(Date.now() + 86400000).toISOString() // 24h expiry
      }, { onConflict: 'k' });

    console.log(`[sync-token-cards-polygon] Call #${callCount}`);

    // Determine which tiers to fetch this call
    const fetchTier1 = true; // Always
    const fetchTier2 = true; // Always
    const fetchTier3 = callCount % 2 === 0; // Every 2nd call
    const fetchTier4 = callCount % 5 === 0; // Every 5th call

    // Build tier filter
    const tiers: number[] = [1, 2];
    if (fetchTier3) tiers.push(3);
    if (fetchTier4) tiers.push(4);

    console.log(`[sync-token-cards-polygon] Fetching tiers: ${tiers.join(', ')}`);

    // Fetch tokens with polygon_ticker for selected tiers
    const { data: tokens, error: fetchError } = await supabase
      .from('token_cards')
      .select('id, canonical_symbol, polygon_ticker, tier')
      .not('polygon_ticker', 'is', null)
      .in('tier', tiers)
      .eq('is_active', true);

    if (fetchError) {
      throw new Error(`Failed to fetch tokens: ${fetchError.message}`);
    }

    if (!tokens || tokens.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        message: 'No tokens to sync',
        stats: { fetched: 0, updated: 0 }
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    console.log(`[sync-token-cards-polygon] Found ${tokens.length} tokens to sync`);

    // Fetch Polygon snapshot for all crypto tickers
    const snapshotUrl = `https://api.polygon.io/v2/snapshot/locale/global/markets/crypto/tickers?apiKey=${polygonKey}`;
    const snapshotResponse = await fetch(snapshotUrl);
    
    if (!snapshotResponse.ok) {
      throw new Error(`Polygon snapshot failed: ${snapshotResponse.status}`);
    }

    const snapshotData = await snapshotResponse.json();
    const tickers = snapshotData.tickers || [];
    
    console.log(`[sync-token-cards-polygon] Polygon returned ${tickers.length} tickers`);

    // Build lookup map from Polygon data (ticker -> data)
    const polygonMap = new Map<string, any>();
    for (const t of tickers) {
      if (t.ticker) {
        polygonMap.set(t.ticker, t);
      }
    }

    // Process and update tokens
    let updated = 0;
    let notFound = 0;
    const updates: any[] = [];
    const now = new Date().toISOString();

    for (const token of tokens) {
      const polygonTicker = token.polygon_ticker;
      const tickerData = polygonMap.get(polygonTicker);

      if (!tickerData) {
        notFound++;
        continue;
      }

      const day = tickerData.day || {};
      const prevDay = tickerData.prevDay || {};
      const lastQuote = tickerData.lastQuote || {};
      const lastTrade = tickerData.lastTrade || {};

      // Calculate change percentage
      const currentPrice = lastTrade.p || day.c || tickerData.lastTrade?.p;
      const openPrice = day.o || prevDay.c;
      let changePct = null;
      if (currentPrice && openPrice && openPrice !== 0) {
        changePct = ((currentPrice - openPrice) / openPrice) * 100;
      }

      // Calculate spread percentage
      let spreadPct = null;
      if (lastQuote.P && lastQuote.p && lastQuote.P !== 0) {
        spreadPct = ((lastQuote.P - lastQuote.p) / lastQuote.P) * 100;
      }

      updates.push({
        id: token.id,
        price_usd: currentPrice,
        open_24h: day.o || null,
        high_24h: day.h || null,
        low_24h: day.l || null,
        close_24h: day.c || null,
        vwap_24h: day.vw || null,
        volume_24h_usd: day.v ? day.v * (day.vw || currentPrice || 0) : null,
        change_24h_pct: changePct,
        bid_price: lastQuote.p || null,
        ask_price: lastQuote.P || null,
        spread_pct: spreadPct,
        price_updated_at: now,
        polygon_supported: true  // Mark as actively receiving Polygon prices
      });
    }

    console.log(`[sync-token-cards-polygon] Prepared ${updates.length} updates, ${notFound} not found in Polygon`);

    // Batch update token_cards
    const BATCH_SIZE = 100;
    for (let i = 0; i < updates.length; i += BATCH_SIZE) {
      const batch = updates.slice(i, i + BATCH_SIZE);
      
      for (const update of batch) {
        const { id, ...data } = update;
        const { error } = await supabase
          .from('token_cards')
          .update(data)
          .eq('id', id);
        
        if (error) {
          console.error(`[sync-token-cards-polygon] Update error for ${id}:`, error.message);
        } else {
          updated++;
        }
      }
    }

    const duration = Date.now() - startTime;
    console.log(`[sync-token-cards-polygon] Sync complete in ${duration}ms: ${updated} updated, ${notFound} not found`);

    return new Response(JSON.stringify({
      success: true,
      stats: {
        call_number: callCount,
        tiers_fetched: tiers,
        tokens_queried: tokens.length,
        polygon_tickers: tickers.length,
        updated,
        not_found: notFound,
        duration_ms: duration
      }
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('[sync-token-cards-polygon] Fatal error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), { 
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  }
});
