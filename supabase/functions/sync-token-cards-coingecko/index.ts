import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Chain mappings between token_cards format and cg_master.platforms format
const CHAIN_MAPPINGS = [
  { tc: 'ethereum', cg: 'ethereum' },
  { tc: 'solana', cg: 'solana' },
  { tc: 'polygon', cg: 'polygon-pos' },
  { tc: 'bnbchain', cg: 'binance-smart-chain' },
  { tc: 'bsc', cg: 'binance-smart-chain' },
  { tc: 'arbitrum', cg: 'arbitrum-one' },
  { tc: 'base', cg: 'base' },
  { tc: 'avalanche', cg: 'avalanche' },
  { tc: 'optimism', cg: 'optimistic-ethereum' },
  { tc: 'fantom', cg: 'fantom' },
  { tc: 'tron', cg: 'tron' },
  { tc: 'near', cg: 'near-protocol' },
  { tc: 'sui', cg: 'sui' },
  { tc: 'aptos', cg: 'aptos' },
];

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('[sync-token-cards-coingecko] Starting contract-based CoinGecko ID matching...');

    // Step 1: Fetch token_cards missing coingecko_id that have contracts
    const { data: tokenCards, error: fetchError } = await supabase
      .from('token_cards')
      .select('id, canonical_symbol, contracts, tier')
      .is('coingecko_id', null)
      .not('contracts', 'is', null)
      .order('tier', { ascending: true })
      .order('market_cap_rank', { ascending: true, nullsFirst: false })
      .limit(1000);

    if (fetchError) {
      console.error('[sync-token-cards-coingecko] Error fetching token_cards:', fetchError);
      throw fetchError;
    }

    if (!tokenCards || tokenCards.length === 0) {
      console.log('[sync-token-cards-coingecko] No token_cards with contracts missing coingecko_id');
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'No token_cards need CoinGecko ID matching',
        updated: 0 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[sync-token-cards-coingecko] Found ${tokenCards.length} token_cards with contracts missing coingecko_id`);

    // Step 2: Fetch ALL cg_master entries with platforms (paginated to handle >1000 rows)
    let allCgEntries: any[] = [];
    let offset = 0;
    const batchSize = 1000;

    while (true) {
      const { data, error: cgError } = await supabase
        .from('cg_master')
        .select('cg_id, symbol, name, platforms')
        .not('platforms', 'is', null)
        .range(offset, offset + batchSize - 1);

      if (cgError) {
        console.error('[sync-token-cards-coingecko] Error fetching cg_master:', cgError);
        throw cgError;
      }

      if (!data || data.length === 0) break;
      
      allCgEntries = allCgEntries.concat(data);
      offset += batchSize;
      
      console.log(`[sync-token-cards-coingecko] Fetched ${allCgEntries.length} cg_master entries so far...`);
      
      if (data.length < batchSize) break;
    }

    console.log(`[sync-token-cards-coingecko] Loaded ${allCgEntries.length} total cg_master entries with platforms`);

    // Step 3: Build address -> cg_id lookup maps for each chain
    const addressMaps: Record<string, Map<string, string>> = {};
    
    for (const mapping of CHAIN_MAPPINGS) {
      addressMaps[mapping.tc] = new Map();
    }

    for (const cg of allCgEntries) {
      if (!cg.platforms || typeof cg.platforms !== 'object') continue;
      
      for (const mapping of CHAIN_MAPPINGS) {
        const address = cg.platforms[mapping.cg];
        if (address && typeof address === 'string' && address.length > 0) {
          // Store lowercase address for case-insensitive matching
          addressMaps[mapping.tc].set(address.toLowerCase(), cg.cg_id);
        }
      }
    }

    // Log map sizes
    for (const mapping of CHAIN_MAPPINGS) {
      const size = addressMaps[mapping.tc].size;
      if (size > 0) {
        console.log(`[sync-token-cards-coingecko] ${mapping.tc}: ${size} addresses indexed`);
      }
    }

    // Step 4: Match each token_card by contract address
    let updated = 0;
    let noMatch = 0;
    const errors: string[] = [];

    for (const token of tokenCards) {
      if (!token.contracts || typeof token.contracts !== 'object') {
        noMatch++;
        continue;
      }

      let matchedCgId: string | null = null;

      // Try each chain in priority order
      for (const mapping of CHAIN_MAPPINGS) {
        const contractData = token.contracts[mapping.tc];
        if (!contractData) continue;

        // Handle both formats: string or { address: string }
        let address: string | null = null;
        if (typeof contractData === 'string') {
          address = contractData;
        } else if (contractData.address) {
          address = contractData.address;
        }

        if (!address) continue;

        const cgId = addressMaps[mapping.tc].get(address.toLowerCase());
        if (cgId) {
          matchedCgId = cgId;
          break; // Found a match, stop searching
        }
      }

      if (!matchedCgId) {
        noMatch++;
        continue;
      }

      // Update token_card with matched coingecko_id
      const { error: updateError } = await supabase
        .from('token_cards')
        .update({
          coingecko_id: matchedCgId,
          updated_at: new Date().toISOString()
        })
        .eq('id', token.id);

      if (updateError) {
        errors.push(`${token.canonical_symbol}: ${updateError.message}`);
      } else {
        updated++;
      }

      // Small delay every 50 updates
      if (updated % 50 === 0) {
        await new Promise(r => setTimeout(r, 100));
      }
    }

    console.log(`[sync-token-cards-coingecko] Contract matching complete: ${updated} matched, ${noMatch} no match`);

    // Step 5: Symbol-based fallback for native tokens (empty platforms in CoinGecko)
    console.log('[sync-token-cards-coingecko] Starting symbol-based fallback for native tokens...');

    // Fetch tokens still missing coingecko_id
    const { data: stillMissing, error: stillMissingError } = await supabase
      .from('token_cards')
      .select('id, canonical_symbol, name, tier')
      .is('coingecko_id', null)
      .order('tier', { ascending: true })
      .order('market_cap_rank', { ascending: true, nullsFirst: false })
      .limit(500);

    if (stillMissingError) {
      console.error('[sync-token-cards-coingecko] Error fetching still missing:', stillMissingError);
    }

    let symbolMatched = 0;
    const symbolErrors: string[] = [];

    if (stillMissing && stillMissing.length > 0) {
      console.log(`[sync-token-cards-coingecko] Found ${stillMissing.length} tokens still missing coingecko_id`);

      // Build symbol -> cg_id map for native tokens (empty platforms)
      const nativeTokenMap = new Map<string, { cg_id: string; name: string }>();
      
      // Filter for entries with empty platforms (native tokens like BTC, ETH, SOL)
      for (const cg of allCgEntries) {
        // Check if platforms is empty object or has no entries
        const hasNoPlatforms = !cg.platforms || 
          (typeof cg.platforms === 'object' && Object.keys(cg.platforms).length === 0);
        
        if (hasNoPlatforms) {
          const upperSymbol = cg.symbol.toUpperCase();
          const existing = nativeTokenMap.get(upperSymbol);
          
          // Priority: prefer if cg_id matches lowercase symbol (e.g., bitcoin for BTC)
          // and name doesn't contain bridged/wrapped variants
          const isBridgedOrWrapped = /bridged|wrapped|wormhole|peg|bsc|bnb|polygon|arbitrum/i.test(cg.name);
          const isPrimaryToken = cg.cg_id === cg.symbol.toLowerCase() || 
                                  cg.cg_id === cg.name.toLowerCase().replace(/\s+/g, '-');
          
          if (!existing || (isPrimaryToken && !isBridgedOrWrapped)) {
            nativeTokenMap.set(upperSymbol, { cg_id: cg.cg_id, name: cg.name });
          }
        }
      }

      console.log(`[sync-token-cards-coingecko] Built native token map with ${nativeTokenMap.size} entries`);

      // Match still-missing tokens by symbol
      for (const token of stillMissing) {
        const match = nativeTokenMap.get(token.canonical_symbol);
        
        if (match) {
          const { error: updateError } = await supabase
            .from('token_cards')
            .update({
              coingecko_id: match.cg_id,
              updated_at: new Date().toISOString()
            })
            .eq('id', token.id);

          if (updateError) {
            symbolErrors.push(`${token.canonical_symbol}: ${updateError.message}`);
          } else {
            symbolMatched++;
            console.log(`[sync-token-cards-coingecko] Symbol matched: ${token.canonical_symbol} -> ${match.cg_id}`);
          }
        }

        // Small delay every 25 updates
        if (symbolMatched % 25 === 0 && symbolMatched > 0) {
          await new Promise(r => setTimeout(r, 100));
        }
      }
    }

    console.log(`[sync-token-cards-coingecko] Complete: ${updated} contract matches, ${symbolMatched} symbol matches, ${errors.length + symbolErrors.length} errors`);

    return new Response(JSON.stringify({
      success: true,
      processed: tokenCards.length,
      contractMatched: updated,
      symbolMatched,
      totalMatched: updated + symbolMatched,
      noMatch: noMatch - symbolMatched,
      errors: [...errors, ...symbolErrors].slice(0, 10)
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[sync-token-cards-coingecko] Error:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
