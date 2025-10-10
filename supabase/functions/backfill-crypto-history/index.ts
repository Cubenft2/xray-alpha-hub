import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const polygonApiKey = Deno.env.get('POLYGON_API_KEY');

    if (!polygonApiKey) {
      throw new Error('POLYGON_API_KEY not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    console.log('🚀 Starting crypto history backfill...');

    // Get all active cryptos with polygon_ticker
    const { data: mappings, error: mappingsError } = await supabase
      .from('ticker_mappings')
      .select('symbol, polygon_ticker, display_name')
      .eq('type', 'crypto')
      .eq('is_active', true)
      .not('polygon_ticker', 'is', null);

    if (mappingsError) {
      throw new Error(`Failed to fetch mappings: ${mappingsError.message}`);
    }

    console.log(`📊 Found ${mappings.length} crypto mappings to backfill`);

    // Calculate date range (90 days)
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - 90);

    const formatDate = (date: Date) => date.toISOString().split('T')[0];
    const fromDate = formatDate(startDate);
    const toDate = formatDate(endDate);

    let successCount = 0;
    let errorCount = 0;
    const results = [];

    // Process each mapping
    for (const mapping of mappings) {
      try {
        console.log(`📈 Fetching history for ${mapping.symbol} (${mapping.polygon_ticker})...`);

        const url = `https://api.polygon.io/v2/aggs/ticker/${mapping.polygon_ticker}/range/1/day/${fromDate}/${toDate}?adjusted=true&sort=asc&apiKey=${polygonApiKey}`;
        const response = await fetch(url);

        if (!response.ok) {
          console.warn(`⚠️ Polygon API error for ${mapping.symbol}: ${response.status}`);
          errorCount++;
          continue;
        }

        const data = await response.json();

        if (!data.results || data.results.length === 0) {
          console.warn(`⚠️ No data returned for ${mapping.symbol}`);
          errorCount++;
          continue;
        }

        // Transform and batch insert
        const priceRecords = data.results.map((bar: any) => ({
          ticker: mapping.polygon_ticker,
          timestamp: new Date(bar.t).toISOString(),
          open: bar.o,
          high: bar.h,
          low: bar.l,
          close: bar.c,
          volume: bar.v,
          timeframe: 'daily',
          asset_type: 'crypto',
        }));

        // Upsert in chunks of 500
        const chunkSize = 500;
        for (let i = 0; i < priceRecords.length; i += chunkSize) {
          const chunk = priceRecords.slice(i, i + chunkSize);
          const { error: insertError } = await supabase
            .from('price_history')
            .upsert(chunk, { 
              onConflict: 'ticker,timestamp,timeframe',
              ignoreDuplicates: true 
            });

          if (insertError) {
            console.error(`❌ Insert error for ${mapping.symbol}:`, insertError);
            errorCount++;
            break;
          }
        }

        console.log(`✅ Inserted ${priceRecords.length} bars for ${mapping.symbol}`);
        successCount++;
        results.push({
          symbol: mapping.symbol,
          ticker: mapping.polygon_ticker,
          bars: priceRecords.length,
          success: true,
        });

        // Rate limiting: 5 requests per second max
        await new Promise(resolve => setTimeout(resolve, 200));

      } catch (error) {
        console.error(`❌ Error processing ${mapping.symbol}:`, error);
        errorCount++;
        results.push({
          symbol: mapping.symbol,
          ticker: mapping.polygon_ticker,
          success: false,
          error: error.message,
        });
      }
    }

    console.log(`✅ Backfill complete: ${successCount} successful, ${errorCount} errors`);

    return new Response(
      JSON.stringify({
        success: true,
        processed: mappings.length,
        successful: successCount,
        errors: errorCount,
        dateRange: { from: fromDate, to: toDate },
        results,
        timestamp: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('❌ Backfill error:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        details: error.toString(),
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
