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

// Fetch 52-week data for a single symbol
async function fetch52WeekData(symbol: string, fromDate: string, toDate: string, polygonKey: string): Promise<{
  symbol: string;
  high_52w: number;
  low_52w: number;
  high_52w_date: string | null;
  low_52w_date: string | null;
} | null> {
  try {
    const url = `https://api.polygon.io/v2/aggs/ticker/${symbol}/range/1/day/${fromDate}/${toDate}?adjusted=true&sort=asc&limit=365&apiKey=${polygonKey}`;
    const response = await fetch(url);
    
    if (!response.ok) {
      console.warn(`⚠️ ${symbol}: HTTP ${response.status}`);
      return null;
    }

    const data = await response.json();

    if (data.resultsCount === 0 || !data.results || data.results.length === 0) {
      return null;
    }

    let high52w = -Infinity;
    let low52w = Infinity;
    let high52wDate: string | null = null;
    let low52wDate: string | null = null;

    for (const candle of data.results) {
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
      return {
        symbol,
        high_52w: parseFloat(high52w.toFixed(2)),
        low_52w: parseFloat(low52w.toFixed(2)),
        high_52w_date: high52wDate,
        low_52w_date: low52wDate,
      };
    }
    return null;
  } catch (err) {
    console.error(`❌ ${symbol}: ${err.message}`);
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
    const polygonKey = Deno.env.get('POLYGON_API_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json().catch(() => ({}));
    const batchSize = body.batch_size || 200; // TURBO: increased from 50
    const forceRefresh = body.force_refresh || false;
    const parallelChunkSize = body.parallel_size || 5; // Process 5 requests in parallel

    console.log(`🚀 sync-stock-cards-52week: Starting TURBO MODE (batch=${batchSize}, parallel=${parallelChunkSize})...`);

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

    console.log(`📊 Processing ${symbolsToProcess.length} stocks (${priorityNeedingData.length} priority) in parallel chunks of ${parallelChunkSize}`);

    // Calculate date range (1 year ago to today)
    const today = new Date();
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

    const toDate = today.toISOString().split('T')[0];
    const fromDate = oneYearAgo.toISOString().split('T')[0];

    const updates: any[] = [];
    let errors = 0;

    // TURBO: Process in parallel chunks
    for (let i = 0; i < symbolsToProcess.length; i += parallelChunkSize) {
      const chunk = symbolsToProcess.slice(i, i + parallelChunkSize);
      
      const results = await Promise.all(
        chunk.map(symbol => fetch52WeekData(symbol, fromDate, toDate, polygonKey))
      );

      for (const result of results) {
        if (result) {
          updates.push({
            ...result,
            updated_at: new Date().toISOString(),
          });
        } else {
          errors++;
        }
      }

      // TURBO: Reduced delay between chunks (50ms instead of 200ms per request)
      if (i + parallelChunkSize < symbolsToProcess.length) {
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      // Progress log every 50 symbols
      if ((i + parallelChunkSize) % 50 === 0 || i + parallelChunkSize >= symbolsToProcess.length) {
        console.log(`📈 Progress: ${Math.min(i + parallelChunkSize, symbolsToProcess.length)}/${symbolsToProcess.length} (${updates.length} successful)`);
      }
    }

    // Batch upsert updates
    let updated = 0;
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
        call_count: symbolsToProcess.length,
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

    console.log(`✅ sync-stock-cards-52week TURBO complete: ${updated} updated, ${errors} errors, ${remainingCount || 0} remaining in ${duration}ms`);

    return new Response(JSON.stringify({
      success: true,
      processed: symbolsToProcess.length,
      updated,
      errors,
      remaining: remainingCount || 0,
      duration_ms: duration,
      turbo_mode: true,
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
