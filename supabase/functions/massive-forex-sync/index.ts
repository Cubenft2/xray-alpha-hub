import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PolygonTicker {
  ticker: string;
  name: string;
  market: string;
  locale: string;
  active: boolean;
  currency_symbol?: string;
  base_currency_symbol?: string;
  base_currency_name?: string;
  currency_name?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const apiKey = Deno.env.get('MASSIVE_API_KEY') || Deno.env.get('POLYGON_API_KEY');

    if (!apiKey) {
      throw new Error('MASSIVE_API_KEY or POLYGON_API_KEY not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    
    console.log('🚀 Massive Forex Sync starting...');

    // Fetch all forex tickers from reference endpoint
    const baseUrl = Deno.env.get('MASSIVE_BASE_URL') || 'https://api.polygon.io';
    let allTickers: PolygonTicker[] = [];
    let cursor: string | null = null;
    let page = 0;

    do {
      const url = cursor 
        ? `${baseUrl}/v3/reference/tickers?market=fx&active=true&limit=1000&cursor=${cursor}&apiKey=${apiKey}`
        : `${baseUrl}/v3/reference/tickers?market=fx&active=true&limit=1000&apiKey=${apiKey}`;
      
      console.log(`📡 Fetching forex tickers page ${++page}...`);
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`Tickers API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const tickers = data.results || [];
      allTickers = [...allTickers, ...tickers];
      
      cursor = data.next_url ? new URL(data.next_url).searchParams.get('cursor') : null;
      
      console.log(`📊 Page ${page}: ${tickers.length} tickers (total: ${allTickers.length})`);
      
      // Small delay between pages
      if (cursor) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    } while (cursor);

    console.log(`📊 Total forex tickers fetched: ${allTickers.length}`);

    // Process tickers into assets format
    const now = new Date().toISOString();
    const assetInserts: any[] = [];
    const forexPairsInserts: any[] = [];

    for (const ticker of allTickers) {
      if (!ticker.ticker?.startsWith('C:')) continue;
      
      // Extract raw symbol from C:EURUSD -> EURUSD
      const rawSymbol = ticker.ticker.replace('C:', '');
      
      // Create display symbol (EUR/USD) for human readability
      const displaySymbol = rawSymbol.length === 6 
        ? `${rawSymbol.slice(0, 3)}/${rawSymbol.slice(3)}` 
        : rawSymbol;
      
      // Base and quote currencies
      const baseCurrency = rawSymbol.length >= 3 ? rawSymbol.slice(0, 3) : null;
      const quoteCurrency = rawSymbol.length >= 6 ? rawSymbol.slice(3, 6) : null;

      // Use raw symbol (EURUSD) for assets table to avoid special character issues
      assetInserts.push({
        symbol: rawSymbol,              // EURUSD (no slash - this is the unique key)
        display_symbol: displaySymbol,  // EUR/USD (human readable)
        name: ticker.name || displaySymbol,
        type: 'forex',
        market: 'fx',
        provider: 'massive',
        active: ticker.active ?? true,
        logo_url: null,
        created_at: now,
        updated_at: now,
      });

      forexPairsInserts.push({
        ticker: ticker.ticker,
        name: ticker.name || displaySymbol,
        base_currency: baseCurrency,
        quote_currency: quoteCurrency,
        active: ticker.active ?? true,
        synced_at: now,
      });
    }

    console.log(`💱 Prepared ${assetInserts.length} forex assets for insert`);

    // Upsert to assets table with detailed error logging
    let assetsUpserted = 0;
    let assetsErrors = 0;
    if (assetInserts.length > 0) {
      const batchSize = 100;
      for (let i = 0; i < assetInserts.length; i += batchSize) {
        const batch = assetInserts.slice(i, i + batchSize);
        const batchNum = Math.floor(i / batchSize) + 1;
        
        const { error, count } = await supabase
          .from('assets')
          .upsert(batch, { 
            onConflict: 'symbol',
            ignoreDuplicates: false 
          })
          .select('id', { count: 'exact' });

        if (error) {
          console.error(`❌ Assets batch ${batchNum} error:`, JSON.stringify(error));
          console.error(`❌ First 2 items in failed batch:`, JSON.stringify(batch.slice(0, 2)));
          assetsErrors++;
        } else {
          assetsUpserted += count || batch.length;
          console.log(`✅ Batch ${batchNum}: upserted ${count || batch.length} forex assets`);
        }
      }
      console.log(`✅ Upserted ${assetsUpserted} forex assets (${assetsErrors} batch errors)`);
    }

    // Upsert to poly_fx_pairs table
    let pairsUpserted = 0;
    if (forexPairsInserts.length > 0) {
      const batchSize = 500;
      for (let i = 0; i < forexPairsInserts.length; i += batchSize) {
        const batch = forexPairsInserts.slice(i, i + batchSize);
        
        const { error } = await supabase
          .from('poly_fx_pairs')
          .upsert(batch, { 
            onConflict: 'ticker',
            ignoreDuplicates: false 
          });

        if (error) {
          console.error(`❌ Forex pairs upsert batch error:`, error);
        } else {
          pairsUpserted += batch.length;
        }
      }
      console.log(`✅ Upserted ${pairsUpserted} forex pairs`);
    }

    const duration = Date.now() - startTime;
    
    console.log(`🏁 Massive Forex Sync completed in ${duration}ms`);

    return new Response(
      JSON.stringify({
        status: 'success',
        tickers_fetched: allTickers.length,
        assets_upserted: assetsUpserted,
        assets_errors: assetsErrors,
        pairs_upserted: pairsUpserted,
        duration_ms: duration,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Massive Forex Sync error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
