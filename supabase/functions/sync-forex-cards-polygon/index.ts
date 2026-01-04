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

    console.log('[sync-forex-cards-polygon] Starting forex price sync...');

    // Check if forex market is likely open
    // Forex is closed Friday 5 PM EST to Sunday 5 PM EST
    const now = new Date();
    const estOffset = -5 * 60; // EST offset in minutes
    const utcMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
    const estMinutes = utcMinutes + estOffset;
    const estHour = Math.floor(((estMinutes % 1440) + 1440) % 1440 / 60);
    const dayOfWeek = now.getUTCDay();
    
    // Simple weekend check (not perfect but handles most cases)
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    if (isWeekend) {
      console.log('[sync-forex-cards-polygon] Weekend detected - forex markets may be closed');
    }

    // Fetch forex_cards that are active (with pagination)
    const PAGE_SIZE = 1000;
    let forexCards: any[] = [];
    let offset = 0;
    
    while (true) {
      const { data: page, error: fetchError } = await supabase
        .from('forex_cards')
        .select('id, pair, base_currency, quote_currency')
        .eq('is_active', true)
        .range(offset, offset + PAGE_SIZE - 1);

      if (fetchError) {
        throw new Error(`Failed to fetch forex_cards: ${fetchError.message}`);
      }

      if (!page || page.length === 0) break;
      forexCards.push(...page);
      
      if (page.length < PAGE_SIZE) break;
      offset += PAGE_SIZE;
    }

    if (!forexCards || forexCards.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        message: 'No forex cards to sync',
        stats: { updated: 0 }
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    console.log(`[sync-forex-cards-polygon] Found ${forexCards.length} forex cards to sync`);

    // Fetch Polygon forex snapshot
    const snapshotUrl = `https://api.polygon.io/v2/snapshot/locale/global/markets/forex/tickers?apiKey=${polygonKey}`;
    const snapshotResponse = await fetch(snapshotUrl);
    
    if (!snapshotResponse.ok) {
      // Handle gracefully - might be weekend/holiday
      if (snapshotResponse.status === 404 || snapshotResponse.status === 403) {
        console.log('[sync-forex-cards-polygon] Polygon returned no data - markets may be closed');
        return new Response(JSON.stringify({
          success: true,
          message: 'Markets appear to be closed',
          stats: { updated: 0, market_status: 'closed' }
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      throw new Error(`Polygon snapshot failed: ${snapshotResponse.status}`);
    }

    const snapshotData = await snapshotResponse.json();
    const tickers = snapshotData.tickers || [];
    
    console.log(`[sync-forex-cards-polygon] Polygon returned ${tickers.length} forex tickers`);

    // Handle empty response (markets closed) - but still try metals
    if (tickers.length === 0) {
      console.log('[sync-forex-cards-polygon] No ticker data - forex markets likely closed');
    }

    // Build lookup map (C:EURUSD -> data)
    const polygonMap = new Map<string, any>();
    
    // Special handling for precious metals - query individually since they're not in forex snapshot
    const METAL_PAIRS = ['XAUUSD', 'XAGUSD', 'XPTUSD', 'XPDUSD'];
    for (const metalPair of METAL_PAIRS) {
      try {
        const prevDayUrl = `https://api.polygon.io/v2/aggs/ticker/C:${metalPair}/prev?apiKey=${polygonKey}`;
        const metalResponse = await fetch(prevDayUrl);
        
        if (metalResponse.ok) {
          const metalData = await metalResponse.json();
          if (metalData.results && metalData.results.length > 0) {
            const result = metalData.results[0];
            // Format it like the snapshot data
            polygonMap.set(metalPair, {
              ticker: `C:${metalPair}`,
              day: {
                o: result.o,
                h: result.h,
                l: result.l,
                c: result.c,
                v: result.v,
                vw: result.vw
              },
              lastQuote: {
                a: result.c, // Use close as ask approximation
                b: result.c * 0.9999 // Approximate bid
              }
            });
            console.log(`[sync-forex-cards-polygon] Fetched ${metalPair}: ${result.c}`);
          }
        }
      } catch (metalErr) {
        console.error(`[sync-forex-cards-polygon] Failed to fetch ${metalPair}:`, metalErr);
      }
    }
    for (const t of tickers) {
      if (t.ticker) {
        // Store both with and without C: prefix
        polygonMap.set(t.ticker, t);
        polygonMap.set(t.ticker.replace('C:', ''), t);
      }
    }

    // Process and update forex cards
    let updated = 0;
    let notFound = 0;
    const updates: any[] = [];
    const now_iso = new Date().toISOString();

    for (const card of forexCards) {
      const tickerData = polygonMap.get(card.pair) || polygonMap.get(`C:${card.pair}`);

      if (!tickerData) {
        notFound++;
        continue;
      }

      const day = tickerData.day || {};
      const prevDay = tickerData.prevDay || {};
      const lastQuote = tickerData.lastQuote || {};

      // Get current rate
      const currentRate = lastQuote.a || lastQuote.b || day.c || tickerData.min?.c;
      if (!currentRate) {
        notFound++;
        continue;
      }

      // Calculate change
      const openRate = day.o || prevDay.c;
      let changePct = null;
      let change = null;
      if (currentRate && openRate && openRate !== 0) {
        change = currentRate - openRate;
        changePct = (change / openRate) * 100;
      }

      // Calculate spread in pips (for JPY pairs, 1 pip = 0.01, otherwise 0.0001)
      let spreadPips = null;
      if (lastQuote.a && lastQuote.b) {
        const spread = lastQuote.a - lastQuote.b;
        const pipMultiplier = card.quote_currency === 'JPY' ? 100 : 10000;
        spreadPips = spread * pipMultiplier;
      }

      updates.push({
        id: card.id,
        rate: currentRate,
        bid: lastQuote.b || null,
        ask: lastQuote.a || null,
        spread_pips: spreadPips,
        open_24h: day.o || null,
        high_24h: day.h || null,
        low_24h: day.l || null,
        change_24h: change,
        change_24h_pct: changePct,
        price_updated_at: now_iso
      });
    }

    console.log(`[sync-forex-cards-polygon] Prepared ${updates.length} updates, ${notFound} not found`);

    // Batch update forex_cards using parallel updates within batches
    const BATCH_SIZE = 50;
    for (let i = 0; i < updates.length; i += BATCH_SIZE) {
      const batch = updates.slice(i, i + BATCH_SIZE);
      
      // Run updates in parallel within each batch
      const results = await Promise.all(
        batch.map(async (update) => {
          const { id, ...data } = update;
          const { error } = await supabase
            .from('forex_cards')
            .update(data)
            .eq('id', id);
          return { id, error };
        })
      );
      
      // Count successes
      updated += results.filter(r => !r.error).length;
      
      // Log any errors
      const errors = results.filter(r => r.error);
      if (errors.length > 0) {
        console.error(`[sync-forex-cards-polygon] Batch errors:`, errors.length);
      }
    }

    const duration = Date.now() - startTime;
    console.log(`[sync-forex-cards-polygon] Sync complete in ${duration}ms: ${updated} updated`);

    return new Response(JSON.stringify({
      success: true,
      stats: {
        forex_cards: forexCards.length,
        polygon_tickers: tickers.length,
        updated,
        not_found: notFound,
        market_status: tickers.length > 0 ? 'open' : 'closed',
        duration_ms: duration
      }
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('[sync-forex-cards-polygon] Fatal error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), { 
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  }
});
