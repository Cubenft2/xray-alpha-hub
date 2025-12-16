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

    console.log('🚀 sync-stock-cards: Starting COMPLETE stock master cards sync...');

    // Step 1: Get ALL stock symbols from polygon_assets using pagination
    const PAGE_SIZE = 1000;
    let allStockAssets: any[] = [];
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      const { data: pageData, error: pageError } = await supabase
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
        .range(offset, offset + PAGE_SIZE - 1);

      if (pageError) {
        throw new Error(`Failed to fetch stock assets (page ${offset}): ${pageError.message}`);
      }

      if (pageData && pageData.length > 0) {
        allStockAssets = allStockAssets.concat(pageData);
        offset += pageData.length;
        hasMore = pageData.length === PAGE_SIZE;
      } else {
        hasMore = false;
      }
    }

    const stockAssets = allStockAssets;
    console.log(`📊 Found ${stockAssets.length} stocks in polygon_assets (paginated)`);

    if (stockAssets.length === 0) {
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

    // Step 2: Get live prices from live_prices table (chunked to avoid query limits)
    const priceMap = new Map<string, any>();
    const CHUNK_SIZE = 500;
    
    for (let i = 0; i < stockSymbols.length; i += CHUNK_SIZE) {
      const chunk = stockSymbols.slice(i, i + CHUNK_SIZE);
      const { data: livePrices, error: pricesError } = await supabase
        .from('live_prices')
        .select('*')
        .in('ticker', chunk);

      if (pricesError) {
        console.warn(`⚠️ Failed to fetch live_prices chunk ${i}: ${pricesError.message}`);
      } else {
        livePrices?.forEach(p => priceMap.set(p.ticker, p));
      }
    }
    console.log(`💰 Loaded ${priceMap.size} live prices`);

    // Step 3: Get COMPLETE company details for enrichment (chunked)
    const companyMap = new Map<string, any>();
    
    for (let i = 0; i < stockSymbols.length; i += CHUNK_SIZE) {
      const chunk = stockSymbols.slice(i, i + CHUNK_SIZE);
      const { data: companyDetails, error: companyError } = await supabase
        .from('company_details')
        .select('*')
        .in('ticker', chunk);

      if (companyError) {
        console.warn(`⚠️ Failed to fetch company_details chunk ${i}: ${companyError.message}`);
      } else {
        companyDetails?.forEach(c => companyMap.set(c.ticker, c));
      }
    }
    console.log(`🏢 Loaded ${companyMap.size} company details`);

    // Step 4: Get 52-week high/low from price_history (last 365 days)
    const fiftyTwoWeekMap = new Map<string, { high: number; low: number }>();
    const oneYearAgo = new Date();
    oneYearAgo.setDate(oneYearAgo.getDate() - 365);
    
    for (let i = 0; i < stockSymbols.length; i += CHUNK_SIZE) {
      const chunk = stockSymbols.slice(i, i + CHUNK_SIZE);
      const { data: historyData, error: historyError } = await supabase
        .from('price_history')
        .select('ticker, high, low')
        .in('ticker', chunk)
        .eq('asset_type', 'stock')
        .gte('timestamp', oneYearAgo.toISOString());

      if (historyError) {
        console.warn(`⚠️ Failed to fetch price_history chunk ${i}: ${historyError.message}`);
      } else if (historyData) {
        // Aggregate high/low per ticker
        historyData.forEach(h => {
          const existing = fiftyTwoWeekMap.get(h.ticker);
          if (existing) {
            existing.high = Math.max(existing.high, h.high);
            existing.low = Math.min(existing.low, h.low);
          } else {
            fiftyTwoWeekMap.set(h.ticker, { high: h.high, low: h.low });
          }
        });
      }
    }
    console.log(`📈 Loaded 52-week ranges for ${fiftyTwoWeekMap.size} stocks`);

    // Step 5: Build COMPLETE stock_cards rows
    const stockCards: any[] = [];

    for (const stockAsset of stockAssets) {
      const symbol = (stockAsset.assets as any)?.symbol || stockAsset.polygon_ticker;
      if (!symbol) continue;

      const price = priceMap.get(symbol);
      const company = companyMap.get(symbol);
      const fiftyTwoWeek = fiftyTwoWeekMap.get(symbol);

      // Calculate EPS from latest financials
      let eps: number | null = null;
      let peRatio: number | null = null;
      let dividendYield: number | null = null;
      
      if (company?.last_financials && Array.isArray(company.last_financials) && company.last_financials.length > 0) {
        const latestFinancials = company.last_financials[0];
        // EPS from diluted EPS or basic EPS
        eps = latestFinancials.eps_diluted || latestFinancials.eps_basic || latestFinancials.eps || null;
        
        // Calculate PE ratio: price / EPS
        if (eps && eps > 0 && price?.price) {
          peRatio = parseFloat((price.price / eps).toFixed(2));
        }
      }

      // Calculate dividend yield from dividends array
      if (company?.dividends && Array.isArray(company.dividends) && company.dividends.length > 0 && price?.price) {
        // Get dividends from last 12 months
        const oneYearAgo = new Date();
        oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
        
        const annualDividends = company.dividends
          .filter((d: any) => d.ex_dividend_date && new Date(d.ex_dividend_date) >= oneYearAgo)
          .reduce((sum: number, d: any) => sum + (d.cash_amount || 0), 0);
        
        if (annualDividends > 0) {
          dividendYield = parseFloat(((annualDividends / price.price) * 100).toFixed(2));
        }
      }

      const card: any = {
        symbol: symbol,
        name: company?.name || (stockAsset.assets as any)?.name || symbol,
        
        // Identity - COMPLETE from company_details
        logo_url: company?.logo_url || null,
        icon_url: company?.icon_url || null,
        sector: company?.sector || null,
        industry: company?.industry || null,
        description: company?.description || null,
        employees: company?.employees || null,
        website: company?.website || null,
        headquarters: company?.headquarters || {},
        cik: company?.cik || null,
        sic_code: company?.sic_code || null,
        sic_description: company?.sic_description || null,
        list_date: company?.list_date || null,
        exchange: null, // Could be enriched later
        country: 'US', // Default to US stocks
        
        // Full financial data - JSONB arrays
        financials: company?.last_financials || [],
        dividends: company?.dividends || [],
        splits: company?.splits || [],
        related_companies: company?.related_companies || [],
        
        // Price data from live_prices
        price_usd: price?.price || null,
        open_price: price?.day_open || null,
        high_price: price?.day_high || null,
        low_price: price?.day_low || null,
        close_price: price?.price || null,
        previous_close: null, // Could calculate from history
        change_usd: null,
        change_pct: price?.change24h || null,
        volume: price?.volume ? Math.round(price.volume) : null,
        
        // Calculated fundamentals
        market_cap: company?.market_cap ? Math.round(company.market_cap) : null,
        pe_ratio: peRatio,
        eps: eps,
        dividend_yield: dividendYield,
        
        // 52-week range from price_history
        fifty_two_week_high: fiftyTwoWeek?.high || null,
        fifty_two_week_low: fiftyTwoWeek?.low || null,
        
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
        card.change_usd = parseFloat((card.price_usd - prevPrice).toFixed(4));
      }

      stockCards.push(card);
    }

    console.log(`📝 Prepared ${stockCards.length} COMPLETE stock cards for upsert`);

    // Step 6: Batch upsert to stock_cards
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
    
    // Count enrichment stats
    const withEps = stockCards.filter(c => c.eps !== null).length;
    const withPeRatio = stockCards.filter(c => c.pe_ratio !== null).length;
    const withDividendYield = stockCards.filter(c => c.dividend_yield !== null).length;
    const with52WeekRange = stockCards.filter(c => c.fifty_two_week_high !== null).length;
    const withDescription = stockCards.filter(c => c.description !== null).length;
    
    console.log(`✅ sync-stock-cards COMPLETE: ${totalUpserted} cards synced in ${duration}ms`);
    console.log(`📊 Enrichment: EPS=${withEps}, PE=${withPeRatio}, Div=${withDividendYield}, 52W=${with52WeekRange}, Desc=${withDescription}`);

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
      enrichment: {
        with_eps: withEps,
        with_pe_ratio: withPeRatio,
        with_dividend_yield: withDividendYield,
        with_52_week_range: with52WeekRange,
        with_description: withDescription,
      },
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
