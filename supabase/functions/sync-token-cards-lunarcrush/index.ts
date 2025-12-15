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
    
    for (let offset = 0; offset < 3000; offset += LIMIT) {
      const url = `https://lunarcrush.com/api4/public/coins?sort=market_cap&limit=${LIMIT}&offset=${offset}`;
      const headers: Record<string, string> = { 'Accept': 'application/json' };
      if (lunarcrushKey) headers['Authorization'] = `Bearer ${lunarcrushKey}`;

      const response = await fetch(url, { headers });
      if (!response.ok) {
        console.error(`[sync-token-cards-lunarcrush] LunarCrush API error at offset ${offset}: ${response.status}`);
        break;
      }

      const json = await response.json();
      const coins = json.data || [];
      allCoins.push(...coins);
      
      console.log(`[sync-token-cards-lunarcrush] Fetched ${coins.length} coins at offset ${offset}`);
      
      if (coins.length < LIMIT) break;
      await new Promise(r => setTimeout(r, 300)); // Rate limit delay
    }

    console.log(`[sync-token-cards-lunarcrush] Total coins fetched: ${allCoins.length}`);

    if (allCoins.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        message: 'No coins from LunarCrush',
        stats: { matched: 0, created: 0, updated: 0 }
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Build lookup maps for existing token_cards
    const { data: existingCards, error: fetchError } = await supabase
      .from('token_cards')
      .select('id, canonical_symbol, lunarcrush_id, contracts');

    if (fetchError) {
      throw new Error(`Failed to fetch token_cards: ${fetchError.message}`);
    }

    // Create lookup maps
    const byLunarcrushId = new Map<number, any>();
    const bySymbol = new Map<string, any[]>();
    const addressToCard = new Map<string, any>();

    for (const card of existingCards || []) {
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

    console.log(`[sync-token-cards-lunarcrush] Loaded ${existingCards?.length || 0} existing cards`);
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

    for (const coin of allCoins) {
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

        const cardData = {
          canonical_symbol: symbol,
          name: coin.name,
          logo_url: coin.logo || coin.image,
          lunarcrush_id: lunarcrushId,
          polygon_ticker: `X:${symbol}USD`,
          categories: categories,
          primary_chain: primaryChain,
          
          // Price data
          price_usd: coin.price,
          volume_24h_usd: coin.volume_24h,
          market_cap: coin.market_cap,
          market_cap_rank: coin.market_cap_rank,
          change_1h_pct: coin.percent_change_1h,
          change_24h_pct: coin.percent_change_24h,
          change_7d_pct: coin.percent_change_7d,
          
          // Social data
          galaxy_score: coin.galaxy_score != null ? Math.round(coin.galaxy_score) : null,
          alt_rank: coin.alt_rank,
          sentiment: coin.sentiment,
          social_volume_24h: coin.social_volume,
          social_dominance: coin.social_dominance,
          interactions_24h: coin.interactions_24h,
          
          // Timestamps
          price_updated_at: new Date().toISOString(),
          social_updated_at: new Date().toISOString(),
          
          // Tier
          tier: coin.market_cap_rank 
            ? (coin.market_cap_rank <= 50 ? 1 : coin.market_cap_rank <= 500 ? 2 : coin.market_cap_rank <= 2000 ? 3 : 4)
            : 4,
          tier_reason: coin.market_cap_rank ? 'market_cap' : null,
          
          is_active: true
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
