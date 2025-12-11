import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('🚀 Starting stock snapshot sync from live_prices...');

    // Read from live_prices table - ONLY stock tickers (NOT X: or C: prefix)
    // Stock tickers are pure alphabetic like AAPL, MSFT, NVDA
    console.log('🔄 Reading STOCK prices from live_prices table (non-crypto only)...');
    const { data: livePrices, error: livePricesError } = await supabase
      .from('live_prices')
      .select(`
        ticker,
        price,
        change24h,
        display,
        asset_id,
        updated_at
      `)
      .eq('source', 'polygon')
      .not('ticker', 'like', 'X:%')
      .not('ticker', 'like', 'C:%')
      .not('price', 'is', null);

    if (livePricesError) {
      throw new Error(`Failed to fetch live_prices: ${livePricesError.message}`);
    }

    console.log(`📊 Found ${livePrices?.length || 0} stock prices in live_prices table`);

    if (!livePrices || livePrices.length === 0) {
      return new Response(JSON.stringify({ 
        success: true, 
        count: 0,
        message: 'No stock prices found in live_prices table'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Filter to valid stock tickers (1-5 uppercase letters only)
    const validStockTickers = livePrices.filter(p => /^[A-Z]{1,5}$/.test(p.ticker));
    console.log(`📊 Valid stock tickers: ${validStockTickers.length} (filtered from ${livePrices.length})`);

    // Get company details for enrichment
    const tickerList = validStockTickers.map(p => p.ticker);
    const { data: companyDetails } = await supabase
      .from('company_details')
      .select('ticker, name, sector, industry, logo_url, market_cap')
      .in('ticker', tickerList);

    // Create company lookup map
    const companyMap = new Map<string, {
      name: string;
      sector: string | null;
      industry: string | null;
      logo_url: string | null;
      market_cap: number | null;
    }>();
    
    companyDetails?.forEach(c => {
      companyMap.set(c.ticker, {
        name: c.name || c.ticker,
        sector: c.sector,
        industry: c.industry,
        logo_url: c.logo_url,
        market_cap: c.market_cap,
      });
    });

    console.log(`📚 Loaded ${companyMap.size} company details for enrichment`);

    // Format data for stock_snapshot table
    const snapshotRows = validStockTickers.map(p => {
      const company = companyMap.get(p.ticker);
      
      return {
        symbol: p.ticker,
        ticker: p.ticker,
        name: company?.name || p.display || p.ticker,
        price: p.price,
        change_24h: 0,
        change_percent: p.change24h || 0,
        volume_24h: 0,
        sector: company?.sector || null,
        industry: company?.industry || null,
        logo_url: company?.logo_url || null,
        market_cap: company?.market_cap || null,
        asset_id: p.asset_id,
        updated_at: new Date().toISOString(),
      };
    });

    console.log(`📝 Upserting ${snapshotRows.length} rows to stock_snapshot table...`);

    // Batch upsert in chunks of 500
    const BATCH_SIZE = 500;
    let totalUpserted = 0;

    for (let i = 0; i < snapshotRows.length; i += BATCH_SIZE) {
      const batch = snapshotRows.slice(i, i + BATCH_SIZE);
      const { error: upsertError } = await supabase
        .from('stock_snapshot')
        .upsert(batch, { onConflict: 'symbol' });

      if (upsertError) {
        console.error(`❌ Batch upsert error:`, upsertError);
      } else {
        totalUpserted += batch.length;
      }
    }

    console.log(`✅ Successfully synced ${totalUpserted} stock snapshots from live_prices`);

    return new Response(JSON.stringify({ 
      success: true, 
      count: totalUpserted,
      source: 'live_prices',
      companiesEnriched: companyMap.size,
      message: `Synced ${totalUpserted} stock snapshots from live_prices table`
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
