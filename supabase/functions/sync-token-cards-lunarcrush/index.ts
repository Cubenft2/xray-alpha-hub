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

// Merge contracts - append new chains, don't replace existing
function mergeContracts(existing: Record<string, any> | null, incoming: Record<string, any>): Record<string, any> {
  const merged = { ...(existing || {}) };
  for (const [network, data] of Object.entries(incoming)) {
    if (!merged[network]) {
      merged[network] = data;
    }
  }
  return merged;
}

// Extract all addresses from contracts object (lowercase)
function extractAddresses(contracts: Record<string, any> | null): string[] {
  if (!contracts) return [];
  return Object.values(contracts)
    .map((c: any) => c?.address?.toLowerCase())
    .filter(Boolean);
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
  const priority = ['ethereum', 'solana', 'binance-smart-chain', 'polygon', 'arbitrum', 'base', 'avalanche'];
  for (const p of priority) {
    if (chains.includes(p)) return p;
  }
  return chains[0];
}

// Fetch with exponential backoff retry for rate limiting
async function fetchWithRetry(url: string, headers: Record<string, string>, maxRetries = 3): Promise<Response | null> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const response = await fetch(url, { headers });
    
    if (response.status === 429) {
      const waitTime = Math.pow(2, attempt) * 5000; // 5s, 10s, 20s
      console.log(`[sync-token-cards-lunarcrush] Rate limited (429), waiting ${waitTime/1000}s before retry ${attempt + 1}/${maxRetries}`);
      await new Promise(r => setTimeout(r, waitTime));
      continue;
    }
    
    return response;
  }
  
  console.error(`[sync-token-cards-lunarcrush] Max retries exceeded for rate limiting`);
  return null;
}

