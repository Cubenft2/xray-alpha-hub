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

// Native coins that don't have contract addresses (only truly native coins)
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
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('🚀 Starting token address population...');

    // Fetch all crypto ticker mappings with coingecko_id
    const { data: mappings, error: mappingsError } = await supabase
      .from('ticker_mappings')
      .select('id, symbol, display_name, coingecko_id, dex_address, dex_chain')
      .eq('type', 'crypto')
      .eq('is_active', true)
      .not('coingecko_id', 'is', null);

    if (mappingsError) {
      console.error('Error fetching ticker mappings:', mappingsError);
      throw mappingsError;
    }

    console.log(`📊 Found ${mappings.length} crypto ticker mappings with CoinGecko IDs`);

    // Fetch CoinGecko master data
    const { data: cgData, error: cgError } = await supabase
      .from('cg_master')
      .select('cg_id, platforms');

    if (cgError) {
      console.error('Error fetching CoinGecko master data:', cgError);
      throw cgError;
    }

    console.log(`📊 Found ${cgData.length} CoinGecko master entries`);

    // Create a map of coingecko_id -> platforms
    const platformsMap = new Map<string, any>();
    cgData.forEach(item => {
      if (item.platforms) {
        platformsMap.set(item.cg_id, item.platforms);
      }
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
      details: []
    };

    // Process each mapping
    for (const mapping of mappings) {
      try {
        // Skip if already has address (unless we want to update)
        if (mapping.dex_address && mapping.dex_chain) {
          console.log(`⏭️ Skipping ${mapping.symbol} - already has address`);
          stats.skipped++;
          stats.skipReasons.alreadyHasAddress++;
          stats.details.push({
            symbol: mapping.symbol,
            action: 'skipped',
            reason: 'Already has address'
          });
          continue;
        }

    // Get platforms data for this coin
    const cgData = cgData.find(c => c.cg_id === mapping.coingecko_id);
    const platforms = platformsMap.get(mapping.coingecko_id);
    
    // Skip if coin enrichment failed or has no platforms
    if (cgData?.enrichment_status === 'no_platforms') {
      console.log(`⏭️ Skipping ${mapping.symbol} - marked as no_platforms in enrichment`);
      stats.skipped++;
      stats.skipReasons.nativeCoin++;
      stats.details.push({
        symbol: mapping.symbol,
        action: 'skipped',
        reason: 'No platforms (native coin or non-ERC token)'
      });
      continue;
    }
    
    if (cgData?.enrichment_status === 'error') {
      console.log(`⚠️ ${mapping.symbol} - enrichment error: ${cgData.enrichment_error}`);
      stats.skipped++;
      stats.skipReasons.noValidAddress++;
      stats.details.push({
        symbol: mapping.symbol,
        action: 'skipped',
        reason: `Enrichment error: ${cgData.enrichment_error}`
      });
      continue;
    }
        
        // Skip native coins ONLY if they also have no platform data
        if (NATIVE_COINS.includes(mapping.symbol) && 
            (!platforms || typeof platforms !== 'object' || Object.keys(platforms).length === 0)) {
          console.log(`⏭️ Skipping ${mapping.symbol} - native coin without contract`);
          stats.skipped++;
          stats.skipReasons.nativeCoin++;
          stats.details.push({
            symbol: mapping.symbol,
            action: 'skipped',
            reason: 'Native coin without contract'
          });
          continue;
        }

        // Skip if no platform data
        if (!platforms) {
          console.log(`⚠️ No platform data for ${mapping.symbol} (${mapping.coingecko_id})`);
          stats.skipped++;
          stats.skipReasons.noPlatformData++;
          stats.details.push({
            symbol: mapping.symbol,
            action: 'skipped',
            reason: 'No platform data'
          });
          continue;
        }

        // Skip if platforms is not an object or is empty
        if (typeof platforms !== 'object' || Object.keys(platforms).length === 0) {
          console.log(`⚠️ Empty platforms object for ${mapping.symbol} (${mapping.coingecko_id})`);
          stats.skipped++;
          stats.skipReasons.emptyPlatforms++;
          stats.details.push({
            symbol: mapping.symbol,
            action: 'skipped',
            reason: 'Empty platforms object'
          });
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
          console.log(`⚠️ No valid address found for ${mapping.symbol}`);
          stats.skipped++;
          stats.skipReasons.noValidAddress++;
          stats.details.push({
            symbol: mapping.symbol,
            action: 'skipped',
            reason: 'No valid address in platforms'
          });
          continue;
        }

        // Get display name for chain
        const chainDisplayName = CHAIN_DISPLAY_NAMES[bestChain] || bestChain;

        // Update the ticker mapping
        const { error: updateError } = await supabase
          .from('ticker_mappings')
          .update({
            dex_address: bestAddress,
            dex_chain: chainDisplayName,
            updated_at: new Date().toISOString()
          })
          .eq('id', mapping.id);

        if (updateError) {
          console.error(`❌ Error updating ${mapping.symbol}:`, updateError);
          stats.errors++;
          stats.details.push({
            symbol: mapping.symbol,
            action: 'error',
            reason: updateError.message
          });
          continue;
        }

        console.log(`✅ Updated ${mapping.symbol}: ${chainDisplayName} - ${bestAddress.substring(0, 10)}...`);
        stats.updated++;
        stats.details.push({
          symbol: mapping.symbol,
          action: 'updated',
          chain: chainDisplayName,
          address: bestAddress
        });

      } catch (error) {
        console.error(`❌ Error processing ${mapping.symbol}:`, error);
        stats.errors++;
        stats.details.push({
          symbol: mapping.symbol,
          action: 'error',
          reason: error.message
        });
      }
    }

    console.log('\n📊 Final Statistics:');
    console.log(`Total processed: ${stats.total}`);
    console.log(`✅ Updated: ${stats.updated}`);
    console.log(`⏭️ Skipped: ${stats.skipped}`);
    console.log(`   - Already has address: ${stats.skipReasons.alreadyHasAddress}`);
    console.log(`   - Native coin (no platforms): ${stats.skipReasons.nativeCoin}`);
    console.log(`   - No platform data: ${stats.skipReasons.noPlatformData}`);
    console.log(`   - Empty platforms: ${stats.skipReasons.emptyPlatforms}`);
    console.log(`   - No valid address: ${stats.skipReasons.noValidAddress}`);
    console.log(`❌ Errors: ${stats.errors}`);

    return new Response(
      JSON.stringify({
        success: true,
        stats,
        message: `Successfully processed ${stats.total} tokens. Updated: ${stats.updated}, Skipped: ${stats.skipped}, Errors: ${stats.errors}`
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
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
