import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Map Polygon exchange codes to TradingView format
const EXCHANGE_MAP: Record<string, string> = {
  'XNYS': 'NYSE',      // New York Stock Exchange
  'XNAS': 'NASDAQ',    // NASDAQ
  'XASE': 'AMEX',      // American Stock Exchange
  'ARCX': 'AMEX',      // NYSE Arca (map to AMEX for TradingView)
  'BATS': 'BATS',      // BATS Exchange
  'XNMS': 'NASDAQ',    // NASDAQ National Market System
  'XNCM': 'NASDAQ',    // NASDAQ Capital Market
  'XNGS': 'NASDAQ',    // NASDAQ Global Select
  'XPHL': 'PHLX',      // Philadelphia Stock Exchange
  'XBOS': 'BATS',      // Boston Stock Exchange
  'XCHI': 'CHX',       // Chicago Stock Exchange
  'IEXG': 'IEX',       // IEX Exchange
  'EDGA': 'EDGA',      // CBOE EDGA
  'EDGX': 'EDGX',      // CBOE EDGX
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    console.log('🚀 Starting stock sync from poly_tickers to ticker_mappings...');

    // Step 1: Get total count of stocks to sync
    const { count: totalCount, error: countError } = await supabase
      .from('poly_tickers')
      .select('*', { count: 'exact', head: true })
      .eq('market', 'stocks')
      .eq('active', true)
      .eq('type', 'CS'); // Common Stock only

    if (countError) throw countError;

    console.log(`📊 Found ${totalCount} common stocks to sync`);

    // Step 2: Fetch all stocks in batches (Supabase default limit is 1000)
    const FETCH_BATCH_SIZE = 1000;
    let allStocks: any[] = [];
    let offset = 0;

    while (offset < (totalCount || 0)) {
      const { data: batch, error: fetchError } = await supabase
        .from('poly_tickers')
        .select('ticker, name, primary_exchange, type')
        .eq('market', 'stocks')
        .eq('active', true)
        .eq('type', 'CS')
        .range(offset, offset + FETCH_BATCH_SIZE - 1);

      if (fetchError) throw fetchError;
      
      if (batch && batch.length > 0) {
        allStocks = allStocks.concat(batch);
        console.log(`📦 Fetched batch: ${offset + 1} - ${offset + batch.length}`);
      }
      
      offset += FETCH_BATCH_SIZE;
    }

    console.log(`✅ Total stocks fetched: ${allStocks.length}`);

    // Step 3: Get existing ticker_mappings to avoid duplicates
    const { data: existingMappings, error: existingError } = await supabase
      .from('ticker_mappings')
      .select('symbol')
      .eq('type', 'stock');

    if (existingError) throw existingError;

    const existingSymbols = new Set((existingMappings || []).map(m => m.symbol.toUpperCase()));
    console.log(`📋 Existing stock mappings: ${existingSymbols.size}`);

    // Step 4: Transform and batch insert
    const INSERT_BATCH_SIZE = 500;
    let insertedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    const stocksToInsert = allStocks
      .filter(stock => !existingSymbols.has(stock.ticker.toUpperCase()))
      .map(stock => {
        // Get TradingView exchange format
        const tvExchange = EXCHANGE_MAP[stock.primary_exchange] || 'NYSE';
        
        return {
          symbol: stock.ticker.toUpperCase(),
          display_name: stock.name || stock.ticker,
          type: 'stock',
          tradingview_symbol: `${tvExchange}:${stock.ticker}`,
          polygon_ticker: stock.ticker,
          is_active: true,
          tradingview_supported: true,
          price_supported: true,
        };
      });

    skippedCount = allStocks.length - stocksToInsert.length;
    console.log(`📝 New stocks to insert: ${stocksToInsert.length}, Skipping existing: ${skippedCount}`);

    // Process in batches
    for (let i = 0; i < stocksToInsert.length; i += INSERT_BATCH_SIZE) {
      const batch = stocksToInsert.slice(i, i + INSERT_BATCH_SIZE);
      const batchNum = Math.floor(i / INSERT_BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(stocksToInsert.length / INSERT_BATCH_SIZE);
      
      console.log(`📤 Inserting batch ${batchNum}/${totalBatches} (${batch.length} stocks)...`);

      const { data: insertedData, error: insertError } = await supabase
        .from('ticker_mappings')
        .upsert(batch, { 
          onConflict: 'symbol',
          ignoreDuplicates: true 
        })
        .select();

      if (insertError) {
        console.error(`❌ Error inserting batch ${batchNum}:`, insertError.message);
        errorCount += batch.length;
      } else {
        insertedCount += insertedData?.length || batch.length;
        console.log(`✅ Batch ${batchNum} complete: ${insertedData?.length || batch.length} inserted`);
      }

      // Small delay between batches to avoid overwhelming the database
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    const result = {
      success: true,
      totalStocksFound: totalCount,
      inserted: insertedCount,
      skipped: skippedCount,
      errors: errorCount,
      message: `Synced ${insertedCount} new stocks. Skipped ${skippedCount} existing. ${errorCount} errors.`
    };

    console.log('🎉 Stock sync complete:', result);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });

  } catch (error: any) {
    console.error('❌ Stock sync failed:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }
});
