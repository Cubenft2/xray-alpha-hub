import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CompanyDetails {
  ticker: string;
  name: string | null;
  description: string | null;
  sector: string | null;
  industry: string | null;
  market_cap: number | null;
  employees: number | null;
  headquarters: object;
  website: string | null;
  logo_url: string | null;
  icon_url: string | null;
  list_date: string | null;
  cik: string | null;
  sic_code: string | null;
  sic_description: string | null;
  last_financials: object[];
  dividends: object[];
  splits: object[];
  related_companies: object[];
}

async function fetchPolygonTickerDetails(ticker: string, apiKey: string): Promise<any> {
  try {
    const url = `https://api.polygon.io/v3/reference/tickers/${ticker}?apiKey=${apiKey}`;
    console.log(`[Polygon] Fetching ticker details for ${ticker}`);
    const response = await fetch(url);
    if (!response.ok) {
      console.log(`[Polygon] Ticker details failed: ${response.status}`);
      return null;
    }
    const data = await response.json();
    return data.results || null;
  } catch (error) {
    console.error(`[Polygon] Ticker details error:`, error);
    return null;
  }
}

async function fetchPolygonFinancials(ticker: string, apiKey: string): Promise<any[]> {
  try {
    const url = `https://api.polygon.io/vX/reference/financials?ticker=${ticker}&limit=4&sort=filing_date&order=desc&apiKey=${apiKey}`;
    console.log(`[Polygon] Fetching financials for ${ticker}`);
    const response = await fetch(url);
    if (!response.ok) {
      console.log(`[Polygon] Financials failed: ${response.status}`);
      return [];
    }
    const data = await response.json();
    return data.results || [];
  } catch (error) {
    console.error(`[Polygon] Financials error:`, error);
    return [];
  }
}

async function fetchPolygonDividends(ticker: string, apiKey: string): Promise<any[]> {
  try {
    const url = `https://api.polygon.io/v3/reference/dividends?ticker=${ticker}&limit=8&order=desc&apiKey=${apiKey}`;
    console.log(`[Polygon] Fetching dividends for ${ticker}`);
    const response = await fetch(url);
    if (!response.ok) {
      console.log(`[Polygon] Dividends failed: ${response.status}`);
      return [];
    }
    const data = await response.json();
    return data.results || [];
  } catch (error) {
    console.error(`[Polygon] Dividends error:`, error);
    return [];
  }
}

async function fetchPolygonSplits(ticker: string, apiKey: string): Promise<any[]> {
  try {
    const url = `https://api.polygon.io/v3/reference/splits?ticker=${ticker}&limit=10&order=desc&apiKey=${apiKey}`;
    console.log(`[Polygon] Fetching splits for ${ticker}`);
    const response = await fetch(url);
    if (!response.ok) {
      console.log(`[Polygon] Splits failed: ${response.status}`);
      return [];
    }
    const data = await response.json();
    return data.results || [];
  } catch (error) {
    console.error(`[Polygon] Splits error:`, error);
    return [];
  }
}

