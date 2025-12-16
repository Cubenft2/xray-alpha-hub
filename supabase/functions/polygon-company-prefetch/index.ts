import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Priority stocks to ALWAYS fetch first (major tech + crypto-related equities)
const PRIORITY_STOCKS = [
  'AAPL', 'MSFT', 'GOOGL', 'GOOG', 'NVDA', 'META', 'TSLA', 'AMZN',
  'COIN', 'HOOD', 'MSTR', 'MARA', 'RIOT', 'CLSK', 'HUT', 'HIVE', 'BITF',
  'JPM', 'V', 'MA', 'BAC', 'GS', 'MS', 'BLK', 'SQ', 'PYPL'
];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const polygonKey = Deno.env.get('POLYGON_API_KEY');

    if (!polygonKey) {
      throw new Error('POLYGON_API_KEY not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    
    console.log('🚀 Polygon Company Details Prefetch starting (BULK MODE with PRIORITY STOCKS)...');

    // AGGRESSIVE MODE: Process ALL companies in single run (unlimited Polygon API)
    const body = await req.json().catch(() => ({}));
    const offset = body.offset || 0;
    const batchLimit = 5000; // ALL stocks in one run
    
    // STEP 1: Fetch priority stocks FIRST (always, regardless of cache)
    console.log(`📌 Fetching ${PRIORITY_STOCKS.length} priority stocks first...`);
    
    const priorityDetails: unknown[] = [];
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24 hour TTL
    
    for (const symbol of PRIORITY_STOCKS) {
      try {
        const url = `https://api.polygon.io/v3/reference/tickers/${symbol}?apiKey=${polygonKey}`;
        const response = await fetch(url);
        
        if (response.ok) {
          const data = await response.json();
          if (data.results) {
            const r = data.results;
            priorityDetails.push({
              ticker: symbol,
              name: r.name,
              description: r.description,
              market_cap: r.market_cap ? Math.round(r.market_cap) : null,
              employees: r.total_employees,
              headquarters: r.address ? {
                address1: r.address.address1,
                city: r.address.city,
                state: r.address.state,
                postal_code: r.address.postal_code,
              } : null,
              list_date: r.list_date,
              sector: r.sic_description?.split(' - ')?.[0] || null,
              industry: r.sic_description,
              sic_code: r.sic_code,
              sic_description: r.sic_description,
              website: r.homepage_url,
              logo_url: r.branding?.logo_url,
              icon_url: r.branding?.icon_url,
              cik: r.cik,
              fetched_at: new Date().toISOString(),
              expires_at: expiresAt,
            });
          }
        }
      } catch (error) {
        console.error(`❌ Priority stock ${symbol} error:`, error);
      }
    }
    
    // Upsert priority stocks immediately
    if (priorityDetails.length > 0) {
      const { error: priorityError } = await supabase
        .from('company_details')
        .upsert(priorityDetails, { onConflict: 'ticker', ignoreDuplicates: false });
      
      if (priorityError) {
        console.error('❌ Priority upsert error:', priorityError);
      } else {
        console.log(`✅ Upserted ${priorityDetails.length} priority stock details`);
      }
    }

    // Get stocks from polygon_assets joined with assets - the CORRECT source
    const { data: stocks, error: stockError } = await supabase
      .from('polygon_assets')
      .select(`
        asset_id,
        polygon_ticker,
        assets!inner (
          symbol,
          name
        )
      `)
      .eq('market', 'stocks')
      .eq('is_active', true)
      .order('polygon_ticker')
      .range(offset, offset + batchLimit - 1);

    if (stockError) {
      throw new Error(`Failed to fetch stocks from polygon_assets: ${stockError.message}`);
    }

    if (!stocks || stocks.length === 0) {
      console.log('✅ No more stocks to process');
      return new Response(
        JSON.stringify({ status: 'complete', message: 'All companies processed' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Extract symbols from joined data
    const stocksWithSymbols = stocks.map(s => ({
      symbol: (s.assets as any)?.symbol || s.polygon_ticker,
      polygon_ticker: s.polygon_ticker,
    }));

    // Check which stocks don't have cached company details or are expired
    const stockSymbols = stocksWithSymbols.map(s => s.symbol);
    const { data: existingDetails } = await supabase
      .from('company_details')
      .select('ticker, expires_at')
      .in('ticker', stockSymbols);

    const cachedTickers = new Set(
      (existingDetails || [])
        .filter(d => new Date(d.expires_at) > new Date())
        .map(d => d.ticker)
    );

    const stocksToFetch = stocksWithSymbols.filter(s => !cachedTickers.has(s.symbol));

    console.log(`📊 Fetching company details for ${stocksToFetch.length} stocks (offset: ${offset}, ${cachedTickers.size} cached)`);

    if (stocksToFetch.length === 0) {
      return new Response(
        JSON.stringify({ 
          status: 'success', 
          fetched: 0, 
          cached: cachedTickers.size,
          offset: offset,
          next_offset: offset + stocks.length,
          has_more: stocks.length === batchLimit
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const fetchBatchSize = 100; // 100 parallel requests (200 may cause connection resets)
    let successCount = 0;
    let errorCount = 0;
    const companyDetails: unknown[] = [];

    // expiresAt already declared above for priority stocks

    for (let i = 0; i < stocksToFetch.length; i += fetchBatchSize) {
      const batch = stocksToFetch.slice(i, i + fetchBatchSize);
      
      const promises = batch.map(async (stock) => {
        try {
          const url = `https://api.polygon.io/v3/reference/tickers/${stock.symbol}?apiKey=${polygonKey}`;
          const response = await fetch(url);
          
          if (!response.ok) {
            if (response.status !== 404) {
              console.warn(`⚠️ Failed to fetch ${stock.symbol}: ${response.status}`);
            }
            return null;
          }

          const data = await response.json();
          
          if (data.results) {
            const r = data.results;
            return {
              ticker: stock.symbol,
              name: r.name,
              description: r.description,
              market_cap: r.market_cap ? Math.round(r.market_cap) : null, // Convert to integer for bigint column
              employees: r.total_employees,
              headquarters: r.address ? {
                address1: r.address.address1,
                city: r.address.city,
                state: r.address.state,
                postal_code: r.address.postal_code,
              } : null,
              list_date: r.list_date,
              sector: r.sic_description?.split(' - ')?.[0] || null,
              industry: r.sic_description,
              sic_code: r.sic_code,
              sic_description: r.sic_description,
              website: r.homepage_url,
              logo_url: r.branding?.logo_url,
              icon_url: r.branding?.icon_url,
              cik: r.cik,
              fetched_at: new Date().toISOString(),
              expires_at: expiresAt,
            };
          }
          
          return null;
        } catch (error) {
          console.error(`❌ Error fetching ${stock.symbol}:`, error);
          return null;
        }
      });

      const results = await Promise.all(promises);
      
      for (const result of results) {
        if (result) {
          companyDetails.push(result);
          successCount++;
        } else {
          errorCount++;
        }
      }

      // Small delay between batches to avoid connection resets
      if (i + fetchBatchSize < stocksToFetch.length) {
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }

    // Batch upsert company details
    if (companyDetails.length > 0) {
      const { error: upsertError } = await supabase
        .from('company_details')
        .upsert(companyDetails, { onConflict: 'ticker', ignoreDuplicates: false });

      if (upsertError) {
        console.error('❌ Upsert error:', upsertError);
      } else {
        console.log(`✅ Cached ${companyDetails.length} company details`);
      }
    }

    const duration = Date.now() - startTime;
    const nextOffset = offset + stocks.length;
    const hasMore = stocks.length === batchLimit;
    
    console.log(`🏁 Completed in ${duration}ms: ${successCount} fetched, ${errorCount} errors`);

    return new Response(
      JSON.stringify({
        status: 'success',
        stocks_checked: stocks.length,
        companies_fetched: successCount,
        already_cached: cachedTickers.size,
        errors: errorCount,
        offset: offset,
        next_offset: hasMore ? nextOffset : null,
        has_more: hasMore,
        duration_ms: duration,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Polygon Company Prefetch error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
