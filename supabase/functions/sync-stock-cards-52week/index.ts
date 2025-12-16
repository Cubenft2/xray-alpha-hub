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
    const batchSize = body.batch_size || 200;
    const forceRefresh = body.force_refresh || false;
    const parallelChunkSize = body.parallel_size || 5;
    const iteration = body.iteration || 1;
    const maxIterations = body.max_iterations || 25; // Safety cap to prevent infinite loops

    console.log(`🚀 sync-stock-cards-52week: TURBO MODE iteration ${iteration}/${maxIterations} (batch=${batchSize}, parallel=${parallelChunkSize})...`);

    // Step 1: Explicitly query priority stocks that need data
    let priorityQuery = supabase
      .from('stock_cards')
      .select('symbol')
      .in('symbol', PRIORITY_STOCKS)
      .eq('is_active', true);
    
    if (!forceRefresh) {
      priorityQuery = priorityQuery.is('high_52w', null);
    }

    const { data: priorityStocks, error: priorityError } = await priorityQuery;

    if (priorityError) {
      console.error('Priority stocks query error:', priorityError.message);
    }

    const prioritySymbols = priorityStocks?.map(s => s.symbol) || [];
    console.log(`📌 Priority stocks needing data: ${prioritySymbols.length} (${prioritySymbols.slice(0, 10).join(', ')}...)`);

    // Step 2: Get remaining stocks to fill batch (excluding priority stocks)
    const remainingBatchSize = Math.max(0, batchSize - prioritySymbols.length);
    let otherSymbols: string[] = [];

    if (remainingBatchSize > 0) {
      let otherQuery = supabase
        .from('stock_cards')
        .select('symbol')
        .eq('is_active', true)
        .not('symbol', 'in', `(${PRIORITY_STOCKS.join(',')})`)
        .limit(remainingBatchSize);

      if (!forceRefresh) {
        otherQuery = otherQuery.is('high_52w', null);
      }

      const { data: otherStocks, error: otherError } = await otherQuery;

      if (otherError) {
        console.error('Other stocks query error:', otherError.message);
      }

      otherSymbols = otherStocks?.map(s => s.symbol) || [];
    }

    // Step 3: Combine - priority first, then others
    const symbolsToProcess = [...prioritySymbols, ...otherSymbols];

    if (symbolsToProcess.length === 0) {
      console.log('✅ All stocks already have 52-week data - COMPLETE');
      return new Response(JSON.stringify({
        success: true,
        status: 'complete',
        message: 'All stocks already have 52-week data',
        processed: 0,
        iteration,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`📊 Processing ${symbolsToProcess.length} stocks (${prioritySymbols.length} priority + ${otherSymbols.length} others) in parallel chunks of ${parallelChunkSize}`);

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

    console.log(`✅ sync-stock-cards-52week iteration ${iteration}: ${updated} updated, ${errors} errors, ${remainingCount || 0} remaining in ${duration}ms`);

    // AUTO-LOOP: If there are remaining stocks and we haven't hit max iterations, trigger next batch
    const shouldContinue = (remainingCount || 0) > 0 && iteration < maxIterations;
    
    if (shouldContinue) {
      console.log(`🔄 Auto-continuing: ${remainingCount} stocks remaining, triggering iteration ${iteration + 1}...`);
      
      // Use EdgeRuntime.waitUntil for background continuation
      const nextBatchUrl = `${supabaseUrl}/functions/v1/sync-stock-cards-52week`;
      const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || supabaseKey;
      
      EdgeRuntime.waitUntil(
        fetch(nextBatchUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${anonKey}`,
          },
          body: JSON.stringify({
            batch_size: batchSize,
            parallel_size: parallelChunkSize,
            iteration: iteration + 1,
            max_iterations: maxIterations,
          }),
        }).then(res => {
          console.log(`🔗 Next batch triggered: HTTP ${res.status}`);
        }).catch(err => {
          console.error(`❌ Failed to trigger next batch: ${err.message}`);
        })
      );
    } else if ((remainingCount || 0) === 0) {
      console.log(`🎉 ALL COMPLETE: 52-week data populated for all stocks after ${iteration} iterations`);
    } else {
      console.log(`⚠️ MAX ITERATIONS (${maxIterations}) reached with ${remainingCount} stocks remaining`);
    }

    return new Response(JSON.stringify({
      success: true,
      status: shouldContinue ? 'continuing' : ((remainingCount || 0) === 0 ? 'complete' : 'max_iterations_reached'),
      processed: symbolsToProcess.length,
      updated,
      errors,
      remaining: remainingCount || 0,
      iteration,
      max_iterations: maxIterations,
      duration_ms: duration,
      auto_loop: shouldContinue,
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
