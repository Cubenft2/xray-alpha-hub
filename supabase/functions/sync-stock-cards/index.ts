import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('🚀 sync-stock-cards: Starting stock master cards sync...');

    // Step 1: Get all stock symbols from polygon_assets
    const { data: stockAssets, error: assetsError } = await supabase
      .from('polygon_assets')
      .select(`
        asset_id,
        polygon_ticker,
        assets!inner (
          id,
          symbol,
          name
        )
      `)
      .eq('market', 'stocks')
      .eq('is_active', true)
      .range(0, 5000); // Get ALL stocks (bypasses 1000 row default limit)

    if (assetsError) {
      throw new Error(`Failed to fetch stock assets: ${assetsError.message}`);
    }

    console.log(`📊 Found ${stockAssets?.length || 0} stocks in polygon_assets`);

    if (!stockAssets || stockAssets.length === 0) {
      return new Response(JSON.stringify({ 
        success: true, 
        count: 0,
        message: 'No stocks found in polygon_assets'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Extract symbols
    const stockSymbols = stockAssets.map(s => (s.assets as any)?.symbol || s.polygon_ticker).filter(Boolean);

    // Step 2: Get live prices from live_prices table
    const { data: livePrices, error: pricesError } = await supabase
      .from('live_prices')
      .select('*')
      .in('ticker', stockSymbols);

    if (pricesError) {
      console.warn(`⚠️ Failed to fetch live_prices: ${pricesError.message}`);
    }

    const priceMap = new Map<string, any>();
    livePrices?.forEach(p => priceMap.set(p.ticker, p));
    console.log(`💰 Loaded ${priceMap.size} live prices`);

    // Step 3: Get company details for enrichment
    const { data: companyDetails, error: companyError } = await supabase
      .from('company_details')
      .select('*')
      .in('ticker', stockSymbols);

    if (companyError) {
      console.warn(`⚠️ Failed to fetch company_details: ${companyError.message}`);
    }

    const companyMap = new Map<string, any>();
    companyDetails?.forEach(c => companyMap.set(c.ticker, c));
    console.log(`🏢 Loaded ${companyMap.size} company details`);

    // Step 4: Build stock_cards rows
    const stockCards: any[] = [];

    for (const stockAsset of stockAssets) {
      const symbol = (stockAsset.assets as any)?.symbol || stockAsset.polygon_ticker;
      if (!symbol) continue;

      const price = priceMap.get(symbol);
      const company = companyMap.get(symbol);

      const card: any = {
        symbol: symbol,
        name: company?.name || (stockAsset.assets as any)?.name || symbol,
        
        // Identity
        logo_url: company?.logo_url || null,
        sector: company?.sector || null,
        industry: company?.industry || null,
        exchange: null, // Could be enriched later
        country: 'US', // Default to US stocks
        
        // Price data from live_prices
        price_usd: price?.price || null,
        open_price: price?.day_open || null,
        high_price: price?.day_high || null,
        low_price: price?.day_low || null,
        close_price: price?.price || null,
        previous_close: null, // Could calculate from history
        change_usd: null,
        change_pct: price?.change24h || null,
        volume: price?.volume ? Math.round(price.volume) : null, // Round for bigint
        
        // Fundamentals from company_details
        market_cap: company?.market_cap ? Math.round(company.market_cap) : null, // Convert to integer for bigint column
        pe_ratio: null, // From financials
        eps: null, // From financials
        dividend_yield: null, // From dividends
        
        // 52-week range (could be calculated from history)
        fifty_two_week_high: null,
        fifty_two_week_low: null,
        
        // Timestamps
        price_updated_at: price?.updated_at || null,
        updated_at: new Date().toISOString(),
        
        // Status
        is_active: true,
        is_delayed: price?.is_delayed ?? true,
        tier: 2, // Default tier for stocks
      };

      // Calculate change_usd if we have price and change_pct
      if (card.price_usd && card.change_pct) {
        const prevPrice = card.price_usd / (1 + card.change_pct / 100);
        card.change_usd = card.price_usd - prevPrice;
      }

      stockCards.push(card);
    }

    console.log(`📝 Prepared ${stockCards.length} stock cards for upsert`);

    // Step 5: Batch upsert to stock_cards
    const BATCH_SIZE = 500;
    let totalUpserted = 0;
    let errors = 0;

    for (let i = 0; i < stockCards.length; i += BATCH_SIZE) {
      const batch = stockCards.slice(i, i + BATCH_SIZE);
      
      const { error: upsertError } = await supabase
        .from('stock_cards')
        .upsert(batch, { onConflict: 'symbol', ignoreDuplicates: false });

      if (upsertError) {
        console.error(`❌ Batch ${Math.floor(i / BATCH_SIZE) + 1} upsert error:`, upsertError.message);
        errors++;
      } else {
        totalUpserted += batch.length;
      }
    }

    const duration = Date.now() - startTime;
    console.log(`✅ sync-stock-cards complete: ${totalUpserted} cards synced in ${duration}ms`);

    // Log API call
    try {
      await supabase.from('external_api_calls').insert({
        api_name: 'supabase',
        function_name: 'sync-stock-cards',
        call_count: 1,
        success: errors === 0,
      });
    } catch (e) {
      // Ignore logging errors
    }

    return new Response(JSON.stringify({
      success: true,
      stocks_processed: stockCards.length,
      cards_upserted: totalUpserted,
      prices_loaded: priceMap.size,
      companies_loaded: companyMap.size,
      errors: errors,
      duration_ms: duration,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ sync-stock-cards error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
