import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Transform blockchains array to contracts JSONB object
function transformBlockchainsToContracts(blockchains: any[] | null): Record<string, any> {
  if (!blockchains || !Array.isArray(blockchains)) return {};
  
  const contracts: Record<string, any> = {};
  for (const chain of blockchains) {
    if (chain?.address && chain.address !== '0' && chain.address !== '<nil>' && chain.address.length > 5) {
      const network = chain.network?.toLowerCase() || 'unknown';
      contracts[network] = {
        address: chain.address,
        decimals: chain.decimals || null
      };
    }
  }
  return contracts;
}

// Parse categories from various formats
function parseCategories(categories: any): string[] | null {
  if (!categories) return null;
  if (Array.isArray(categories)) return categories.filter(c => typeof c === 'string');
  if (typeof categories === 'string') {
    return categories.split(',').map(c => c.trim()).filter(Boolean);
  }
  return null;
}

// Get primary chain from contracts
function getPrimaryChain(contracts: Record<string, any>): string | null {
  const chains = Object.keys(contracts);
  if (chains.length === 0) return null;
  
  // Priority order for primary chain
  const priority = ['ethereum', 'solana', 'binance-smart-chain', 'polygon', 'arbitrum', 'base', 'avalanche'];
  for (const p of priority) {
    if (chains.includes(p)) return p;
  }
  return chains[0];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('[bootstrap-token-cards] Starting migration from crypto_snapshot to token_cards...');

    // Check current state
    const { count: existingCount } = await supabase
      .from('token_cards')
      .select('*', { count: 'exact', head: true });
    
    console.log(`[bootstrap-token-cards] Existing token_cards: ${existingCount || 0}`);

    // Fetch all crypto_snapshot data
    const { data: snapshots, error: fetchError } = await supabase
      .from('crypto_snapshot')
      .select('*')
      .order('market_cap_rank', { ascending: true, nullsFirst: false });

    if (fetchError) {
      throw new Error(`Failed to fetch crypto_snapshot: ${fetchError.message}`);
    }

    console.log(`[bootstrap-token-cards] Fetched ${snapshots?.length || 0} tokens from crypto_snapshot`);

    if (!snapshots || snapshots.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        message: 'No tokens to migrate',
        stats: { migrated: 0, skipped: 0, errors: 0 }
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Process in batches
    const BATCH_SIZE = 100;
    let migrated = 0;
    let skipped = 0;
    let errors = 0;
    const errorDetails: string[] = [];

    for (let i = 0; i < snapshots.length; i += BATCH_SIZE) {
      const batch = snapshots.slice(i, i + BATCH_SIZE);
      const tokenCards = [];

      for (const snap of batch) {
        try {
          const contracts = transformBlockchainsToContracts(snap.blockchains);
          const categories = parseCategories(snap.categories);
          const primaryChain = getPrimaryChain(contracts);

          // Parse lunarcrush_id as integer if present
          let lunarcrushId: number | null = null;
          if (snap.lunarcrush_id) {
            const parsed = parseInt(snap.lunarcrush_id, 10);
            if (!isNaN(parsed)) lunarcrushId = parsed;
          }

          const card = {
            canonical_symbol: snap.symbol?.toUpperCase() || snap.ticker?.replace('X:', '').replace('USD', ''),
            name: snap.name,
            logo_url: snap.logo_url,
            coingecko_id: snap.coingecko_id,
            lunarcrush_id: lunarcrushId,
            polygon_ticker: snap.ticker,
            categories: categories,
            contracts: Object.keys(contracts).length > 0 ? contracts : null,
            primary_chain: primaryChain,
            
            // Price data
            price_usd: snap.price,
            volume_24h_usd: snap.volume_24h,
            market_cap: snap.market_cap,
            market_cap_rank: snap.market_cap_rank,
            change_1h_pct: snap.percent_change_1h,
            change_24h_pct: snap.change_percent,
            change_7d_pct: snap.percent_change_7d,
            high_24h: snap.high_24h,
            low_24h: snap.low_24h,
            open_24h: snap.open_24h,
            vwap_24h: snap.vwap,
            
            // Social data from LunarCrush
            galaxy_score: snap.galaxy_score,
            alt_rank: snap.alt_rank,
            sentiment: snap.sentiment,
            social_volume_24h: snap.social_volume_24h,
            social_dominance: snap.social_dominance,
            interactions_24h: snap.interactions_24h,
            
            // Timestamps
            price_updated_at: snap.updated_at,
            social_updated_at: snap.updated_at,
            
            // Tier calculation based on market cap rank
            tier: snap.market_cap_rank 
              ? (snap.market_cap_rank <= 50 ? 1 : snap.market_cap_rank <= 500 ? 2 : snap.market_cap_rank <= 2000 ? 3 : 4)
              : 4,
            tier_reason: snap.market_cap_rank ? 'market_cap' : null,
            
            is_active: true
          };

          tokenCards.push(card);
        } catch (e) {
          errors++;
          errorDetails.push(`${snap.symbol}: ${e.message}`);
        }
      }

      if (tokenCards.length > 0) {
        // Use upsert with canonical_symbol as the conflict key
        const { data: upserted, error: upsertError } = await supabase
          .from('token_cards')
          .upsert(tokenCards, { 
            onConflict: 'canonical_symbol',
            ignoreDuplicates: false 
          })
          .select('canonical_symbol');

        if (upsertError) {
          console.error(`[bootstrap-token-cards] Batch ${i / BATCH_SIZE + 1} error:`, upsertError.message);
          errors += tokenCards.length;
          errorDetails.push(`Batch error: ${upsertError.message}`);
        } else {
          migrated += upserted?.length || tokenCards.length;
        }
      }

      console.log(`[bootstrap-token-cards] Processed batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(snapshots.length / BATCH_SIZE)}`);
    }

    const duration = Date.now() - startTime;
    console.log(`[bootstrap-token-cards] Migration complete in ${duration}ms: ${migrated} migrated, ${skipped} skipped, ${errors} errors`);

    return new Response(JSON.stringify({
      success: true,
      stats: {
        source_count: snapshots.length,
        migrated,
        skipped,
        errors,
        duration_ms: duration,
        error_samples: errorDetails.slice(0, 10)
      }
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('[bootstrap-token-cards] Fatal error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), { 
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  }
});
