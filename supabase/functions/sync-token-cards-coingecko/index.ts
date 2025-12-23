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
  'JLP': 'jupiter-perpetuals-liquidity-provider-token',
  
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
  { tc: 'ton', cg: 'the-open-network' },
  { tc: 'osmosis', cg: 'osmosis' },
  { tc: 'blast', cg: 'blast' },
  { tc: 'chiliz', cg: 'chiliz' },
  { tc: 'cronos', cg: 'cronos' },
  { tc: 'sonic', cg: 'sonic' },
  { tc: 'pulsechain', cg: 'pulsechain' },
  { tc: 'bittensor', cg: 'bittensor' },
  { tc: 'hyperevm', cg: 'hyperevm' },
  { tc: 'zksync', cg: 'zksync' },
  { tc: 'gnosis', cg: 'xdai' },
  { tc: 'xdai', cg: 'xdai' },
  { tc: 'cardano', cg: 'cardano' },
  { tc: 'berachain', cg: 'berachain' },
  { tc: 'linea', cg: 'linea' },
  { tc: 'harmony', cg: 'harmony-shard-0' },
  { tc: 'ordinals', cg: 'ordinals' },
  { tc: 'xrp', cg: 'xrp' },
  { tc: 'ripple', cg: 'xrp' },
  { tc: 'mantle', cg: 'mantle' },
  { tc: 'klaytn', cg: 'klay-token' },
  { tc: 'celo', cg: 'celo' },
  { tc: 'hedera', cg: 'hedera-hashgraph' },
  { tc: 'sei', cg: 'sei-v2' },
  { tc: 'scroll', cg: 'scroll' },
  { tc: 'hyperliquid', cg: 'hyperliquid' },
  { tc: 'stellar', cg: 'stellar' },
  { tc: 'ronin', cg: 'ronin' },
  { tc: 'multiversx', cg: 'elrond' },
  { tc: 'elrond', cg: 'elrond' },
  { tc: 'algorand', cg: 'algorand' },
  { tc: 'mode', cg: 'mode' },
  { tc: 'core', cg: 'core' },
  { tc: 'starknet', cg: 'starknet' },
  { tc: 'unichain', cg: 'unichain' },
  { tc: 'icp', cg: 'internet-computer' },
  { tc: 'internet-computer', cg: 'internet-computer' },
  { tc: 'metis', cg: 'metis-andromeda' },
  { tc: 'aurora', cg: 'aurora' },
  { tc: 'manta', cg: 'manta-pacific' },
  { tc: 'kava', cg: 'kava' },
  { tc: 'moonbeam', cg: 'moonbeam' },
  { tc: 'cosmos', cg: 'cosmos' },
  { tc: 'moonriver', cg: 'moonriver' },
  { tc: 'iotex', cg: 'iotex' },
  { tc: 'thundercore', cg: 'thundercore' },
  { tc: 'wemix', cg: 'wemix-network' },
  { tc: 'oasis', cg: 'oasis' },
  { tc: 'astar', cg: 'astar' },
  { tc: 'zkfair', cg: 'zkfair' },
  { tc: 'boba', cg: 'boba' },
  { tc: 'fuse', cg: 'fuse' },
  { tc: 'taiko', cg: 'taiko' },
];

