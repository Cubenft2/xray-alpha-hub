import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const PRIORITY_STOCKS = [
  'AAPL', 'MSFT', 'GOOGL', 'GOOG', 'META', 'NVDA', 'TSLA', 'AMZN', 'BRK.A', 'BRK.B',
  'JPM', 'V', 'UNH', 'MA', 'HD', 'PG', 'XOM', 'JNJ', 'COST', 'ABBV',
  'COIN', 'MSTR', 'MARA', 'RIOT', 'CLSK', 'HOOD', 'SQ', 'PYPL',
  'AMD', 'INTC', 'CRM', 'ORCL', 'ADBE', 'NFLX', 'DIS', 'BAC', 'WMT', 'KO', 'PEP'
];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const polygonKey = Deno.env.get('POLYGON_API_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json().catch(() => ({}));
    const batchSize = body.batch_size || 50;
    const forceRefresh = body.force_refresh || false;

    console.log('🚀 sync-stock-cards-52week: Starting 52-week high/low sync...');

    // Get stocks that need 52-week data
    let query = supabase
      .from('stock_cards')
      .select('symbol')
      .eq('is_active', true);

    if (!forceRefresh) {
      query = query.is('high_52w', null);
    }

    const { data: stocksNeedingData, error: fetchError } = await query.limit(batchSize + PRIORITY_STOCKS.length);

    if (fetchError) {
      throw new Error(`Failed to fetch stocks: ${fetchError.message}`);
    }

    // Prioritize: priority stocks first, then others
    const needingDataSymbols = new Set(stocksNeedingData?.map(s => s.symbol) || []);
    const priorityNeedingData = PRIORITY_STOCKS.filter(s => needingDataSymbols.has(s) || forceRefresh);
    const othersNeedingData = (stocksNeedingData || [])
      .map(s => s.symbol)
      .filter(s => !PRIORITY_STOCKS.includes(s));

    const symbolsToProcess = [...priorityNeedingData, ...othersNeedingData].slice(0, batchSize);

    if (symbolsToProcess.length === 0) {
      console.log('✅ All stocks already have 52-week data');
      return new Response(JSON.stringify({
        success: true,
        message: 'All stocks already have 52-week data',
        processed: 0,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`📊 Processing ${symbolsToProcess.length} stocks (${priorityNeedingData.length} priority)`);

    // Calculate date range (1 year ago to today)
    const today = new Date();
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

    const toDate = today.toISOString().split('T')[0];
    const fromDate = oneYearAgo.toISOString().split('T')[0];

    let processed = 0;
    let updated = 0;
    let errors = 0;
    const updates: any[] = [];

    for (const symbol of symbolsToProcess) {
      try {
        // Fetch 1 year of daily candles from Polygon
        const url = `https://api.polygon.io/v2/aggs/ticker/${symbol}/range/1/day/${fromDate}/${toDate}?adjusted=true&sort=asc&limit=365&apiKey=${polygonKey}`;
        
        const response = await fetch(url);
        
        if (!response.ok) {
          console.warn(`⚠️ ${symbol}: HTTP ${response.status}`);
          errors++;
          continue;
        }

        const data = await response.json();

        if (data.resultsCount === 0 || !data.results || data.results.length === 0) {
          console.warn(`⚠️ ${symbol}: No historical data`);
          errors++;
          continue;
        }

        const results = data.results;

        // Calculate 52-week high and low with dates
        let high52w = -Infinity;
        let low52w = Infinity;
        let high52wDate: string | null = null;
        let low52wDate: string | null = null;

        for (const candle of results) {
          if (candle.h > high52w) {
            high52w = candle.h;
            high52wDate = new Date(candle.t).toISOString().split('T')[0];
          }
          if (candle.l < low52w) {
            low52w = candle.l;
            low52wDate = new Date(candle.t).toISOString().split('T')[0];
          }
        }

        if (high52w !== -Infinity && low52w !== Infinity) {
          updates.push({
            symbol,
            high_52w: parseFloat(high52w.toFixed(2)),
            low_52w: parseFloat(low52w.toFixed(2)),
            high_52w_date: high52wDate,
            low_52w_date: low52wDate,
            updated_at: new Date().toISOString(),
          });
          processed++;
        }

        // Rate limiting: 200ms between API calls (5 calls/sec = 300 calls/min)
        await new Promise(resolve => setTimeout(resolve, 200));

      } catch (err) {
        console.error(`❌ ${symbol}: ${err.message}`);
        errors++;
      }
    }

    // Batch upsert updates
    if (updates.length > 0) {
      const { error: upsertError } = await supabase
        .from('stock_cards')
        .upsert(updates, { onConflict: 'symbol', ignoreDuplicates: false });

      if (upsertError) {
        console.error('❌ Upsert error:', upsertError.message);
      } else {
        updated = updates.length;
        console.log(`✅ Updated ${updated} stocks with 52-week data`);
      }
    }

    // Log API call
    try {
      await supabase.from('external_api_calls').insert({
        api_name: 'polygon',
        function_name: 'sync-stock-cards-52week',
        call_count: processed,
        success: errors === 0,
      });
    } catch (e) {
      // Ignore logging errors
    }

    const duration = Date.now() - startTime;

    // Count remaining stocks needing data
    const { count: remainingCount } = await supabase
      .from('stock_cards')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true)
      .is('high_52w', null);

    console.log(`✅ sync-stock-cards-52week complete: ${updated} updated, ${errors} errors, ${remainingCount || 0} remaining in ${duration}ms`);

    return new Response(JSON.stringify({
      success: true,
      processed,
      updated,
      errors,
      remaining: remainingCount || 0,
      duration_ms: duration,
      sample: updates.slice(0, 3).map(u => ({ symbol: u.symbol, high: u.high_52w, low: u.low_52w })),
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ sync-stock-cards-52week error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
