import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Blockchain priority order (higher = more preferred)
const CHAIN_PRIORITY: Record<string, number> = {
  'ethereum': 9,
  'base': 8,
  'arbitrum-one': 7,
  'polygon-pos': 6,
  'binance-smart-chain': 5,
  'optimistic-ethereum': 4,
  'avalanche': 3,
  'solana': 2,
};

// Map CoinGecko platform names to user-friendly display names
const CHAIN_DISPLAY_NAMES: Record<string, string> = {
  'ethereum': 'Ethereum',
  'binance-smart-chain': 'BSC',
  'polygon-pos': 'Polygon',
  'arbitrum-one': 'Arbitrum',
  'optimistic-ethereum': 'Optimism',
  'avalanche': 'Avalanche',
  'base': 'Base',
  'solana': 'Solana',
  'fantom': 'Fantom',
  'avalanche-c-chain': 'Avalanche',
  'harmony-shard-0': 'Harmony',
  'moonbeam': 'Moonbeam',
  'moonriver': 'Moonriver',
  'cronos': 'Cronos',
  'aurora': 'Aurora',
  'celo': 'Celo',
  'kava': 'Kava',
  'metis-andromeda': 'Metis',
  'boba': 'Boba',
  'gnosis': 'Gnosis',
  'fuse': 'Fuse',
};

// Native coins that don't have contract addresses
const NATIVE_COINS = ['BTC', 'SOL'];

interface UpdateStats {
  total: number;
  updated: number;
  skipped: number;
  skipReasons: {
    alreadyHasAddress: number;
    nativeCoin: number;
    noPlatformData: number;
    emptyPlatforms: number;
    noValidAddress: number;
  };
  errors: number;
  details: Array<{
    symbol: string;
    action: string;
    chain?: string;
    address?: string;
    reason?: string;
  }>;
  nextOffset?: number;
  hasMore: boolean;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse batch parameters
    let offset = 0;
    let batchSize = 500; // Default batch size
    
    try {
      const body = await req.json();
      offset = body.offset || 0;
      batchSize = Math.min(body.batchSize || 500, 1000); // Cap at 1000
    } catch {
      // No body or invalid JSON, use defaults
    }

    console.log(`🚀 Starting token address population (offset: ${offset}, batchSize: ${batchSize})...`);

    // Fetch crypto ticker mappings with coingecko_id that are missing addresses (with pagination)
    const { data: mappings, error: mappingsError, count } = await supabase
      .from('ticker_mappings')
      .select('id, symbol, display_name, coingecko_id, dex_address, dex_chain, dex_platforms', { count: 'exact' })
      .eq('type', 'crypto')
      .eq('is_active', true)
      .not('coingecko_id', 'is', null)
      .is('dex_address', null) // Only fetch those missing addresses
      .range(offset, offset + batchSize - 1);

    if (mappingsError) {
      console.error('Error fetching ticker mappings:', mappingsError);
      throw mappingsError;
    }

    const totalMissingAddresses = count || 0;
    console.log(`📊 Found ${mappings?.length || 0} tokens to process in this batch (${totalMissingAddresses} total missing)`);

