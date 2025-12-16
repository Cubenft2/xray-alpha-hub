import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Chain name mappings from CoinGecko platform names to our format
const CHAIN_MAPPINGS: Record<string, string> = {
  'ethereum': 'ethereum',
  'polygon-pos': 'polygon',
  'arbitrum-one': 'arbitrum',
  'optimistic-ethereum': 'optimism',
  'base': 'base',
  'binance-smart-chain': 'bsc',
  'avalanche': 'avalanche',
  'solana': 'solana',
  'tron': 'tron',
  'the-open-network': 'ton',
  'sui': 'sui',
  'aptos': 'aptos',
  'near-protocol': 'near',
  'fantom': 'fantom',
  'cronos': 'cronos',
  'cosmos': 'cosmos',
  'osmosis': 'osmosis',
  'injective': 'injective',
  'celestia': 'celestia',
  'sei-network': 'sei',
  'mantle': 'mantle',
  'linea': 'linea',
  'scroll': 'scroll',
  'zksync': 'zksync',
  'manta-pacific': 'manta',
  'blast': 'blast',
  'mode': 'mode',
  'kava': 'kava',
  'celo': 'celo',
  'moonbeam': 'moonbeam',
  'moonriver': 'moonriver',
  'harmony-shard-0': 'harmony',
  'gnosis': 'gnosis',
  'metis-andromeda': 'metis',
  'aurora': 'aurora',
  'boba': 'boba',
  'algorand': 'algorand',
  'stellar': 'stellar',
  'hedera-hashgraph': 'hedera',
  'cardano': 'cardano',
  'polkadot': 'polkadot',
  'kusama': 'kusama',
  'flow': 'flow',
  'stacks': 'stacks',
  'icp': 'icp',
  'vechain': 'vechain',
  'eos': 'eos',
  'tezos': 'tezos',
  'waves': 'waves',
  'zilliqa': 'zilliqa',
  'neo': 'neo',
  'ontology': 'ontology',
  'xdc-network': 'xdc',
  'klay-token': 'klaytn',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  console.log('[sync-token-cards-coingecko-contracts] Starting contract enrichment...');

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Step 1: Find token_cards with coingecko_id but missing/empty contracts
    const { data: tokensNeedingContracts, error: tokenError } = await supabase
      .from('token_cards')
      .select('id, canonical_symbol, coingecko_id, contracts')
      .not('coingecko_id', 'is', null)
      .or('contracts.is.null,contracts.eq.{}')
      .limit(500);

    if (tokenError) {
      throw new Error(`Failed to fetch tokens: ${tokenError.message}`);
    }

    console.log(`[sync-token-cards-coingecko-contracts] Found ${tokensNeedingContracts?.length || 0} tokens needing contracts`);

    if (!tokensNeedingContracts || tokensNeedingContracts.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        message: 'No tokens need contract enrichment',
        stats: { checked: 0, enriched: 0 }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Step 2: Get CoinGecko IDs to look up
    const coingeckoIds = tokensNeedingContracts
      .map(t => t.coingecko_id)
      .filter(Boolean) as string[];

    // Step 3: Fetch platform data from cg_master
    const { data: cgMasterData, error: cgError } = await supabase
      .from('cg_master')
      .select('cg_id, platforms')
      .in('cg_id', coingeckoIds)
      .not('platforms', 'is', null);

    if (cgError) {
      throw new Error(`Failed to fetch cg_master: ${cgError.message}`);
    }

    console.log(`[sync-token-cards-coingecko-contracts] Found ${cgMasterData?.length || 0} cg_master entries with platforms`);

    // Create lookup map
    const platformsMap = new Map<string, Record<string, string>>();
    for (const cg of cgMasterData || []) {
      if (cg.platforms && typeof cg.platforms === 'object' && Object.keys(cg.platforms).length > 0) {
        platformsMap.set(cg.cg_id, cg.platforms as Record<string, string>);
      }
    }

    // Step 4: Transform and update
    const updates: Array<{ id: string; contracts: Record<string, { address: string; decimals: number | null }> }> = [];
    let skippedNoData = 0;
    let skippedEmptyPlatforms = 0;

    for (const token of tokensNeedingContracts) {
      const platforms = platformsMap.get(token.coingecko_id!);
      
      if (!platforms) {
        skippedNoData++;
        continue;
      }

      // Transform CoinGecko format to our format
      const contracts: Record<string, { address: string; decimals: number | null }> = {};
      let hasValidContract = false;

      for (const [cgChain, address] of Object.entries(platforms)) {
        // Skip empty addresses
        if (!address || address === '' || address === 'null') continue;

        // Map to our chain name
        const ourChain = CHAIN_MAPPINGS[cgChain] || cgChain;
        
        contracts[ourChain] = {
          address: address,
          decimals: null // CoinGecko platforms doesn't include decimals
        };
        hasValidContract = true;
      }

      if (!hasValidContract) {
        skippedEmptyPlatforms++;
        continue;
      }

      updates.push({
        id: token.id,
        contracts
      });
    }

    console.log(`[sync-token-cards-coingecko-contracts] Prepared ${updates.length} updates (skipped: ${skippedNoData} no cg_master data, ${skippedEmptyPlatforms} empty platforms)`);

    // Step 5: Batch update token_cards
    let updatedCount = 0;
    const batchSize = 50;

    for (let i = 0; i < updates.length; i += batchSize) {
      const batch = updates.slice(i, i + batchSize);
      
      for (const update of batch) {
        const { error: updateError } = await supabase
          .from('token_cards')
          .update({ contracts: update.contracts })
          .eq('id', update.id);

        if (updateError) {
          console.error(`[sync-token-cards-coingecko-contracts] Failed to update ${update.id}: ${updateError.message}`);
        } else {
          updatedCount++;
        }
      }
    }

    const duration = Date.now() - startTime;
    console.log(`[sync-token-cards-coingecko-contracts] Completed: ${updatedCount} tokens enriched in ${duration}ms`);

    // Log API call (even though this is zero-cost, track for monitoring)
    await supabase.from('external_api_calls').insert({
      api_name: 'coingecko',
      function_name: 'sync-token-cards-coingecko-contracts',
      call_count: 0, // Zero API calls - database only
      success: true
    });

    return new Response(JSON.stringify({
      success: true,
      stats: {
        tokensChecked: tokensNeedingContracts.length,
        cgMasterMatches: platformsMap.size,
        enriched: updatedCount,
        skippedNoData,
        skippedEmptyPlatforms,
        durationMs: duration
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[sync-token-cards-coingecko-contracts] Error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