// Helper to log API call to external_api_calls table
async function logApiCall(
  supabase: any, 
  apiName: string, 
  functionName: string, 
  success: boolean, 
  errorMessage?: string
) {
  try {
    await supabase.from('external_api_calls').insert({
      api_name: apiName,
      function_name: functionName,
      call_count: 1,
      success,
      error_message: errorMessage || null,
    });
  } catch (e) {
    console.error('[sync-token-cards-lunarcrush] Failed to log API call:', e);
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lunarcrushKey = Deno.env.get('LUNARCRUSH_API_KEY');
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('[sync-token-cards-lunarcrush] Starting sync...');

    // Fetch LunarCrush universe data (3000 tokens across 3 pages)
    const allCoins: any[] = [];
    const LIMIT = 1000;
    let apiCallsLogged = 0;
    
    for (let offset = 0; offset < 3000; offset += LIMIT) {
      const url = `https://lunarcrush.com/api4/public/coins/list/v1?limit=${LIMIT}&offset=${offset}&sort=market_cap_rank&order=asc`;
      const headers: Record<string, string> = { 'Accept': 'application/json' };
      if (lunarcrushKey) headers['Authorization'] = `Bearer ${lunarcrushKey}`;

      const response = await fetchWithRetry(url, headers);
      
      // Log API call
      const success = response?.ok ?? false;
      await logApiCall(supabase, 'lunarcrush', 'sync-token-cards-lunarcrush', success, 
        success ? undefined : `HTTP ${response?.status || 'no response'}`);
      apiCallsLogged++;
      
      if (!response || !response.ok) {
        console.error(`[sync-token-cards-lunarcrush] LunarCrush API error at offset ${offset}: ${response?.status || 'no response'}`);
        break;
      }

      const json = await response.json();
      const coins = json.data || [];
      allCoins.push(...coins);
      
      console.log(`[sync-token-cards-lunarcrush] Fetched ${coins.length} coins at offset ${offset}`);
      
      if (coins.length < LIMIT) break;
      await new Promise(r => setTimeout(r, 1500)); // Reduced delay for 2-min sync frequency
    }

    console.log(`[sync-token-cards-lunarcrush] Total coins fetched: ${allCoins.length}`);

    // Deduplicate by symbol (keep first occurrence - highest market cap due to sort order)
    const seenSymbols = new Set<string>();
    const dedupedCoins = allCoins.filter(coin => {
      const symbol = coin.symbol?.toUpperCase();
      if (!symbol || seenSymbols.has(symbol)) return false;
      seenSymbols.add(symbol);
      return true;
    });
    console.log(`[sync-token-cards-lunarcrush] After dedup: ${dedupedCoins.length} unique coins (removed ${allCoins.length - dedupedCoins.length} duplicates)`);

    if (dedupedCoins.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        message: 'No coins from LunarCrush',
        stats: { matched: 0, created: 0, updated: 0 }
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Build lookup maps for existing token_cards with pagination (load ALL cards)
    // Order by market_cap_rank to ensure top tokens (BTC, ETH, SOL) are loaded first
    const allExistingCards: any[] = [];
    const PAGE_SIZE = 1000;
    let offset = 0;
    
    while (true) {
      const { data: pageCards, error: fetchError } = await supabase
        .from('token_cards')
        .select('id, canonical_symbol, lunarcrush_id, contracts, polygon_supported')
        .order('market_cap_rank', { ascending: true, nullsFirst: false })
        .range(offset, offset + PAGE_SIZE - 1);

      if (fetchError) {
        throw new Error(`Failed to fetch token_cards page ${offset}: ${fetchError.message}`);
      }
      
      if (!pageCards || pageCards.length === 0) break;
      
      allExistingCards.push(...pageCards);
      console.log(`[sync-token-cards-lunarcrush] Loaded page ${Math.floor(offset / PAGE_SIZE) + 1}: ${pageCards.length} cards (total: ${allExistingCards.length})`);
      
      if (pageCards.length < PAGE_SIZE) break; // Last page
      offset += PAGE_SIZE;
    }

    // Create lookup maps
    const byLunarcrushId = new Map<number, any>();
    const bySymbol = new Map<string, any[]>();
    const addressToCard = new Map<string, any>();

    for (const card of allExistingCards) {
      if (card.lunarcrush_id) {
        byLunarcrushId.set(card.lunarcrush_id, card);
      }
      
      const symbol = card.canonical_symbol?.toUpperCase();
      if (symbol) {
        if (!bySymbol.has(symbol)) bySymbol.set(symbol, []);
        bySymbol.get(symbol)!.push(card);
      }
      
      const addresses = extractAddresses(card.contracts);
      for (const addr of addresses) {
        addressToCard.set(addr, card);
      }
    }

    console.log(`[sync-token-cards-lunarcrush] Loaded ${allExistingCards.length} existing cards (all pages)`);
    console.log(`[sync-token-cards-lunarcrush] byLunarcrushId: ${byLunarcrushId.size}, bySymbol: ${bySymbol.size}, addressToCard: ${addressToCard.size}`);

    // Process coins with matching logic
    let matchedById = 0;
    let matchedByAddress = 0;
    let matchedBySymbol = 0;
    let created = 0;
    let updated = 0;
    let errors = 0;

    const BATCH_SIZE = 50;
    const updates: any[] = [];
    const inserts: any[] = [];

    for (const coin of dedupedCoins) {
      try {
        const lunarcrushId = coin.id ? parseInt(coin.id, 10) : null;
        const symbol = coin.symbol?.toUpperCase();
        const incomingContracts = transformBlockchainsToContracts(coin.blockchains);
        const incomingAddresses = Object.values(incomingContracts)
          .map((c: any) => c?.address?.toLowerCase())
          .filter(Boolean);

        let matchedCard: any = null;
        let matchType = '';

        // 1. Match by lunarcrush_id first
        if (lunarcrushId && byLunarcrushId.has(lunarcrushId)) {
          matchedCard = byLunarcrushId.get(lunarcrushId);
          matchType = 'lunarcrush_id';
          matchedById++;
        }

        // 2. Match by contract address
        if (!matchedCard && incomingAddresses.length > 0) {
          for (const addr of incomingAddresses) {
            if (addressToCard.has(addr)) {
              matchedCard = addressToCard.get(addr);
              matchType = 'contract_address';
              matchedByAddress++;
              break;
            }
          }
        }

        // 3. Match by symbol (last resort, only if no lunarcrush_id on card)
        if (!matchedCard && symbol) {
          const symbolMatches = bySymbol.get(symbol) || [];
          const unclaimedMatch = symbolMatches.find(c => !c.lunarcrush_id);
          if (unclaimedMatch) {
            matchedCard = unclaimedMatch;
            matchType = 'symbol';
            matchedBySymbol++;
          }
        }

        // Build update/insert data
        const categories = parseCategories(coin.categories);
        const primaryChain = getPrimaryChain(incomingContracts);

        // Calculate rank/score changes from previous values
        const altRankChange = (coin.alt_rank != null && coin.alt_rank_previous != null) 
          ? coin.alt_rank_previous - coin.alt_rank  // Positive = improved rank
          : null;
        const galaxyScoreChange = (coin.galaxy_score != null && coin.galaxy_score_previous != null)
          ? coin.galaxy_score - coin.galaxy_score_previous
          : null;

        // Base card data (always written)
        const cardData: Record<string, any> = {
          canonical_symbol: symbol,
          name: coin.name,
          logo_url: coin.logo || coin.image,
          lunarcrush_id: lunarcrushId,
          polygon_ticker: `X:${symbol}USD`,
          categories: categories,
          primary_chain: primaryChain,
          
          // LunarCrush-unique data (always write - no other source provides these)
          market_cap: coin.market_cap,
          market_cap_rank: coin.market_cap_rank,
          change_1h_pct: coin.percent_change_1h,
          change_7d_pct: coin.percent_change_7d,
          change_30d_pct: coin.percent_change_30d,
          volatility: coin.volatility,
          market_dominance: coin.market_dominance,
          circulating_supply: coin.circulating_supply,
          max_supply: coin.max_supply,
          
          // Social data (LunarCrush is THE source - always write)
          galaxy_score: coin.galaxy_score != null ? Math.round(coin.galaxy_score) : null,
          galaxy_score_previous: coin.galaxy_score_previous != null ? Math.round(coin.galaxy_score_previous) : null,
          galaxy_score_change: galaxyScoreChange != null ? Math.round(galaxyScoreChange) : null,
          alt_rank: coin.alt_rank,
          alt_rank_previous: coin.alt_rank_previous,
          alt_rank_change: altRankChange,
          sentiment: coin.sentiment,
          social_volume_24h: coin.social_volume_24h,
          social_dominance: coin.social_dominance,
          interactions_24h: coin.interactions_24h,
          
          // Timestamps and source tracking
          social_updated_at: new Date().toISOString(),
          social_source: 'lunarcrush',
          
          // Tier
          tier: coin.market_cap_rank 
            ? (coin.market_cap_rank <= 50 ? 1 : coin.market_cap_rank <= 500 ? 2 : coin.market_cap_rank <= 2000 ? 3 : 4)
            : 4,
          tier_reason: coin.market_cap_rank ? 'market_cap' : null,
          
          is_active: true,
          
          // DEDICATED LUNARCRUSH PRICE COLUMNS - ALWAYS WRITE (no smart routing skip!)
          // Trigger will compute display price_usd from freshest source
          lunarcrush_price_usd: coin.price,
          lunarcrush_volume_24h: coin.volume_24h,
          lunarcrush_change_24h_pct: coin.percent_change_24h,
          lunarcrush_high_24h: coin.high_24h || null,
          lunarcrush_low_24h: coin.low_24h || null,
          lunarcrush_price_updated_at: new Date().toISOString()
        };

        if (matchedCard) {
          // UPDATE existing card
          const mergedContracts = mergeContracts(matchedCard.contracts, incomingContracts);
          updates.push({
            id: matchedCard.id,
            ...cardData,
            contracts: Object.keys(mergedContracts).length > 0 ? mergedContracts : null,
            primary_chain: getPrimaryChain(mergedContracts)
          });
          updated++;
        } else {
          // INSERT new card
          inserts.push({
            ...cardData,
            contracts: Object.keys(incomingContracts).length > 0 ? incomingContracts : null
          });
          created++;
        }

      } catch (e) {
        errors++;
        console.error(`[sync-token-cards-lunarcrush] Error processing ${coin.symbol}:`, e.message);
      }
    }

    // Execute updates in batches
    for (let i = 0; i < updates.length; i += BATCH_SIZE) {
      const batch = updates.slice(i, i + BATCH_SIZE);
      for (const update of batch) {
        const { id, ...data } = update;
        const { error } = await supabase
          .from('token_cards')
          .update(data)
          .eq('id', id);
        if (error) {
          console.error(`[sync-token-cards-lunarcrush] Update error for ${data.canonical_symbol}:`, error.message);
          errors++;
        }
      }
    }

    // Execute inserts in batches
    for (let i = 0; i < inserts.length; i += BATCH_SIZE) {
      const batch = inserts.slice(i, i + BATCH_SIZE);
      const { error } = await supabase
        .from('token_cards')
        .upsert(batch, { onConflict: 'canonical_symbol', ignoreDuplicates: false });
      if (error) {
        console.error(`[sync-token-cards-lunarcrush] Insert batch error:`, error.message);
        errors += batch.length;
      }
    }

    const duration = Date.now() - startTime;
    console.log(`[sync-token-cards-lunarcrush] Sync complete in ${duration}ms`);
    console.log(`[sync-token-cards-lunarcrush] Matches: ${matchedById} by ID, ${matchedByAddress} by address, ${matchedBySymbol} by symbol`);
    console.log(`[sync-token-cards-lunarcrush] Updated: ${updated}, Created: ${created}, Errors: ${errors}`);

    return new Response(JSON.stringify({
      success: true,
      stats: {
        fetched: allCoins.length,
        matched_by_id: matchedById,
        matched_by_address: matchedByAddress,
        matched_by_symbol: matchedBySymbol,
        updated,
        created,
        errors,
        duration_ms: duration
      }
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('[sync-token-cards-lunarcrush] Fatal error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), { 
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  }
});
