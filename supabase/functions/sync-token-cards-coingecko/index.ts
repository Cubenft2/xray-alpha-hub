import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Chain mappings between token_cards format and cg_master.platforms format
// Manual mappings for high-tier tokens that can't be matched by contract address
// These are native tokens or have address mismatches between LunarCrush and CoinGecko
const MANUAL_MAPPINGS: Record<string, string> = {
  // Native L1 tokens (no contract addresses)
  'SUI': 'sui',
  'APT': 'aptos',
  'TIA': 'celestia',
  'SEI': 'sei-network',
  'INJ': 'injective-protocol',
  'KAIA': 'kaia',
  'IOTA': 'iota',
  'EGLD': 'elrond-erd-2',
  'XDC': 'xdce-crowd-sale',
  'ZEN': 'zencash',
  'CELO': 'celo',
  'ROSE': 'oasis-network',
  'MINA': 'mina-protocol',
  'KDA': 'kadena',
  'CSPR': 'casper-network',
  'CFX': 'conflux-token',
  'AUDIO': 'audius',
  'SC': 'siacoin',
  'ZIL': 'zilliqa',
  'ICX': 'icon',
  'ONT': 'ontology',
  'QTUM': 'qtum',
  'RVN': 'ravencoin',
  'ZEC': 'zcash',
  'DCR': 'decred',
  'XEM': 'nem',
  'WAVES': 'waves',
  'DASH': 'dash',
  'BTG': 'bitcoin-gold',
  'DGB': 'digibyte',
  
  // Address mismatches (LunarCrush tracks bridged versions)
  'VET': 'vechain',
  'BGB': 'bitget-token',
  'GT': 'gatechain-token',
  'OKB': 'okb',
  'KCS': 'kucoin-shares',
  'HT': 'huobi-token',
  'LEO': 'leo-token',
  'CRO': 'crypto-com-chain',
  'NEXO': 'nexo',
  
  // Special cases
  'WIF': 'dogwifcoin',
  'BONK': 'bonk',
  'FLOKI': 'floki',
  'PEPE': 'pepe',
  'SHIB': 'shiba-inu',
  'DOGE': 'dogecoin',
  'ORDI': 'ordinals',
  'SATS': '1000sats-ordinals',
  'RATS': 'rats-ordinals',
  'RUNE': 'thorchain',
  'JUP': 'jupiter-exchange-solana',
  'RAY': 'raydium',
  'PYTH': 'pyth-network',
  'JTO': 'jito-governance-token',
  'ONDO': 'ondo-finance',
  'ENA': 'ethena',
  'W': 'wormhole',
  'STRK': 'starknet',
  'ZK': 'zksync',
  'ZRO': 'layerzero',
  'BLAST': 'blast',
  'MODE': 'mode',
  'METIS': 'metis-token',
  'MANTA': 'manta-network',
  'DYM': 'dymension',
  'ALT': 'altlayer',
  'PIXEL': 'pixels',
  'PORTAL': 'portal-2',
  'ETHFI': 'ether-fi',
  'AEVO': 'aevo-exchange',
  'ACE': 'fusionist',
  'AI': 'sleepless-ai',
  'XAI': 'xai-blockchain',
  'MYRO': 'myro',
  'MEW': 'cat-in-a-dogs-world',
  'BOME': 'book-of-meme',
  'SLERF': 'slerf',
  'POPCAT': 'popcat',
  'BRETT': 'brett',
  'PONKE': 'ponke',
  'GIGA': 'gigachad-2',
  'MOG': 'mog-coin',
  'SPX': 'spx6900',
  'TURBO': 'turbo',
  'NEIRO': 'neiro-on-eth',
  'GOAT': 'goatseus-maximus',
  'PNUT': 'peanut-the-squirrel',
  'CHILLGUY': 'just-a-chill-guy',
  'FARTCOIN': 'fartcoin',
  'AI16Z': 'ai16z',
  'VIRTUAL': 'virtual-protocol',
  'AIXBT': 'aixbt',
  'ZEREBRO': 'zerebro',
  'GRIFFAIN': 'griffain',
  'ARC': 'arc-2',
  'SWARMS': 'swarms',
  'PENGU': 'pudgy-penguins',
  'MOVE': 'movement',
  'ME': 'magic-eden',
  'USUAL': 'usual',
  'HYPE': 'hyperliquid',
  'GRASS': 'grass',
  'EIGEN': 'eigenlayer',
  'SAFE': 'safe',
  'COW': 'cow-protocol',
  'MORPHO': 'morpho',
  'AERO': 'aerodrome-finance',
  'VELO': 'velodrome-finance',
  
  // Additional Tier 1/2 tokens found missing
  'SUN': 'sun-token',
  'JST': 'just',
  'KLAY': 'klay-token',
  'WAL': 'walrus-2',
  'DEEP': 'deepbook-protocol',
  'ZANO': 'zano',
  'BDX': 'beldex',
  'FRXETH': 'frax-ether',
  'BWB': 'bitget-wallet-token',
  'BTSE': 'btse-token',
  'CORE': 'coredaoorg',
  'S': 'sonic-3',
  'FDUSD': 'first-digital-usd',
  'USDS': 'usds',
  'BERA': 'berachain-bera',
  'IP': 'story-2',
  'TRUMP': 'official-trump',
  'MELANIA': 'melania-meme',
  'ANIME': 'anime',
  'TST': 'the-sparks-token',
  'NIL': 'nil',
  'LAYER': 'layer',
  'PUFFER': 'puffer-finance',
  'KMNO': 'kamino',
  'JELLY': 'jelly-ai',
  'PARTI': 'particle-network',
};

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

    console.log('[sync-token-cards-coingecko] Starting CoinGecko ID matching...');

    // Step 0: Apply manual mappings FIRST for high-tier tokens
    console.log('[sync-token-cards-coingecko] Applying manual mappings...');
    
    const { data: manualTargets, error: manualFetchError } = await supabase
      .from('token_cards')
      .select('id, canonical_symbol, tier')
      .is('coingecko_id', null)
      .in('canonical_symbol', Object.keys(MANUAL_MAPPINGS));

    let manualMapped = 0;
    const manualErrors: string[] = [];

    if (!manualFetchError && manualTargets && manualTargets.length > 0) {
      console.log(`[sync-token-cards-coingecko] Found ${manualTargets.length} tokens for manual mapping`);
      
      for (const token of manualTargets) {
        const cgId = MANUAL_MAPPINGS[token.canonical_symbol];
        if (cgId) {
          const { error: updateError } = await supabase
            .from('token_cards')
            .update({
              coingecko_id: cgId,
              updated_at: new Date().toISOString()
            })
            .eq('id', token.id);

          if (updateError) {
            manualErrors.push(`${token.canonical_symbol}: ${updateError.message}`);
          } else {
            manualMapped++;
            console.log(`[sync-token-cards-coingecko] Manual: ${token.canonical_symbol} -> ${cgId}`);
          }
        }
      }
      console.log(`[sync-token-cards-coingecko] Manual mapping complete: ${manualMapped} updated`);
    }

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
        message: 'Manual mappings applied, no contract matching needed',
        manualMapped,
        updated: manualMapped 
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

    console.log(`[sync-token-cards-coingecko] Complete: ${manualMapped} manual, ${updated} contract, ${symbolMatched} symbol matches`);

    return new Response(JSON.stringify({
      success: true,
      processed: tokenCards.length,
      manualMapped,
      contractMatched: updated,
      symbolMatched,
      totalMatched: manualMapped + updated + symbolMatched,
      noMatch: noMatch - symbolMatched,
      errors: [...manualErrors, ...errors, ...symbolErrors].slice(0, 10)
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