// Configuration
const MAX_RUNTIME_MS = 55000; // 55 seconds max runtime (edge function limit is 60s)
const CONTRACT_BATCH_SIZE = 500;
const SYMBOL_BATCH_SIZE = 500;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('[sync-token-cards-coingecko] Starting CoinGecko ID matching (cursor mode)...');

    // ========== STATS TRACKING ==========
    const stats = {
      manualMapped: 0,
      manualCorrected: 0,
      contractMatched: 0,
      symbolMatched: 0,
      errors: [] as string[],
      missingBefore: 0,
      missingAfter: 0,
    };

    // Count missing before we start
    const { count: missingBefore } = await supabase
      .from('token_cards')
      .select('*', { count: 'exact', head: true })
      .is('coingecko_id', null)
      .eq('is_active', true);
    stats.missingBefore = missingBefore || 0;
    console.log(`[sync-token-cards-coingecko] Missing coingecko_id before: ${stats.missingBefore}`);

    // ========== STEP 0: MANUAL MAPPINGS (ALWAYS FIRST) ==========
    console.log('[sync-token-cards-coingecko] Step 0: Applying manual mappings...');
    
    const { data: manualTargets } = await supabase
      .from('token_cards')
      .select('id, canonical_symbol, tier, coingecko_id')
      .in('canonical_symbol', Object.keys(MANUAL_MAPPINGS));

    if (manualTargets && manualTargets.length > 0) {
      for (const token of manualTargets) {
        const correctCgId = MANUAL_MAPPINGS[token.canonical_symbol];
        if (token.coingecko_id === correctCgId) continue;
        
        const wasWrong = token.coingecko_id !== null && token.coingecko_id !== correctCgId;
        
        const { error } = await supabase
          .from('token_cards')
          .update({ coingecko_id: correctCgId, updated_at: new Date().toISOString() })
          .eq('id', token.id);

        if (error) {
          stats.errors.push(`Manual ${token.canonical_symbol}: ${error.message}`);
        } else {
          if (wasWrong) {
            stats.manualCorrected++;
            console.log(`[Manual] CORRECTED: ${token.canonical_symbol} -> ${correctCgId}`);
          } else {
            stats.manualMapped++;
          }
        }
      }
    }
    console.log(`[sync-token-cards-coingecko] Manual: ${stats.manualMapped} new, ${stats.manualCorrected} corrected`);

    // Check time budget
    if (Date.now() - startTime > MAX_RUNTIME_MS) {
      return finishWithStats(supabase, stats, startTime, 'time_limit_manual');
    }

    // ========== LOAD CG_MASTER DATA ==========
    console.log('[sync-token-cards-coingecko] Loading cg_master data...');
    let allCgEntries: any[] = [];
    let offset = 0;
    const batchSize = 1000;

    while (true) {
      const { data } = await supabase
        .from('cg_master')
        .select('cg_id, symbol, name, platforms')
        .not('platforms', 'is', null)
        .range(offset, offset + batchSize - 1);

      if (!data || data.length === 0) break;
      allCgEntries = allCgEntries.concat(data);
      offset += batchSize;
      if (data.length < batchSize) break;
    }
    console.log(`[sync-token-cards-coingecko] Loaded ${allCgEntries.length} cg_master entries`);

    // Build address maps
    const addressMaps: Record<string, Map<string, string>> = {};
    for (const mapping of CHAIN_MAPPINGS) {
      addressMaps[mapping.tc] = new Map();
    }
    for (const cg of allCgEntries) {
      if (!cg.platforms || typeof cg.platforms !== 'object') continue;
      for (const mapping of CHAIN_MAPPINGS) {
        const address = cg.platforms[mapping.cg];
        if (address && typeof address === 'string' && address.length > 0) {
          addressMaps[mapping.tc].set(address.toLowerCase(), cg.cg_id);
        }
      }
    }

    // ========== STEP 1: CONTRACT MATCHING (CURSOR-BASED, NO LIMIT) ==========
    console.log('[sync-token-cards-coingecko] Step 1: Contract address matching...');
    
    // Get cursor from cache_kv
    const CURSOR_KEY = 'sync-cg:contract_cursor';
    const { data: cursorData } = await supabase
      .from('cache_kv')
      .select('v')
      .eq('k', CURSOR_KEY)
      .single();
    
    let lastProcessedRank = cursorData?.v?.last_rank || 0;
    let contractBatchesProcessed = 0;
    const maxContractBatches = 10; // Process up to 10 batches per run

    while (contractBatchesProcessed < maxContractBatches && Date.now() - startTime < MAX_RUNTIME_MS) {
      const { data: tokenCards } = await supabase
        .from('token_cards')
        .select('id, canonical_symbol, contracts, tier, market_cap_rank')
        .is('coingecko_id', null)
        .not('contracts', 'is', null)
        .gt('market_cap_rank', lastProcessedRank)
        .order('market_cap_rank', { ascending: true, nullsFirst: false })
        .limit(CONTRACT_BATCH_SIZE);

      if (!tokenCards || tokenCards.length === 0) {
        // Reset cursor - we've processed all
        await supabase.from('cache_kv').upsert({
          k: CURSOR_KEY,
          v: { last_rank: 0, completed_at: new Date().toISOString() },
          expires_at: new Date(Date.now() + 86400000).toISOString()
        }, { onConflict: 'k' });
        console.log('[sync-token-cards-coingecko] Contract matching complete - cursor reset');
        break;
      }

      console.log(`[Contract] Processing batch from rank ${lastProcessedRank}, ${tokenCards.length} tokens`);

      for (const token of tokenCards) {
        if (!token.contracts || typeof token.contracts !== 'object') continue;

        let matchedCgId: string | null = null;
        for (const mapping of CHAIN_MAPPINGS) {
          const contractData = token.contracts[mapping.tc];
          if (!contractData) continue;

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
            break;
          }
        }

        if (matchedCgId) {
          const { error } = await supabase
            .from('token_cards')
            .update({ coingecko_id: matchedCgId, updated_at: new Date().toISOString() })
            .eq('id', token.id);

          if (!error) {
            stats.contractMatched++;
          }
        }

        lastProcessedRank = token.market_cap_rank || lastProcessedRank + 1;
      }

      // Update cursor
      await supabase.from('cache_kv').upsert({
        k: CURSOR_KEY,
        v: { last_rank: lastProcessedRank, updated_at: new Date().toISOString() },
        expires_at: new Date(Date.now() + 86400000).toISOString()
      }, { onConflict: 'k' });

      contractBatchesProcessed++;
    }
    console.log(`[sync-token-cards-coingecko] Contract matched: ${stats.contractMatched} (${contractBatchesProcessed} batches)`);

    // Check time budget
    if (Date.now() - startTime > MAX_RUNTIME_MS) {
      return finishWithStats(supabase, stats, startTime, 'time_limit_contract');
    }

    // ========== STEP 2: SYMBOL MATCHING (CURSOR-BASED, NO LIMIT) ==========
    console.log('[sync-token-cards-coingecko] Step 2: Symbol-based fallback matching...');

    // Build symbol -> cg_id map with scoring
    const symbolTokenMap = new Map<string, { cg_id: string; name: string; score: number }>();
    for (const cg of allCgEntries) {
      const upperSymbol = cg.symbol.toUpperCase();
      const existing = symbolTokenMap.get(upperSymbol);
      
      let score = 0;
      const hasNoPlatforms = !cg.platforms || 
        (typeof cg.platforms === 'object' && Object.keys(cg.platforms).length === 0);
      if (hasNoPlatforms) score += 100;
      
      const isBridgedOrWrapped = /bridged|wrapped|wormhole|peg|bsc|bnb\-|polygon\-|arbitrum\-/i.test(cg.name) ||
                                  /bridged|wrapped|wormhole/i.test(cg.cg_id);
      if (isBridgedOrWrapped) score -= 50;
      
      const isPrimaryToken = cg.cg_id === cg.symbol.toLowerCase() || 
                              cg.cg_id === cg.name.toLowerCase().replace(/\s+/g, '-');
      if (isPrimaryToken) score += 25;
      
      if (!existing || score > existing.score) {
        symbolTokenMap.set(upperSymbol, { cg_id: cg.cg_id, name: cg.name, score });
      }
    }

    // Also add all cg_master entries for symbol matching (including those without platforms)
    const { data: allCgForSymbol } = await supabase
      .from('cg_master')
      .select('cg_id, symbol, name');
    
    if (allCgForSymbol) {
      for (const cg of allCgForSymbol) {
        const upperSymbol = cg.symbol.toUpperCase();
        if (!symbolTokenMap.has(upperSymbol)) {
          symbolTokenMap.set(upperSymbol, { cg_id: cg.cg_id, name: cg.name, score: 0 });
        }
      }
    }
    console.log(`[Symbol] Built map with ${symbolTokenMap.size} entries`);

    // Get symbol cursor
    const SYMBOL_CURSOR_KEY = 'sync-cg:symbol_cursor';
    const { data: symbolCursorData } = await supabase
      .from('cache_kv')
      .select('v')
      .eq('k', SYMBOL_CURSOR_KEY)
      .single();
    
    let lastSymbolRank = symbolCursorData?.v?.last_rank || 0;
    let symbolBatchesProcessed = 0;
    const maxSymbolBatches = 10;

    while (symbolBatchesProcessed < maxSymbolBatches && Date.now() - startTime < MAX_RUNTIME_MS) {
      const { data: stillMissing } = await supabase
        .from('token_cards')
        .select('id, canonical_symbol, name, tier, market_cap_rank')
        .is('coingecko_id', null)
        .gt('market_cap_rank', lastSymbolRank)
        .order('market_cap_rank', { ascending: true, nullsFirst: false })
        .limit(SYMBOL_BATCH_SIZE);

      if (!stillMissing || stillMissing.length === 0) {
        // Reset cursor
        await supabase.from('cache_kv').upsert({
          k: SYMBOL_CURSOR_KEY,
          v: { last_rank: 0, completed_at: new Date().toISOString() },
          expires_at: new Date(Date.now() + 86400000).toISOString()
        }, { onConflict: 'k' });
        console.log('[sync-token-cards-coingecko] Symbol matching complete - cursor reset');
        break;
      }

      console.log(`[Symbol] Processing batch from rank ${lastSymbolRank}, ${stillMissing.length} tokens`);

      for (const token of stillMissing) {
        const match = symbolTokenMap.get(token.canonical_symbol);
        
        if (match) {
          const { error } = await supabase
            .from('token_cards')
            .update({ coingecko_id: match.cg_id, updated_at: new Date().toISOString() })
            .eq('id', token.id);

          if (!error) {
            stats.symbolMatched++;
          }
        }

        lastSymbolRank = token.market_cap_rank || lastSymbolRank + 1;
      }

      // Update cursor
      await supabase.from('cache_kv').upsert({
        k: SYMBOL_CURSOR_KEY,
        v: { last_rank: lastSymbolRank, updated_at: new Date().toISOString() },
        expires_at: new Date(Date.now() + 86400000).toISOString()
      }, { onConflict: 'k' });

      symbolBatchesProcessed++;
    }
    console.log(`[sync-token-cards-coingecko] Symbol matched: ${stats.symbolMatched} (${symbolBatchesProcessed} batches)`);

    return finishWithStats(supabase, stats, startTime, 'complete');

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