    if (!mappings || mappings.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          stats: {
            total: 0,
            updated: 0,
            skipped: 0,
            skipReasons: { alreadyHasAddress: 0, nativeCoin: 0, noPlatformData: 0, emptyPlatforms: 0, noValidAddress: 0 },
            errors: 0,
            details: [],
            hasMore: false
          },
          message: 'No tokens need address population'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // Get unique coingecko_ids to fetch
    const cgIds = [...new Set(mappings.map(m => m.coingecko_id).filter(Boolean))];
    
    // Fetch CoinGecko master data for these specific IDs (more efficient)
    const { data: cgMasterData, error: cgError } = await supabase
      .from('cg_master')
      .select('cg_id, platforms, enrichment_status')
      .in('cg_id', cgIds);

    if (cgError) {
      console.error('Error fetching CoinGecko master data:', cgError);
      throw cgError;
    }

    console.log(`📊 Fetched ${cgMasterData?.length || 0} CoinGecko master entries for lookup`);

    // Create map for quick lookup
    const cgMasterMap = new Map<string, any>();
    cgMasterData?.forEach(item => {
      cgMasterMap.set(item.cg_id, item);
    });

    const stats: UpdateStats = {
      total: mappings.length,
      updated: 0,
      skipped: 0,
      skipReasons: {
        alreadyHasAddress: 0,
        nativeCoin: 0,
        noPlatformData: 0,
        emptyPlatforms: 0,
        noValidAddress: 0
      },
      errors: 0,
      details: [],
      hasMore: (offset + mappings.length) < totalMissingAddresses
    };

    // Prepare batch updates
    const updates: Array<{ id: string; dex_address: string; dex_chain: string }> = [];

    // Process each mapping
    for (const mapping of mappings) {
      try {
        // Get platforms data - check both cg_master and dex_platforms column
        const cgData = cgMasterMap.get(mapping.coingecko_id);
        let platforms = cgData?.platforms;
        
        // Also check dex_platforms column on ticker_mappings itself
        if (!platforms && mapping.dex_platforms && typeof mapping.dex_platforms === 'object') {
          platforms = mapping.dex_platforms;
        }

        // Skip if coin enrichment failed or has no platforms
        if (cgData?.enrichment_status === 'no_platforms') {
          stats.skipped++;
          stats.skipReasons.nativeCoin++;
          continue;
        }

        if (cgData?.enrichment_status === 'error') {
          stats.skipped++;
          stats.skipReasons.noValidAddress++;
          continue;
        }

        // Skip native coins ONLY if they also have no platform data
        if (NATIVE_COINS.includes(mapping.symbol) && 
            (!platforms || typeof platforms !== 'object' || Object.keys(platforms).length === 0)) {
          stats.skipped++;
          stats.skipReasons.nativeCoin++;
          continue;
        }

        // Skip if no platform data
        if (!platforms) {
          stats.skipped++;
          stats.skipReasons.noPlatformData++;
          continue;
        }

        // Skip if platforms is not an object or is empty
        if (typeof platforms !== 'object' || Object.keys(platforms).length === 0) {
          stats.skipped++;
          stats.skipReasons.emptyPlatforms++;
          continue;
        }

        // Select the best blockchain based on priority
        let bestChain: string | null = null;
        let bestAddress: string | null = null;
        let highestPriority = -1;

        for (const [chain, address] of Object.entries(platforms)) {
          if (typeof address === 'string' && address.trim() !== '') {
            const priority = CHAIN_PRIORITY[chain] || 0;
            if (priority > highestPriority) {
              highestPriority = priority;
              bestChain = chain;
              bestAddress = address as string;
            }
          }
        }

        // If no priority chain found, use the first available
        if (!bestChain || !bestAddress) {
          const entries = Object.entries(platforms);
          if (entries.length > 0) {
            const [chain, address] = entries[0];
            if (typeof address === 'string' && address.trim() !== '') {
              bestChain = chain;
              bestAddress = address as string;
            }
          }
        }

        if (!bestChain || !bestAddress) {
          stats.skipped++;
          stats.skipReasons.noValidAddress++;
          continue;
        }

        // Get display name for chain
        const chainDisplayName = CHAIN_DISPLAY_NAMES[bestChain] || bestChain;

        // Add to batch updates
        updates.push({
          id: mapping.id,
          dex_address: bestAddress,
          dex_chain: chainDisplayName
        });

        stats.updated++;
        if (stats.details.length < 50) { // Limit details to prevent response size issues
          stats.details.push({
            symbol: mapping.symbol,
            action: 'updated',
            chain: chainDisplayName,
            address: bestAddress.substring(0, 20) + '...'
          });
        }

      } catch (error: any) {
        console.error(`❌ Error processing ${mapping.symbol}:`, error);
        stats.errors++;
        if (stats.details.length < 50) {
          stats.details.push({
            symbol: mapping.symbol,
            action: 'error',
            reason: error.message
          });
        }
      }
    }

    // Perform batch updates (in chunks to avoid payload limits)
    const CHUNK_SIZE = 100;
    for (let i = 0; i < updates.length; i += CHUNK_SIZE) {
      const chunk = updates.slice(i, i + CHUNK_SIZE);
      
      for (const update of chunk) {
        const { error: updateError } = await supabase
          .from('ticker_mappings')
          .update({
            dex_address: update.dex_address,
            dex_chain: update.dex_chain,
            updated_at: new Date().toISOString()
          })
          .eq('id', update.id);

        if (updateError) {
          console.error(`Error updating ${update.id}:`, updateError);
          stats.errors++;
          stats.updated--; // Adjust count
        }
      }
    }

    if (stats.hasMore) {
      stats.nextOffset = offset + mappings.length;
    }

    console.log('\n📊 Batch Statistics:');
    console.log(`Batch processed: ${stats.total}`);
    console.log(`✅ Updated: ${stats.updated}`);
    console.log(`⏭️ Skipped: ${stats.skipped}`);
    console.log(`❌ Errors: ${stats.errors}`);
    console.log(`📈 Has more: ${stats.hasMore} (next offset: ${stats.nextOffset})`);

    return new Response(
      JSON.stringify({
        success: true,
        stats,
        message: `Processed ${stats.total} tokens. Updated: ${stats.updated}, Skipped: ${stats.skipped}, Errors: ${stats.errors}. ${stats.hasMore ? `${totalMissingAddresses - offset - mappings.length} remaining.` : 'All done!'}`
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error: any) {
    console.error('Fatal error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message,
        details: error.stack
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});
