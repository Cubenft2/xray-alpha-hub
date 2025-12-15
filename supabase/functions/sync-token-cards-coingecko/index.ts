import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('[sync-token-cards-coingecko] Starting CoinGecko enrichment...');

    // Step 1: Fetch token_cards missing coingecko_id (prioritize Tier 1-2)
    const { data: tokenCards, error: fetchError } = await supabase
      .from('token_cards')
      .select('id, canonical_symbol, coingecko_id, contracts, tier')
      .is('coingecko_id', null)
      .order('tier', { ascending: true })
      .order('market_cap_rank', { ascending: true, nullsFirst: false })
      .limit(500);

    if (fetchError) {
      console.error('[sync-token-cards-coingecko] Error fetching token_cards:', fetchError);
      throw fetchError;
    }

    if (!tokenCards || tokenCards.length === 0) {
      console.log('[sync-token-cards-coingecko] No token_cards missing coingecko_id');
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'All token_cards already have coingecko_id',
        updated: 0 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[sync-token-cards-coingecko] Found ${tokenCards.length} token_cards missing coingecko_id`);

    // Step 2: Fetch all cg_master entries for matching
    const symbols = tokenCards.map(tc => tc.canonical_symbol.toUpperCase());
    const { data: cgEntries, error: cgError } = await supabase
      .from('cg_master')
      .select('cg_id, symbol, name, platforms')
      .in('symbol', symbols);

    if (cgError) {
      console.error('[sync-token-cards-coingecko] Error fetching cg_master:', cgError);
      throw cgError;
    }

    console.log(`[sync-token-cards-coingecko] Found ${cgEntries?.length || 0} matching cg_master entries`);

    // Step 3: Build symbol -> cg_master map (handle duplicates)
    const symbolToCg: Record<string, typeof cgEntries[0][]> = {};
    for (const cg of cgEntries || []) {
      const sym = cg.symbol.toUpperCase();
      if (!symbolToCg[sym]) {
        symbolToCg[sym] = [];
      }
      symbolToCg[sym].push(cg);
    }

    // Step 4: Process each token_card and find best match
    let updated = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const token of tokenCards) {
      const sym = token.canonical_symbol.toUpperCase();
      const candidates = symbolToCg[sym];

      if (!candidates || candidates.length === 0) {
        skipped++;
        continue;
      }

      // Resolve best match from candidates
      let bestMatch = candidates[0];
      
      if (candidates.length > 1) {
        // Prefer cg_id that matches lowercase symbol (e.g., "bitcoin" for BTC)
        const exactIdMatch = candidates.find(c => 
          c.cg_id.toLowerCase() === sym.toLowerCase()
        );
        if (exactIdMatch) {
          bestMatch = exactIdMatch;
        } else {
          // Prefer non-wrapped, non-bridged versions
          const nonWrapped = candidates.find(c => 
            !c.name.toLowerCase().includes('wrapped') && 
            !c.name.toLowerCase().includes('bridged') &&
            !c.name.toLowerCase().includes('wormhole')
          );
          if (nonWrapped) {
            bestMatch = nonWrapped;
          }
        }
      }

      // Merge platforms into contracts format
      // cg_master.platforms: {"ethereum": "0x...", "polygon-pos": "0x..."}
      // token_cards.contracts: {"ethereum": {"address": "0x..."}, ...}
      const existingContracts = token.contracts || {};
      const newContracts = { ...existingContracts };
      
      if (bestMatch.platforms && typeof bestMatch.platforms === 'object') {
        for (const [chain, address] of Object.entries(bestMatch.platforms)) {
          if (address && typeof address === 'string' && address.length > 0) {
            // Normalize chain names
            const normalizedChain = normalizeChainName(chain);
            if (!newContracts[normalizedChain]) {
              newContracts[normalizedChain] = { address: address };
            }
          }
        }
      }

      // Update token_card
      const { error: updateError } = await supabase
        .from('token_cards')
        .update({
          coingecko_id: bestMatch.cg_id,
          contracts: Object.keys(newContracts).length > 0 ? newContracts : null,
          updated_at: new Date().toISOString()
        })
        .eq('id', token.id);

      if (updateError) {
        errors.push(`${sym}: ${updateError.message}`);
      } else {
        updated++;
      }

      // Small delay to avoid overwhelming the database
      if (updated % 50 === 0) {
        await new Promise(r => setTimeout(r, 100));
      }
    }

    console.log(`[sync-token-cards-coingecko] Complete: ${updated} updated, ${skipped} skipped (no match), ${errors.length} errors`);

    return new Response(JSON.stringify({
      success: true,
      processed: tokenCards.length,
      updated,
      skipped,
      errors: errors.slice(0, 10) // Limit error output
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

// Normalize CoinGecko chain names to standard format
function normalizeChainName(chain: string): string {
  const chainMap: Record<string, string> = {
    'ethereum': 'ethereum',
    'polygon-pos': 'polygon',
    'arbitrum-one': 'arbitrum',
    'optimistic-ethereum': 'optimism',
    'binance-smart-chain': 'bsc',
    'avalanche': 'avalanche',
    'base': 'base',
    'solana': 'solana',
    'fantom': 'fantom',
    'cronos': 'cronos',
    'near-protocol': 'near',
    'tron': 'tron',
    'sui': 'sui',
    'aptos': 'aptos',
    'stellar': 'stellar',
    'hedera-hashgraph': 'hedera',
    'cosmos': 'cosmos',
    'polkadot': 'polkadot',
    'cardano': 'cardano',
  };
  
  return chainMap[chain.toLowerCase()] || chain.toLowerCase();
}
