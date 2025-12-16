import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Fetch technical indicator from Polygon
async function fetchIndicator(
  ticker: string, 
  indicatorType: string, 
  apiKey: string, 
  params: string = ''
): Promise<number | null> {
  try {
    const url = `https://api.polygon.io/v1/indicators/${indicatorType}/${ticker}?timespan=day&adjusted=true&limit=1${params}&apiKey=${apiKey}`;
    const response = await fetch(url);
    if (!response.ok) return null;
    
    const data = await response.json();
    const values = data.results?.values;
    if (!values || values.length === 0) return null;
    
    const latest = values[0];
    // Handle different return formats
    if (typeof latest.value === 'number') return latest.value;
    if (typeof latest.histogram === 'number') return latest.histogram;
    return null;
  } catch {
    return null;
  }
}

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

    console.log('[sync-token-cards-polygon] Starting price + technicals sync...');

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

      const volume24h = day.v ? day.v * (day.vw || currentPrice || 0) : null;
      
      updates.push({
        id: token.id,
        polygon_ticker: polygonTicker,
        // DEDICATED POLYGON PRICE COLUMNS - ALWAYS WRITE
        // Trigger will compute display price_usd from freshest source
        polygon_price_usd: currentPrice,
        polygon_volume_24h: volume24h,
        polygon_change_24h_pct: changePct,
        polygon_high_24h: day.h || null,
        polygon_low_24h: day.l || null,
        polygon_price_updated_at: now,
        // Additional Polygon-specific fields
        open_24h: day.o || null,
        close_24h: day.c || null,
        vwap_24h: day.vw || null,
        bid_price: lastQuote.p || null,
        ask_price: lastQuote.P || null,
        spread_pct: spreadPct,
        polygon_supported: true
      });
    }

    console.log(`[sync-token-cards-polygon] Prepared ${updates.length} price updates, ${notFound} not found in Polygon`);

    // Batch update token_cards with prices
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

    // Fetch technical indicators for Tier 1-2 tokens only (every 5th call to reduce API load)
    let technicalsUpdated = 0;
    const shouldFetchTechnicals = callCount % 5 === 0;
    
    if (shouldFetchTechnicals) {
      console.log('[sync-token-cards-polygon] Fetching technicals for Tier 1-2 tokens...');
      
      const tier12Tokens = updates.filter(u => {
        const token = tokens.find(t => t.id === u.id);
        return token && (token.tier === 1 || token.tier === 2);
      }).slice(0, 50); // Limit to top 50 to avoid timeout
      
      for (const update of tier12Tokens) {
        const ticker = update.polygon_ticker;
        if (!ticker) continue;
        
        try {
          // Fetch indicators in parallel
          const [rsi, macd, sma20, sma50, sma200, ema12, ema26] = await Promise.all([
            fetchIndicator(ticker, 'rsi', polygonKey, '&window=14'),
            fetchIndicator(ticker, 'macd', polygonKey, '&short_window=12&long_window=26&signal_window=9'),
            fetchIndicator(ticker, 'sma', polygonKey, '&window=20'),
            fetchIndicator(ticker, 'sma', polygonKey, '&window=50'),
            fetchIndicator(ticker, 'sma', polygonKey, '&window=200'),
            fetchIndicator(ticker, 'ema', polygonKey, '&window=12'),
            fetchIndicator(ticker, 'ema', polygonKey, '&window=26'),
          ]);
          
          // Update token_cards with technicals
          const { error } = await supabase
            .from('token_cards')
            .update({
              rsi_14: rsi,
              macd: macd,
              sma_20: sma20,
              sma_50: sma50,
              sma_200: sma200,
              ema_12: ema12,
              ema_26: ema26,
              technicals_updated_at: now,
              technicals_source: 'polygon'  // Track data source
            })
            .eq('id', update.id);
          
          if (!error) technicalsUpdated++;
          
          // Small delay between tokens to avoid rate limiting
          await new Promise(r => setTimeout(r, 100));
        } catch (err) {
          console.error(`[sync-token-cards-polygon] Technicals error for ${ticker}:`, err);
        }
      }
      
      console.log(`[sync-token-cards-polygon] Updated technicals for ${technicalsUpdated} tokens`);
    }

    const duration = Date.now() - startTime;
    console.log(`[sync-token-cards-polygon] Sync complete in ${duration}ms: ${updated} prices, ${technicalsUpdated} technicals`);

    return new Response(JSON.stringify({
      success: true,
      stats: {
        call_number: callCount,
        tiers_fetched: tiers,
        tokens_queried: tokens.length,
        polygon_tickers: tickers.length,
        prices_updated: updated,
        technicals_updated: technicalsUpdated,
        technicals_fetched: shouldFetchTechnicals,
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
