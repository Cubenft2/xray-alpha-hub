import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Parse Polygon crypto ticker to canonical symbol and quote currency
function parsePolygonCryptoTicker(ticker: string): { canonical: string; quote: string } {
  const raw = ticker.replace('X:', '');
  const quotes = ['USDT', 'USDC', 'USD', 'EUR', 'GBP', 'AUD', 'JPY', 'BTC', 'ETH'];
  for (const quote of quotes) {
    if (raw.endsWith(quote)) {
      return { 
        canonical: raw.slice(0, -quote.length), 
        quote 
      };
    }
  }
  return { canonical: raw, quote: 'UNKNOWN' };
}

// Simple currency conversion rates (approximate, for non-USD pairs)
const CONVERSION_RATES: Record<string, number> = {
  'USD': 1,
  'USDT': 1,
  'USDC': 1,
  'EUR': 1.08,
  'GBP': 1.27,
  'AUD': 0.65,
  'JPY': 0.0067,
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  console.log('[sync-polygon-crypto-snapshot] Starting snapshot sync...');

  try {
    const POLYGON_API_KEY = Deno.env.get('POLYGON_API_KEY');
    if (!POLYGON_API_KEY) {
      throw new Error('POLYGON_API_KEY not configured');
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Fetch unified crypto snapshot
    const snapshotUrl = `https://api.polygon.io/v2/snapshot/locale/global/markets/crypto/tickers?apiKey=${POLYGON_API_KEY}`;
    console.log('[sync-polygon-crypto-snapshot] Fetching snapshot...');
    
    const response = await fetch(snapshotUrl);
    if (!response.ok) {
      throw new Error(`Polygon API error: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    const tickers = data.tickers || [];
    
    console.log(`[sync-polygon-crypto-snapshot] Received ${tickers.length} tickers from snapshot`);

    // Group by canonical symbol and find best ticker (highest volume, prefer USD)
    const symbolMap = new Map<string, {
      bestTicker: any;
      allTickers: string[];
      quote: string;
    }>();

    for (const ticker of tickers) {
      const { canonical, quote } = parsePolygonCryptoTicker(ticker.ticker);
      
      if (!canonical || canonical.length === 0) continue;
      
      const volume = ticker.day?.v || 0;
      
      if (!symbolMap.has(canonical)) {
        symbolMap.set(canonical, {
          bestTicker: ticker,
          allTickers: [ticker.ticker],
          quote
        });
      } else {
        const existing = symbolMap.get(canonical)!;
        existing.allTickers.push(ticker.ticker);
        
        // Prefer USD pairs, then by volume
        const existingQuotePriority = ['USD', 'USDT', 'USDC'].indexOf(existing.quote);
        const newQuotePriority = ['USD', 'USDT', 'USDC'].indexOf(quote);
        
        const shouldReplace = 
          (newQuotePriority >= 0 && existingQuotePriority < 0) ||
          (newQuotePriority === existingQuotePriority && volume > (existing.bestTicker.day?.v || 0)) ||
          (existingQuotePriority < 0 && newQuotePriority < 0 && volume > (existing.bestTicker.day?.v || 0));
        
        if (shouldReplace) {
          existing.bestTicker = ticker;
          existing.quote = quote;
        }
      }
    }

    console.log(`[sync-polygon-crypto-snapshot] Grouped into ${symbolMap.size} canonical symbols`);

    // Prepare upsert records
    const now = new Date().toISOString();
    const activeSymbols: string[] = [];
    
    const records = Array.from(symbolMap.entries()).map(([canonical, data]) => {
      activeSymbols.push(canonical);
      
      const t = data.bestTicker;
      const day = t.day || {};
      const prevDay = t.prevDay || {};
      const quote = data.quote;
      
      // Convert to USD if needed
      const conversionRate = CONVERSION_RATES[quote] || 1;
      const priceUsd = t.lastTrade?.p ? t.lastTrade.p * conversionRate : (day.c ? day.c * conversionRate : null);
      
      // Calculate spread percentage
      let spreadPct = null;
      if (t.lastQuote?.a && t.lastQuote?.b && t.lastQuote.a > 0) {
        spreadPct = ((t.lastQuote.a - t.lastQuote.b) / t.lastQuote.a) * 100;
      }
      
      // Calculate 24h change percentage
      let change24hPct = null;
      if (prevDay.c && day.c) {
        change24hPct = ((day.c - prevDay.c) / prevDay.c) * 100;
      }

      return {
        canonical_symbol: canonical,
        polygon_tickers: data.allTickers,
        primary_ticker: t.ticker,
        in_snapshot: true,
        is_active: true,
        price_usd: priceUsd,
        price_source_ticker: t.ticker,
        open_24h: day.o ? day.o * conversionRate : null,
        high_24h: day.h ? day.h * conversionRate : null,
        low_24h: day.l ? day.l * conversionRate : null,
        close_24h: day.c ? day.c * conversionRate : null,
        volume_24h: day.v || null,
        vwap_24h: day.vw ? day.vw * conversionRate : null,
        change_24h_pct: change24hPct,
        bid_price: t.lastQuote?.b ? t.lastQuote.b * conversionRate : null,
        ask_price: t.lastQuote?.a ? t.lastQuote.a * conversionRate : null,
        spread_pct: spreadPct,
        last_trade_at: t.lastTrade?.t ? new Date(t.lastTrade.t).toISOString() : null,
        price_updated_at: now,
        updated_at: now
      };
    });

    // Step 1: Mark all currently-active records as inactive FIRST
    console.log('[sync-polygon-crypto-snapshot] Resetting active flags...');
    const { error: resetError } = await supabase
      .from('polygon_crypto_cards')
      .update({ in_snapshot: false, is_active: false, updated_at: now })
      .eq('in_snapshot', true);

    if (resetError) {
      console.warn('[sync-polygon-crypto-snapshot] Reset error:', resetError);
    }

    // Step 2: Batch upsert active records (will set is_active=true, in_snapshot=true)
    const batchSize = 500;
    let upsertedCount = 0;
    
    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);
      
      const { error } = await supabase
        .from('polygon_crypto_cards')
        .upsert(batch, { 
          onConflict: 'canonical_symbol',
          ignoreDuplicates: false 
        });
      
      if (error) {
        console.error(`[sync-polygon-crypto-snapshot] Batch upsert error:`, error);
        throw error;
      }
      
      upsertedCount += batch.length;
    }

    console.log(`[sync-polygon-crypto-snapshot] Upserted ${upsertedCount} active records`);

    // Count how many remain inactive (reference-only tickers not in snapshot)
    const { count: inactiveCount } = await supabase
      .from('polygon_crypto_cards')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', false);

    console.log(`[sync-polygon-crypto-snapshot] ${inactiveCount || 0} records remain inactive (reference-only)`);

    const duration = Date.now() - startTime;
    const result = {
      success: true,
      snapshotTickers: tickers.length,
      canonicalSymbols: symbolMap.size,
      upsertedRecords: upsertedCount,
      markedInactive: inactiveCount,
      durationMs: duration
    };

    console.log(`[sync-polygon-crypto-snapshot] Complete:`, result);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[sync-polygon-crypto-snapshot] Error:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
