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
    // Verify admin authentication
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid authentication' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { data: roleData, error: roleError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle();

    if (roleError || !roleData) {
      return new Response(JSON.stringify({ error: 'Forbidden - Admin access required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`Admin user ${user.email} authenticated for populate-token-addresses`);

    console.log('🚀 Starting token address population...');

    // Fetch all crypto ticker mappings with coingecko_id that are missing addresses
    const { data: mappings, error: mappingsError } = await supabase
      .from('ticker_mappings')
      .select('id, symbol, display_name, coingecko_id, dex_address, dex_chain, dex_platforms')
      .eq('type', 'crypto')
      .eq('is_active', true)
      .not('coingecko_id', 'is', null);

    if (mappingsError) {
      console.error('Error fetching ticker mappings:', mappingsError);
      throw mappingsError;
    }

    console.log(`📊 Found ${mappings.length} crypto ticker mappings with CoinGecko IDs`);

    // Fetch CoinGecko master data for enrichment status
    const { data: cgMasterData, error: cgError } = await supabase
      .from('cg_master')
      .select('cg_id, platforms, enrichment_status, enrichment_error');

    if (cgError) {
      console.error('Error fetching CoinGecko master data:', cgError);
      throw cgError;
    }

    console.log(`📊 Found ${cgMasterData.length} CoinGecko master entries`);

    // Create maps for quick lookup
    const cgMasterMap = new Map<string, any>();
    const platformsMap = new Map<string, any>();
    
    cgMasterData.forEach(item => {
      cgMasterMap.set(item.cg_id, item);
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
          stats.skipped++;
          stats.skipReasons.alreadyHasAddress++;
          continue;
        }

        // Get platforms data - check both cg_master and dex_platforms column
        const cgData = cgMasterMap.get(mapping.coingecko_id);
        let platforms = platformsMap.get(mapping.coingecko_id);
        
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

    // Only include first 100 details to avoid response size issues
    const limitedDetails = stats.details.slice(0, 100);

    return new Response(
      JSON.stringify({
        success: true,
        stats: {
          ...stats,
          details: limitedDetails
        },
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
