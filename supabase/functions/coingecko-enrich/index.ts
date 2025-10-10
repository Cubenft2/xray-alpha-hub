import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const COINGECKO_API_KEY = Deno.env.get('COINGECKO_API_KEY');
const RATE_LIMIT_DELAY = 150; // ms between calls (safe for 500 calls/min)
const MAX_BATCH_SIZE = 100;

interface EnrichmentRequest {
  batch_size?: number;
  force_update?: boolean;
  symbols_only?: string[];
  priority_mappings?: boolean;
}

interface EnrichmentStats {
  total: number;
  enriched: number;
  failed: number;
  skipped: number;
  remaining: number;
  details: Array<{
    cg_id: string;
    symbol: string;
    status: string;
    platform_count: number;
    error?: string;
  }>;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const body: EnrichmentRequest = await req.json().catch(() => ({}));
    const batchSize = Math.min(body.batch_size || 50, MAX_BATCH_SIZE);
    const forceUpdate = body.force_update || false;
    const symbolsOnly = body.symbols_only || [];
    const priorityMappings = body.priority_mappings !== false; // default true

    console.log(`🚀 Starting CoinGecko enrichment batch...`);
    console.log(`   Batch size: ${batchSize}`);
    console.log(`   Force update: ${forceUpdate}`);
    console.log(`   Priority mappings: ${priorityMappings}`);
    console.log(`   Symbols filter: ${symbolsOnly.length > 0 ? symbolsOnly.join(', ') : 'none'}`);

    // Build query for coins needing enrichment
    let query = supabase
      .from('cg_master')
      .select(`
        id,
        cg_id,
        symbol,
        name,
        platforms,
        enrichment_status,
        enriched_at
      `);

    // Apply filters
    if (symbolsOnly.length > 0) {
      query = query.in('symbol', symbolsOnly);
    } else if (!forceUpdate) {
      // Only get coins that need enrichment (not already enriched)
      query = query.or('enrichment_status.is.null,enrichment_status.eq.pending,enrichment_status.eq.error');
    }

    // Priority ordering: coins with ticker_mappings first
    if (priorityMappings && symbolsOnly.length === 0) {
      // Get all coins with a subquery check for ticker_mappings
      const { data: mappedSymbols } = await supabase
        .from('ticker_mappings')
        .select('coingecko_id')
        .not('coingecko_id', 'is', null);
      
      const mappedIds = new Set(mappedSymbols?.map(m => m.coingecko_id) || []);
      
      const { data: allCoins, error: fetchError } = await query.limit(batchSize * 3);
      
      if (fetchError) throw fetchError;
      
      // Sort: mapped coins first, then by symbol
      const coins = allCoins?.sort((a, b) => {
        const aIsMapped = mappedIds.has(a.cg_id);
        const bIsMapped = mappedIds.has(b.cg_id);
        if (aIsMapped && !bIsMapped) return -1;
        if (!aIsMapped && bIsMapped) return 1;
        return a.symbol.localeCompare(b.symbol);
      }).slice(0, batchSize) || [];

      // Continue with these sorted coins
      const stats: EnrichmentStats = {
        total: coins.length,
        enriched: 0,
        failed: 0,
        skipped: 0,
        remaining: 0,
        details: []
      };

      await processCoins(coins, stats, supabase);
      return createResponse(stats);
    } else {
      query = query.order('symbol').limit(batchSize);
      const { data: coins, error: fetchError } = await query;
      
      if (fetchError) throw fetchError;

      const stats: EnrichmentStats = {
        total: coins?.length || 0,
        enriched: 0,
        failed: 0,
        skipped: 0,
        remaining: 0,
        details: []
      };

      await processCoins(coins || [], stats, supabase);
      return createResponse(stats);
    }

  } catch (error) {
    console.error('❌ Error in coingecko-enrich:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function processCoins(coins: any[], stats: EnrichmentStats, supabase: any) {
  console.log(`📊 Processing ${coins.length} coins...`);

  for (let i = 0; i < coins.length; i++) {
    const coin = coins[i];
    
    try {
      console.log(`[${i + 1}/${coins.length}] 🔍 Enriching ${coin.symbol} (${coin.cg_id})...`);

      // Add rate limit delay
      if (i > 0) {
        await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY));
      }

      // Call CoinGecko API
      const url = `https://pro-api.coingecko.com/api/v3/coins/${coin.cg_id}?localization=false&tickers=false&market_data=false&community_data=false&developer_data=false&sparkline=false&x_cg_pro_api_key=${COINGECKO_API_KEY}`;
      
      const response = await fetch(url);
      
      if (!response.ok) {
        if (response.status === 404) {
          // Coin not found - mark as no_platforms
          await supabase
            .from('cg_master')
            .update({
              enrichment_status: 'no_platforms',
              enriched_at: new Date().toISOString(),
              enrichment_error: 'Coin not found in CoinGecko'
            })
            .eq('id', coin.id);
          
          stats.skipped++;
          stats.details.push({
            cg_id: coin.cg_id,
            symbol: coin.symbol,
            status: 'no_platforms',
            platform_count: 0,
            error: 'Not found'
          });
          console.log(`   ⏭️ Not found - marked as no_platforms`);
          continue;
        }
        
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      const platforms = data.platforms || {};
      const platformCount = Object.keys(platforms).length;

      // Update cg_master with enriched data
      const status = platformCount === 0 ? 'no_platforms' : 'enriched';
      
      await supabase
        .from('cg_master')
        .update({
          platforms: platforms,
          enrichment_status: status,
          enriched_at: new Date().toISOString(),
          enrichment_error: null,
          synced_at: new Date().toISOString()
        })
        .eq('id', coin.id);

      if (status === 'enriched') {
        stats.enriched++;
        console.log(`   ✅ Enriched with ${platformCount} platforms`);
      } else {
        stats.skipped++;
        console.log(`   ⏭️ No platforms found`);
      }

      stats.details.push({
        cg_id: coin.cg_id,
        symbol: coin.symbol,
        status: status,
        platform_count: platformCount
      });

    } catch (error) {
      console.error(`   ❌ Error enriching ${coin.symbol}:`, error);
      
      // Mark as error in database
      await supabase
        .from('cg_master')
        .update({
          enrichment_status: 'error',
          enrichment_error: error.message,
          enriched_at: new Date().toISOString()
        })
        .eq('id', coin.id);

      stats.failed++;
      stats.details.push({
        cg_id: coin.cg_id,
        symbol: coin.symbol,
        status: 'error',
        platform_count: 0,
        error: error.message
      });
    }
  }

  // Get remaining count
  const { count } = await supabase
    .from('cg_master')
    .select('*', { count: 'exact', head: true })
    .or('enrichment_status.is.null,enrichment_status.eq.pending,enrichment_status.eq.error');
  
  stats.remaining = count || 0;

  console.log(`\n📊 Batch complete!`);
  console.log(`   ✅ Enriched: ${stats.enriched}`);
  console.log(`   ⏭️ Skipped: ${stats.skipped}`);
  console.log(`   ❌ Failed: ${stats.failed}`);
  console.log(`   🔄 Remaining: ${stats.remaining}`);
}

function createResponse(stats: EnrichmentStats) {
  return new Response(
    JSON.stringify(stats),
    { 
      status: 200, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    }
  );
}
