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

// Helper function to fetch complete company data including financials
async function fetchCompleteCompanyData(symbol: string, polygonKey: string): Promise<any | null> {
  try {
    // Fetch all endpoints in parallel (UNLIMITED API!)
    const [tickerRes, financialsRes, dividendsRes, splitsRes] = await Promise.all([
      fetch(`https://api.polygon.io/v3/reference/tickers/${symbol}?apiKey=${polygonKey}`),
      fetch(`https://api.polygon.io/vX/reference/financials?ticker=${symbol}&limit=4&apiKey=${polygonKey}`),
      fetch(`https://api.polygon.io/v3/reference/dividends?ticker=${symbol}&limit=12&apiKey=${polygonKey}`),
      fetch(`https://api.polygon.io/v3/reference/splits?ticker=${symbol}&limit=10&apiKey=${polygonKey}`),
    ]);

    // Parse ticker details
    let tickerData = null;
    if (tickerRes.ok) {
      const data = await tickerRes.json();
      tickerData = data.results;
    }

    if (!tickerData) return null;

    // Parse financials
    let financials: any[] = [];
    if (financialsRes.ok) {
      const data = await financialsRes.json();
      if (data.results && Array.isArray(data.results)) {
        financials = data.results.map((f: any) => ({
          fiscal_year: f.fiscal_year,
          fiscal_period: f.fiscal_period,
          filing_date: f.filing_date,
          revenue: f.financials?.income_statement?.revenues?.value,
          net_income: f.financials?.income_statement?.net_income_loss?.value,
          gross_profit: f.financials?.income_statement?.gross_profit?.value,
          operating_income: f.financials?.income_statement?.operating_income_loss?.value,
          eps_basic: f.financials?.income_statement?.basic_earnings_per_share?.value,
          eps_diluted: f.financials?.income_statement?.diluted_earnings_per_share?.value,
          total_assets: f.financials?.balance_sheet?.assets?.value,
          total_liabilities: f.financials?.balance_sheet?.liabilities?.value,
          cash_and_equivalents: f.financials?.balance_sheet?.current_assets?.value,
        }));
      }
    }

    // Parse dividends
    let dividends: any[] = [];
    if (dividendsRes.ok) {
      const data = await dividendsRes.json();
      if (data.results && Array.isArray(data.results)) {
        dividends = data.results.map((d: any) => ({
          ex_dividend_date: d.ex_dividend_date,
          pay_date: d.pay_date,
          record_date: d.record_date,
          cash_amount: d.cash_amount,
          frequency: d.frequency,
          dividend_type: d.dividend_type,
        }));
      }
    }

    // Parse splits
    let splits: any[] = [];
    if (splitsRes.ok) {
      const data = await splitsRes.json();
      if (data.results && Array.isArray(data.results)) {
        splits = data.results.map((s: any) => ({
          execution_date: s.execution_date,
          split_from: s.split_from,
          split_to: s.split_to,
        }));
      }
    }

    const r = tickerData;
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    return {
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
      // NEW: Full financial data
      last_financials: financials.length > 0 ? financials : null,
      dividends: dividends.length > 0 ? dividends : null,
      splits: splits.length > 0 ? splits : null,
      fetched_at: new Date().toISOString(),
      expires_at: expiresAt,
    };
  } catch (error) {
    console.error(`❌ Error fetching complete data for ${symbol}:`, error);
    return null;
  }
}

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
    
    console.log('🚀 Polygon Company Details Prefetch starting (COMPLETE DATA MODE with financials/dividends/splits)...');

    const body = await req.json().catch(() => ({}));
    const offset = body.offset || 0;
    const batchLimit = 5000;
    const forceRefresh = body.force_refresh || false;

    // If force_refresh, expire ALL cache to refetch with full financials
    if (forceRefresh) {
      console.log('🔄 Force refresh: Expiring ALL company_details cache...');
      const { error: expireError } = await supabase
        .from('company_details')
        .update({ expires_at: new Date(Date.now() - 3600000).toISOString() })
        .neq('ticker', ''); // Update all rows
      
      if (expireError) {
        console.error('❌ Cache expire error:', expireError);
      } else {
        console.log(`✅ Expired ALL company_details cache`);
      }
    }
    
    // STEP 1: Fetch priority stocks FIRST with COMPLETE data
    console.log(`📌 Fetching ${PRIORITY_STOCKS.length} priority stocks with FULL financials...`);
    
    const priorityPromises = PRIORITY_STOCKS.map(symbol => 
      fetchCompleteCompanyData(symbol, polygonKey)
    );
    const priorityResults = await Promise.all(priorityPromises);
    const priorityDetails = priorityResults.filter(r => r !== null);
    
    if (priorityDetails.length > 0) {
      const { error: priorityError } = await supabase
        .from('company_details')
        .upsert(priorityDetails, { onConflict: 'ticker', ignoreDuplicates: false });
      
      if (priorityError) {
        console.error('❌ Priority upsert error:', priorityError);
      } else {
        const withFinancials = priorityDetails.filter((d: any) => d.last_financials?.length > 0).length;
        const withDividends = priorityDetails.filter((d: any) => d.dividends?.length > 0).length;
        console.log(`✅ Upserted ${priorityDetails.length} priority stocks (${withFinancials} with financials, ${withDividends} with dividends)`);
      }
    }

    // Get stocks from polygon_assets
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

    console.log(`📊 Fetching COMPLETE company data for ${stocksToFetch.length} stocks (${cachedTickers.size} cached)`);

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

    // Fetch in batches of 50 (4 API calls per stock = 200 concurrent requests)
    const fetchBatchSize = 50;
    let successCount = 0;
    let errorCount = 0;
    let withFinancialsCount = 0;
    let withDividendsCount = 0;
    const companyDetails: unknown[] = [];

    for (let i = 0; i < stocksToFetch.length; i += fetchBatchSize) {
      const batch = stocksToFetch.slice(i, i + fetchBatchSize);
      
      const promises = batch.map(stock => fetchCompleteCompanyData(stock.symbol, polygonKey));
      const results = await Promise.all(promises);
      
      for (const result of results) {
        if (result) {
          companyDetails.push(result);
          successCount++;
          if (result.last_financials?.length > 0) withFinancialsCount++;
          if (result.dividends?.length > 0) withDividendsCount++;
        } else {
          errorCount++;
        }
      }

      // Progress log every 500 stocks
      if ((i + fetchBatchSize) % 500 === 0 || i + fetchBatchSize >= stocksToFetch.length) {
        console.log(`📈 Progress: ${Math.min(i + fetchBatchSize, stocksToFetch.length)}/${stocksToFetch.length} stocks processed`);
      }

      // Small delay between batches
      if (i + fetchBatchSize < stocksToFetch.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    // Batch upsert company details
    if (companyDetails.length > 0) {
      const UPSERT_BATCH = 500;
      for (let i = 0; i < companyDetails.length; i += UPSERT_BATCH) {
        const batch = companyDetails.slice(i, i + UPSERT_BATCH);
        const { error: upsertError } = await supabase
          .from('company_details')
          .upsert(batch, { onConflict: 'ticker', ignoreDuplicates: false });

        if (upsertError) {
          console.error(`❌ Upsert batch ${i} error:`, upsertError);
        }
      }
      console.log(`✅ Cached ${companyDetails.length} COMPLETE company details`);
    }

    const duration = Date.now() - startTime;
    const nextOffset = offset + stocks.length;
    const hasMore = stocks.length === batchLimit;
    
    console.log(`🏁 Completed in ${duration}ms: ${successCount} fetched (${withFinancialsCount} with financials, ${withDividendsCount} with dividends), ${errorCount} errors`);

    // Log API call
    try {
      await supabase.from('external_api_calls').insert({
        api_name: 'polygon',
        function_name: 'polygon-company-prefetch',
        call_count: successCount * 4, // 4 endpoints per stock
        success: true,
      });
    } catch (e) {
      // Ignore logging errors
    }

    return new Response(
      JSON.stringify({
        status: 'success',
        stocks_checked: stocks.length,
        companies_fetched: successCount,
        with_financials: withFinancialsCount,
        with_dividends: withDividendsCount,
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
