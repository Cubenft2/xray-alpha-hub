import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

const STALE_THRESHOLD_MS = 30000; // 30 seconds

async function checkWebSocketHealth(): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('live_prices')
      .select('updated_at')
      .order('updated_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !data) {
      console.log('⚠️ No live_prices data found');
      return false;
    }

    const lastUpdate = new Date(data.updated_at).getTime();
    const now = Date.now();
    const ageMs = now - lastUpdate;
    
    const isHealthy = ageMs < STALE_THRESHOLD_MS;
    console.log(`🔍 WebSocket health check: ${isHealthy ? 'HEALTHY' : 'STALE'} (last update ${Math.round(ageMs / 1000)}s ago)`);
    
    return isHealthy;
  } catch (error) {
    console.error('❌ Health check error:', error);
    return false;
  }
}

async function getActiveCryptoSymbols(): Promise<string[]> {
  const { data, error } = await supabase
    .from('ticker_mappings')
    .select('symbol')
    .eq('type', 'crypto')
    .eq('is_active', true)
    .not('coingecko_id', 'is', null);

  if (error) {
    console.error('❌ Error fetching symbols:', error);
    return [];
  }

  return data?.map(d => d.symbol) || [];
}

async function updateLivePrices(symbols: string[]): Promise<void> {
  console.log(`📊 Fetching prices for ${symbols.length} symbols via REST API`);
  
  // Use exchange-data-aggregator to fetch prices
  const { data: aggregatedData, error } = await supabase.functions.invoke('exchange-data-aggregator', {
    body: { symbols }
  });

  if (error) {
    console.error('❌ Exchange aggregator error:', error);
    return;
  }

  if (!aggregatedData || aggregatedData.length === 0) {
    console.log('⚠️ No price data returned from aggregator');
    return;
  }

  console.log(`✅ Got prices for ${aggregatedData.length} symbols`);

  // Update live_prices table
  for (const token of aggregatedData) {
    const { error: upsertError } = await supabase
      .from('live_prices')
      .upsert({
        symbol: token.symbol,
        price: token.current_price,
        change_24h: token.weighted_change_24h,
        volume_24h: token.total_volume_24h,
        exchange_count: token.exchange_count,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'symbol'
      });

    if (upsertError) {
      console.error(`❌ Failed to update ${token.symbol}:`, upsertError);
    }
  }

  console.log(`✅ Updated ${aggregatedData.length} prices in live_prices table`);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🔄 Price poller backup starting...');

    // Check if WebSocket relay is healthy
    const isWebSocketHealthy = await checkWebSocketHealth();

    if (isWebSocketHealthy) {
      console.log('✅ WebSocket relay is healthy, skipping backup poll');
      return new Response(
        JSON.stringify({ 
          status: 'skipped', 
          reason: 'WebSocket relay is healthy',
          message: 'Backup polling not needed'
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // WebSocket is down/stale, use backup polling
    console.log('⚠️ WebSocket relay is stale, activating backup polling...');

    const symbols = await getActiveCryptoSymbols();
    
    if (symbols.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No active crypto symbols found' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Batch symbols in groups of 20 to avoid overload
    const batchSize = 20;
    const batches = [];
    for (let i = 0; i < symbols.length; i += batchSize) {
      batches.push(symbols.slice(i, i + batchSize));
    }

    console.log(`📦 Processing ${batches.length} batches of symbols`);

    for (const batch of batches) {
      await updateLivePrices(batch);
    }

    return new Response(
      JSON.stringify({ 
        status: 'success', 
        symbols_updated: symbols.length,
        message: 'Backup polling completed successfully'
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Price poller error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
