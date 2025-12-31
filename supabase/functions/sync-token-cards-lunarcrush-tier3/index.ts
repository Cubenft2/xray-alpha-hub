import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const BLOCKED_SYMBOLS = new Set<string>(['TPT3']);

function transformBlockchainsToContracts(blockchains: any[] | null): Record<string, any> {
  if (!blockchains || !Array.isArray(blockchains)) return {};
  const contracts: Record<string, any> = {};
  for (const chain of blockchains) {
    if (chain?.address && chain.address !== '0' && chain.address !== '<nil>' && chain.address.length > 5) {
      const network = chain.network?.toLowerCase() || 'unknown';
      contracts[network] = { address: chain.address, decimals: chain.decimals || null };
    }
  }
  return contracts;
}

function mergeContracts(existing: Record<string, any> | null, incoming: Record<string, any>): Record<string, any> {
  const merged = { ...(existing || {}) };
  for (const [network, data] of Object.entries(incoming)) {
    if (!merged[network]) merged[network] = data;
  }
  return merged;
}

function extractAddresses(contracts: Record<string, any> | null): string[] {
  if (!contracts) return [];
  return Object.values(contracts).map((c: any) => c?.address?.toLowerCase()).filter(Boolean);
}

function parseCategories(categories: any): string[] | null {
  if (!categories) return null;
  if (Array.isArray(categories)) return categories.filter(c => typeof c === 'string');
  if (typeof categories === 'string') return categories.split(',').map(c => c.trim()).filter(Boolean);
  return null;
}

function getPrimaryChain(contracts: Record<string, any>): string | null {
  const chains = Object.keys(contracts);
  if (chains.length === 0) return null;
  const priority = ['ethereum', 'solana', 'binance-smart-chain', 'polygon', 'arbitrum', 'base', 'avalanche'];
  for (const p of priority) { if (chains.includes(p)) return p; }
  return chains[0];
}

// Helper to log API call - logs each attempt for accurate rate limit tracking
async function logApiCall(supabase: any, apiName: string, functionName: string, success: boolean, errorMessage?: string, callCount: number = 1) {
  try {
    await supabase.from('external_api_calls').insert({
      api_name: apiName, function_name: functionName, call_count: callCount, success, error_message: errorMessage || null,
    });
  } catch (e) { console.error('[tier3] Failed to log API call:', e); }
}