async function fetchPolygonRelatedCompanies(ticker: string, apiKey: string): Promise<any[]> {
  try {
    const url = `https://api.polygon.io/v1/related-companies/${ticker}?apiKey=${apiKey}`;
    console.log(`[Polygon] Fetching related companies for ${ticker}`);
    const response = await fetch(url);
    if (!response.ok) {
      console.log(`[Polygon] Related companies failed: ${response.status}`);
      return [];
    }
    const data = await response.json();
    return data.results || [];
  } catch (error) {
    console.error(`[Polygon] Related companies error:`, error);
    return [];
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { ticker, forceRefresh = false } = await req.json();
    
    if (!ticker) {
      return new Response(
        JSON.stringify({ error: 'Ticker is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const upperTicker = ticker.toUpperCase();
    console.log(`[Company Details] Processing request for ${upperTicker}, forceRefresh: ${forceRefresh}`);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const polygonApiKey = Deno.env.get('POLYGON_API_KEY');

    if (!polygonApiKey) {
      console.error('[Company Details] POLYGON_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'Polygon API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check cache first (unless force refresh)
    if (!forceRefresh) {
      const { data: cached, error: cacheError } = await supabase
        .from('company_details')
        .select('*')
        .eq('ticker', upperTicker)
        .gt('expires_at', new Date().toISOString())
        .maybeSingle();

      if (cached && !cacheError) {
        console.log(`[Company Details] Cache hit for ${upperTicker}`);
        return new Response(
          JSON.stringify({ data: cached, cached: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    console.log(`[Company Details] Cache miss for ${upperTicker}, fetching from Polygon...`);

    // Fetch all data in parallel
    const [tickerDetails, financials, dividends, splits, relatedCompanies] = await Promise.all([
      fetchPolygonTickerDetails(upperTicker, polygonApiKey),
      fetchPolygonFinancials(upperTicker, polygonApiKey),
      fetchPolygonDividends(upperTicker, polygonApiKey),
      fetchPolygonSplits(upperTicker, polygonApiKey),
      fetchPolygonRelatedCompanies(upperTicker, polygonApiKey),
    ]);

    if (!tickerDetails) {
      console.log(`[Company Details] No ticker details found for ${upperTicker}`);
      return new Response(
        JSON.stringify({ error: 'Company not found', ticker: upperTicker }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build company details object
    const companyDetails: CompanyDetails = {
      ticker: upperTicker,
      name: tickerDetails.name || null,
      description: tickerDetails.description || null,
      sector: tickerDetails.sector || null,
      industry: tickerDetails.industry || null,
      market_cap: tickerDetails.market_cap || null,
      employees: tickerDetails.total_employees || null,
      headquarters: {
        address: tickerDetails.address?.address1 || null,
        city: tickerDetails.address?.city || null,
        state: tickerDetails.address?.state || null,
        postal_code: tickerDetails.address?.postal_code || null,
      },
      website: tickerDetails.homepage_url || null,
      logo_url: tickerDetails.branding?.logo_url ? `${tickerDetails.branding.logo_url}?apiKey=${polygonApiKey}` : null,
      icon_url: tickerDetails.branding?.icon_url ? `${tickerDetails.branding.icon_url}?apiKey=${polygonApiKey}` : null,
      list_date: tickerDetails.list_date || null,
      cik: tickerDetails.cik || null,
      sic_code: tickerDetails.sic_code || null,
      sic_description: tickerDetails.sic_description || null,
      last_financials: financials.map(f => ({
        fiscal_period: f.fiscal_period,
        fiscal_year: f.fiscal_year,
        filing_date: f.filing_date,
        revenue: f.financials?.income_statement?.revenues?.value || null,
        net_income: f.financials?.income_statement?.net_income_loss?.value || null,
        eps_basic: f.financials?.income_statement?.basic_earnings_per_share?.value || null,
        eps_diluted: f.financials?.income_statement?.diluted_earnings_per_share?.value || null,
        gross_profit: f.financials?.income_statement?.gross_profit?.value || null,
        operating_income: f.financials?.income_statement?.operating_income_loss?.value || null,
        total_assets: f.financials?.balance_sheet?.assets?.value || null,
        total_liabilities: f.financials?.balance_sheet?.liabilities?.value || null,
        cash_and_equivalents: f.financials?.balance_sheet?.current_assets?.value || null,
      })),
      dividends: dividends.map(d => ({
        ex_dividend_date: d.ex_dividend_date,
        pay_date: d.pay_date,
        record_date: d.record_date,
        cash_amount: d.cash_amount,
        frequency: d.frequency,
        dividend_type: d.dividend_type,
      })),
      splits: splits.map(s => ({
        execution_date: s.execution_date,
        split_from: s.split_from,
        split_to: s.split_to,
      })),
      related_companies: relatedCompanies.map(r => ({
        ticker: r.ticker,
      })),
    };

    // Upsert to cache
    const { error: upsertError } = await supabase
      .from('company_details')
      .upsert({
        ...companyDetails,
        fetched_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
      }, { onConflict: 'ticker' });

    if (upsertError) {
      console.error(`[Company Details] Cache upsert error:`, upsertError);
    } else {
      console.log(`[Company Details] Cached ${upperTicker} for 24 hours`);
    }

    return new Response(
      JSON.stringify({ data: companyDetails, cached: false }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[Company Details] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});