async function finishWithStats(
  supabase: any,
  stats: any,
  startTime: number,
  exitReason: string
): Promise<Response> {
  // Count missing after
  const { count: missingAfter } = await supabase
    .from('token_cards')
    .select('*', { count: 'exact', head: true })
    .is('coingecko_id', null)
    .eq('is_active', true);
  stats.missingAfter = missingAfter || 0;

  const duration = Date.now() - startTime;
  const totalMatched = stats.manualMapped + stats.manualCorrected + stats.contractMatched + stats.symbolMatched;
  const improvement = stats.missingBefore - stats.missingAfter;

  console.log(`[sync-token-cards-coingecko] COMPLETE in ${duration}ms`);
  console.log(`[sync-token-cards-coingecko] Exit reason: ${exitReason}`);
  console.log(`[sync-token-cards-coingecko] Missing: ${stats.missingBefore} -> ${stats.missingAfter} (improved: ${improvement})`);
  console.log(`[sync-token-cards-coingecko] Matched: ${stats.manualMapped} manual, ${stats.manualCorrected} corrected, ${stats.contractMatched} contract, ${stats.symbolMatched} symbol`);

  return new Response(JSON.stringify({
    success: true,
    exitReason,
    duration_ms: duration,
    stats: {
      manualMapped: stats.manualMapped,
      manualCorrected: stats.manualCorrected,
      contractMatched: stats.contractMatched,
      symbolMatched: stats.symbolMatched,
      totalMatched,
      missingBefore: stats.missingBefore,
      missingAfter: stats.missingAfter,
      improvement,
    },
    errors: stats.errors.slice(0, 10)
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