// Fetch with exponential backoff retry for rate limiting - logs each attempt
async function fetchWithRetry(
  url: string, 
  headers: Record<string, string>, 
  supabase: any,
  maxRetries = 3
): Promise<{ response: Response | null; totalAttempts: number }> {
  let totalAttempts = 0;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    totalAttempts++;
    const response = await fetch(url, { headers });
    
    // Log each attempt for accurate rate limit tracking
    await logApiCall(
      supabase, 
      'lunarcrush', 
      'sync-token-cards-lunarcrush-tier3', 
      response.ok,
      response.ok ? undefined : `HTTP ${response.status} (attempt ${attempt + 1})`
    );
    
    if (response.status === 429) {
      const waitTime = Math.pow(2, attempt) * 5000;
      console.log(`[tier3] Rate limited, waiting ${waitTime/1000}s...`);
      await new Promise(r => setTimeout(r, waitTime));
      continue;
    }
    return { response, totalAttempts };
  }
  return { response: null, totalAttempts };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const startTime = Date.now();
  
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lunarcrushKey = Deno.env.get('LUNARCRUSH_API_KEY');
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('[tier3] Starting sync for tokens 2001-3000...');

    // Fetch tokens 2001-3000 (offset 2000, limit 1000)
    const url = `https://lunarcrush.com/api4/public/coins/list/v1?limit=1000&offset=2000&sort=market_cap_rank&order=asc`;
    const headers: Record<string, string> = { 'Accept': 'application/json' };
    if (lunarcrushKey) headers['Authorization'] = `Bearer ${lunarcrushKey}`;

    const { response, totalAttempts } = await fetchWithRetry(url, headers, supabase);
    console.log(`[tier3] Fetch completed with ${totalAttempts} attempt(s)`);
    
    if (!response || !response.ok) {
      console.error(`[tier3] LunarCrush API error: ${response?.status || 'no response'}`);
      return new Response(JSON.stringify({ success: false, error: `API error: ${response?.status || 'no response'}` }), 
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const json = await response.json();
    const allCoins = json.data || [];
    console.log(`[tier3] Fetched ${allCoins.length} tokens (ranks 2001-3000)`);

    const seenSymbols = new Set<string>();
    const dedupedCoins = allCoins.filter((coin: any) => {
      const symbol = coin.symbol?.toUpperCase();
      if (!symbol || BLOCKED_SYMBOLS.has(symbol) || seenSymbols.has(symbol)) return false;
      seenSymbols.add(symbol);
      return true;
    });

    if (dedupedCoins.length === 0) {
      return new Response(JSON.stringify({ success: true, message: 'No coins', stats: { matched: 0, created: 0, updated: 0 } }), 
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Load existing cards
    const allExistingCards: any[] = [];
    const PAGE_SIZE = 1000;
    let offset = 0;
    while (true) {
      const { data: pageCards, error } = await supabase
        .from('token_cards')
        .select('id, canonical_symbol, lunarcrush_id, contracts, polygon_supported, is_active')
        .order('market_cap_rank', { ascending: true, nullsFirst: false })
        .range(offset, offset + PAGE_SIZE - 1);
      if (error) throw new Error(`Failed to fetch: ${error.message}`);
      if (!pageCards || pageCards.length === 0) break;
      allExistingCards.push(...pageCards);
      if (pageCards.length < PAGE_SIZE) break;
      offset += PAGE_SIZE;
    }

    const byLunarcrushId = new Map<number, any>();
    const bySymbol = new Map<string, any[]>();
    const addressToCard = new Map<string, any>();
    for (const card of allExistingCards) {
      if (card.lunarcrush_id) byLunarcrushId.set(card.lunarcrush_id, card);
      const symbol = card.canonical_symbol?.toUpperCase();
      if (symbol) { if (!bySymbol.has(symbol)) bySymbol.set(symbol, []); bySymbol.get(symbol)!.push(card); }
      for (const addr of extractAddresses(card.contracts)) addressToCard.set(addr, card);
    }

    let updated = 0, created = 0, errors = 0;
    const updates: any[] = [];
    const inserts: any[] = [];

    for (const coin of dedupedCoins) {
      try {
        const lunarcrushId = coin.id ? parseInt(coin.id, 10) : null;
        const symbol = coin.symbol?.toUpperCase();
        const incomingContracts = transformBlockchainsToContracts(coin.blockchains);
        const incomingAddresses = Object.values(incomingContracts).map((c: any) => c?.address?.toLowerCase()).filter(Boolean);

        let matchedCard: any = null;
        if (lunarcrushId && byLunarcrushId.has(lunarcrushId)) matchedCard = byLunarcrushId.get(lunarcrushId);
        if (!matchedCard && incomingAddresses.length > 0) {
          for (const addr of incomingAddresses) { if (addressToCard.has(addr)) { matchedCard = addressToCard.get(addr); break; } }
        }
        if (!matchedCard && symbol) { matchedCard = (bySymbol.get(symbol) || []).find(c => !c.lunarcrush_id); }

        const categories = parseCategories(coin.categories);
        const primaryChain = getPrimaryChain(incomingContracts);
        const altRankChange = (coin.alt_rank != null && coin.alt_rank_previous != null) ? coin.alt_rank_previous - coin.alt_rank : null;
        const galaxyScoreChange = (coin.galaxy_score != null && coin.galaxy_score_previous != null) ? coin.galaxy_score - coin.galaxy_score_previous : null;
        const existingSameSymbol = symbol ? (bySymbol.get(symbol)?.[0] ?? null) : null;
        const preservedIsActive = (matchedCard?.is_active ?? existingSameSymbol?.is_active ?? true) === true;

        const cardData: Record<string, any> = {
          canonical_symbol: symbol, name: coin.name, logo_url: coin.logo || coin.image, lunarcrush_id: lunarcrushId,
          categories, primary_chain: primaryChain, market_cap: coin.market_cap, market_cap_rank: coin.market_cap_rank,
          change_1h_pct: coin.percent_change_1h, change_7d_pct: coin.percent_change_7d, change_30d_pct: coin.percent_change_30d,
          volatility: coin.volatility, market_dominance: coin.market_dominance, circulating_supply: coin.circulating_supply, max_supply: coin.max_supply,
          galaxy_score: coin.galaxy_score != null ? Math.round(coin.galaxy_score) : null,
          galaxy_score_previous: coin.galaxy_score_previous != null ? Math.round(coin.galaxy_score_previous) : null,
          galaxy_score_change: galaxyScoreChange != null ? Math.round(galaxyScoreChange) : null,
          alt_rank: coin.alt_rank, alt_rank_previous: coin.alt_rank_previous, alt_rank_change: altRankChange,
          sentiment: coin.sentiment, social_volume_24h: coin.social_volume_24h, social_dominance: coin.social_dominance,
          interactions_24h: coin.interactions_24h, social_updated_at: new Date().toISOString(), social_source: 'lunarcrush',
          tier: coin.market_cap_rank ? (coin.market_cap_rank <= 50 ? 1 : coin.market_cap_rank <= 500 ? 2 : coin.market_cap_rank <= 2000 ? 3 : 4) : 4,
          tier_reason: coin.market_cap_rank ? 'market_cap' : null, is_active: preservedIsActive,
          lunarcrush_price_usd: coin.price, lunarcrush_volume_24h: coin.volume_24h, lunarcrush_change_24h_pct: coin.percent_change_24h,
          lunarcrush_high_24h: coin.high_24h || null, lunarcrush_low_24h: coin.low_24h || null, lunarcrush_price_updated_at: new Date().toISOString()
        };

        if (matchedCard) {
          const mergedContracts = mergeContracts(matchedCard.contracts, incomingContracts);
          updates.push({ id: matchedCard.id, ...cardData, contracts: Object.keys(mergedContracts).length > 0 ? mergedContracts : null, primary_chain: getPrimaryChain(mergedContracts) });
          updated++;
        } else {
          inserts.push({ ...cardData, contracts: Object.keys(incomingContracts).length > 0 ? incomingContracts : null });
          created++;
        }
      } catch (e) { errors++; console.error(`[tier3] Error processing ${coin.symbol}:`, e.message); }
    }

    const BATCH_SIZE = 50;
    for (let i = 0; i < updates.length; i += BATCH_SIZE) {
      for (const update of updates.slice(i, i + BATCH_SIZE)) {
        const { id, ...data } = update;
        const { error } = await supabase.from('token_cards').update(data).eq('id', id);
        if (error) { console.error(`[tier3] Update error:`, error.message); errors++; }
      }
    }
    for (let i = 0; i < inserts.length; i += BATCH_SIZE) {
      const { error } = await supabase.from('token_cards').upsert(inserts.slice(i, i + BATCH_SIZE), { onConflict: 'canonical_symbol', ignoreDuplicates: false });
      if (error) { console.error(`[tier3] Insert error:`, error.message); errors += BATCH_SIZE; }
    }

    const duration = Date.now() - startTime;
    console.log(`[tier3] Sync complete in ${duration}ms - Updated: ${updated}, Created: ${created}, Errors: ${errors}`);

    return new Response(JSON.stringify({
      success: true, tier: 3, range: '2001-3000',
      stats: { fetched: allCoins.length, updated, created, errors, duration_ms: duration }
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('[tier3] Fatal error:', error);
    return new Response(JSON.stringify({ success: false, error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
