import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Manual mappings for high-tier tokens that can't be matched by contract address
// These are native tokens or have address mismatches between LunarCrush and CoinGecko
// CRITICAL: These take priority and will OVERWRITE wrong coingecko_id values
const MANUAL_MAPPINGS: Record<string, string> = {
  // ========== CRITICAL: Top coins that get wrong contract matches ==========
  // These MUST be listed first and will overwrite any wrong values
  'BTC': 'bitcoin',
  'ETH': 'ethereum',
  'SOL': 'solana',
  'BNB': 'binancecoin',
  'XRP': 'ripple',
  'USDT': 'tether',
  'USDC': 'usd-coin',
  'ADA': 'cardano',
  'DOGE': 'dogecoin',
  'TRX': 'tron',
  'TON': 'the-open-network',
  'AVAX': 'avalanche-2',
  'LINK': 'chainlink',
  'DOT': 'polkadot',
  'MATIC': 'matic-network',
  'POL': 'polygon-ecosystem-token',
  'LTC': 'litecoin',
  'BCH': 'bitcoin-cash',
  'XLM': 'stellar',
  'ATOM': 'cosmos',
  'NEAR': 'near',
  'FIL': 'filecoin',
  'ICP': 'internet-computer',
  'ETC': 'ethereum-classic',
  'XMR': 'monero',
  'ALGO': 'algorand',
  'HBAR': 'hedera-hashgraph',
  'EOS': 'eos',
  'STX': 'blockstack',
  'AR': 'arweave',
  'FTM': 'fantom',
  'SAND': 'the-sandbox',
  'MANA': 'decentraland',
  'AXS': 'axie-infinity',
  'THETA': 'theta-token',
  'FLOW': 'flow',
  'GRT': 'the-graph',
  'AAVE': 'aave',
  'UNI': 'uniswap',
  'MKR': 'maker',
  'SNX': 'havven',
  'COMP': 'compound-governance-token',
  'CRV': 'curve-dao-token',
  'LDO': 'lido-dao',
  'RPL': 'rocket-pool',
  'APE': 'apecoin',
  'IMX': 'immutable-x',
  'OP': 'optimism',
  'ARB': 'arbitrum',
  'BLUR': 'blur',
  'WBTC': 'wrapped-bitcoin',
  'WETH': 'weth',
  'WBNB': 'wbnb',
  'ZEC': 'zcash',
  'XTZ': 'tezos',
  'LUNC': 'terra-luna',
  'LUNA': 'terra-luna-2',
  
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
  
  // High-tier tokens with platforms that need explicit mapping
  'RON': 'ronin',
  'PLSX': 'pulsex',
  'BTCB': 'bitcoin-bep2',
  'VBNB': 'venus-bnb',
  'STETH': 'staked-ether',
  'WSTETH': 'wrapped-steth',
  'CBBTC': 'coinbase-wrapped-btc',
  'RETH': 'rocket-pool-eth',
  'OSMO': 'osmosis',
  'FXS': 'frax-share',
  'FRAX': 'frax',
  'TUSD': 'true-usd',
  'SUSD': 'susd',
  'LUSD': 'liquity-usd',
  'GUSD': 'gemini-dollar',
  'PAXG': 'pax-gold',
  
  // Popular meme/DeFi tokens
  'WIF': 'dogwifcoin',
  'BONK': 'bonk',
  'FLOKI': 'floki',
  'PEPE': 'pepe',
  'SHIB': 'shiba-inu',
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
  
  // Additional Tier 1/2 tokens
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

// Chain mappings: token_cards chain name -> CoinGecko platform identifier
// Expanded from 14 to 55 chains for comprehensive contract address matching
const CHAIN_MAPPINGS = [
  // Original 14 chains
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
  
  // NEW: High-impact chains (41 additional) sorted by token count
  { tc: 'ton', cg: 'the-open-network' },           // 225 tokens
  { tc: 'osmosis', cg: 'osmosis' },                // 159 tokens
  { tc: 'blast', cg: 'blast' },                    // 149 tokens
  { tc: 'chiliz', cg: 'chiliz' },                  // 135 tokens
  { tc: 'cronos', cg: 'cronos' },                  // 127 tokens
  { tc: 'sonic', cg: 'sonic' },                    // 124 tokens
  { tc: 'pulsechain', cg: 'pulsechain' },          // 121 tokens
  { tc: 'bittensor', cg: 'bittensor' },            // 118 tokens
  { tc: 'hyperevm', cg: 'hyperevm' },              // 116 tokens
  { tc: 'zksync', cg: 'zksync' },                  // 112 tokens
  { tc: 'gnosis', cg: 'xdai' },                    // 112 tokens
  { tc: 'xdai', cg: 'xdai' },                      // alias for gnosis
  { tc: 'cardano', cg: 'cardano' },                // 109 tokens
  { tc: 'berachain', cg: 'berachain' },            // 93 tokens
  { tc: 'linea', cg: 'linea' },                    // 93 tokens
  { tc: 'harmony', cg: 'harmony-shard-0' },        // 84 tokens
  { tc: 'ordinals', cg: 'ordinals' },              // 80 tokens (BRC-20)
  { tc: 'xrp', cg: 'xrp' },                        // 77 tokens
  { tc: 'ripple', cg: 'xrp' },                     // alias for xrp
  { tc: 'mantle', cg: 'mantle' },                  // 76 tokens
  { tc: 'klaytn', cg: 'klay-token' },              // 70 tokens
  { tc: 'celo', cg: 'celo' },                      // 58 tokens
  { tc: 'hedera', cg: 'hedera-hashgraph' },        // 54 tokens
  { tc: 'sei', cg: 'sei-v2' },                     // 51 tokens
  { tc: 'scroll', cg: 'scroll' },                  // 49 tokens
  { tc: 'hyperliquid', cg: 'hyperliquid' },        // 47 tokens
  { tc: 'stellar', cg: 'stellar' },                // 46 tokens
  { tc: 'ronin', cg: 'ronin' },                    // 44 tokens
  { tc: 'multiversx', cg: 'elrond' },              // 43 tokens
  { tc: 'elrond', cg: 'elrond' },                  // alias for multiversx
  { tc: 'algorand', cg: 'algorand' },              // 41 tokens
  { tc: 'mode', cg: 'mode' },                      // 39 tokens
  { tc: 'core', cg: 'core' },                      // 39 tokens
  { tc: 'starknet', cg: 'starknet' },              // 38 tokens
  { tc: 'unichain', cg: 'unichain' },              // 37 tokens
  { tc: 'icp', cg: 'internet-computer' },          // 36 tokens
  { tc: 'internet-computer', cg: 'internet-computer' }, // alias
  { tc: 'metis', cg: 'metis-andromeda' },          // 35 tokens
  { tc: 'aurora', cg: 'aurora' },                  // 35 tokens
  { tc: 'manta', cg: 'manta-pacific' },            // 34 tokens
  { tc: 'kava', cg: 'kava' },                      // 32 tokens
  { tc: 'moonbeam', cg: 'moonbeam' },              // 32 tokens
  { tc: 'cosmos', cg: 'cosmos' },                  // 31 tokens
  { tc: 'moonriver', cg: 'moonriver' },            // 28 tokens
  { tc: 'iotex', cg: 'iotex' },                    // 26 tokens
  { tc: 'thundercore', cg: 'thundercore' },        // 24 tokens
  { tc: 'wemix', cg: 'wemix-network' },            // 22 tokens
  { tc: 'oasis', cg: 'oasis' },                    // 21 tokens
  { tc: 'astar', cg: 'astar' },                    // 20 tokens
  { tc: 'zkfair', cg: 'zkfair' },                  // 19 tokens
  { tc: 'boba', cg: 'boba' },                      // 18 tokens
  { tc: 'fuse', cg: 'fuse' },                      // 17 tokens
  { tc: 'taiko', cg: 'taiko' },                    // 16 tokens
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
    // This will OVERWRITE any wrong coingecko_id values (not just NULL)
    console.log('[sync-token-cards-coingecko] Applying manual mappings (overwrite mode)...');
    
    // Fetch ALL tokens that have manual mappings, regardless of current coingecko_id
    const { data: manualTargets, error: manualFetchError } = await supabase
      .from('token_cards')
      .select('id, canonical_symbol, tier, coingecko_id')
      .in('canonical_symbol', Object.keys(MANUAL_MAPPINGS));

    let manualMapped = 0;
    let manualCorrected = 0;
    const manualErrors: string[] = [];

    if (!manualFetchError && manualTargets && manualTargets.length > 0) {
      console.log(`[sync-token-cards-coingecko] Found ${manualTargets.length} tokens for manual mapping check`);
      
      for (const token of manualTargets) {
        const correctCgId = MANUAL_MAPPINGS[token.canonical_symbol];
        
        // Skip if already has correct coingecko_id
        if (token.coingecko_id === correctCgId) {
          continue;
        }
        
        const wasWrong = token.coingecko_id !== null && token.coingecko_id !== correctCgId;
        
        const { error: updateError } = await supabase
          .from('token_cards')
          .update({
            coingecko_id: correctCgId,
            updated_at: new Date().toISOString()
          })
          .eq('id', token.id);

        if (updateError) {
          manualErrors.push(`${token.canonical_symbol}: ${updateError.message}`);
        } else {
          if (wasWrong) {
            manualCorrected++;
            console.log(`[sync-token-cards-coingecko] CORRECTED: ${token.canonical_symbol} ${token.coingecko_id} -> ${correctCgId}`);
          } else {
            manualMapped++;
            console.log(`[sync-token-cards-coingecko] Manual: ${token.canonical_symbol} -> ${correctCgId}`);
          }
        }
      }
      console.log(`[sync-token-cards-coingecko] Manual mapping complete: ${manualMapped} new, ${manualCorrected} corrected`);
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

    // Step 5: Symbol-based fallback for ALL tokens (not just native/empty platforms)
    console.log('[sync-token-cards-coingecko] Starting symbol-based fallback for ALL tokens...');

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

      // Build symbol -> cg_id map for ALL tokens (not just empty platforms)
      // Use priority scoring to prefer native/non-bridged variants
      const symbolTokenMap = new Map<string, { cg_id: string; name: string; score: number }>();
      
      for (const cg of allCgEntries) {
        const upperSymbol = cg.symbol.toUpperCase();
        const existing = symbolTokenMap.get(upperSymbol);
        
        // Calculate priority score
        let score = 0;
        
        // Native tokens (empty platforms) get highest priority
        const hasNoPlatforms = !cg.platforms || 
          (typeof cg.platforms === 'object' && Object.keys(cg.platforms).length === 0);
        if (hasNoPlatforms) score += 100;
        
        // Bridged/wrapped variants get penalty
        const isBridgedOrWrapped = /bridged|wrapped|wormhole|peg|bsc|bnb\-|polygon\-|arbitrum\-/i.test(cg.name) ||
                                    /bridged|wrapped|wormhole/i.test(cg.cg_id);
        if (isBridgedOrWrapped) score -= 50;
        
        // Exact symbol/name match gets bonus
        const isPrimaryToken = cg.cg_id === cg.symbol.toLowerCase() || 
                                cg.cg_id === cg.name.toLowerCase().replace(/\s+/g, '-');
        if (isPrimaryToken) score += 25;
        
        // Only update if this is better than existing match
        if (!existing || score > existing.score) {
          symbolTokenMap.set(upperSymbol, { cg_id: cg.cg_id, name: cg.name, score });
        }
      }

      console.log(`[sync-token-cards-coingecko] Built symbol map with ${symbolTokenMap.size} entries (all tokens)`);

      // Match still-missing tokens by symbol
      for (const token of stillMissing) {
        const match = symbolTokenMap.get(token.canonical_symbol);
        
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
            console.log(`[sync-token-cards-coingecko] Symbol matched: ${token.canonical_symbol} -> ${match.cg_id} (score: ${match.score})`);
          }
        }

        // Small delay every 25 updates
        if (symbolMatched % 25 === 0 && symbolMatched > 0) {
          await new Promise(r => setTimeout(r, 100));
        }
      }
    }

    console.log(`[sync-token-cards-coingecko] Complete: ${manualMapped} manual, ${manualCorrected} corrected, ${updated} contract, ${symbolMatched} symbol matches`);

    return new Response(JSON.stringify({
      success: true,
      processed: tokenCards.length,
      manualMapped,
      manualCorrected,
      contractMatched: updated,
      symbolMatched,
      totalMatched: manualMapped + manualCorrected + updated + symbolMatched,
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
