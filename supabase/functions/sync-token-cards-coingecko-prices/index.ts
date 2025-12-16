import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CoinGeckoMarketData {
  id: string;
  symbol: string;
  name: string;
  current_price: number;
  market_cap: number;
  market_cap_rank: number;
  total_volume: number;
  high_24h: number;
  low_24h: number;
  price_change_percentage_24h: number;
  circulating_supply: number;
  total_supply: number | null;
  max_supply: number | null;
  ath: number;
  ath_date: string;
  atl: number;
  atl_date: string;
  last_updated: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const coingeckoApiKey = Deno.env.get('COINGECKO_API_KEY');
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('[sync-token-cards-coingecko-prices] Starting CoinGecko price sync...');

    // Log API call for rate limiting tracking
    await supabase.from('external_api_calls').insert({
      api_name: 'coingecko',
      function_name: 'sync-token-cards-coingecko-prices',
      call_count: 1,
      success: true
    });

    // Fetch token_cards that have coingecko_id (we can fetch prices for these)
    const { data: tokenCards, error: fetchError } = await supabase
      .from('token_cards')
      .select('id, canonical_symbol, coingecko_id, tier')
      .not('coingecko_id', 'is', null)
      .order('tier', { ascending: true })
      .order('market_cap_rank', { ascending: true, nullsFirst: false })
      .limit(2000);

    if (fetchError) {
      console.error('[sync-token-cards-coingecko-prices] Error fetching token_cards:', fetchError);
      throw fetchError;
    }

    if (!tokenCards || tokenCards.length === 0) {
      console.log('[sync-token-cards-coingecko-prices] No token_cards with coingecko_id found');
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'No tokens with CoinGecko IDs to sync',
        updated: 0 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[sync-token-cards-coingecko-prices] Found ${tokenCards.length} tokens with coingecko_id`);

    // Build coingecko_id -> token_card mapping
    const cgIdToToken = new Map<string, { id: string; symbol: string }>();
    for (const token of tokenCards) {
      if (token.coingecko_id) {
        cgIdToToken.set(token.coingecko_id.toLowerCase(), {
          id: token.id,
          symbol: token.canonical_symbol
        });
      }
    }

    // CoinGecko API allows up to 250 coins per request
    // We'll fetch in batches to stay within rate limits
    const cgIds = Array.from(cgIdToToken.keys());
    const BATCH_SIZE = 250;
    const batches = [];
    
    for (let i = 0; i < cgIds.length; i += BATCH_SIZE) {
      batches.push(cgIds.slice(i, i + BATCH_SIZE));
    }

    console.log(`[sync-token-cards-coingecko-prices] Will fetch ${batches.length} batches (${cgIds.length} total coins)`);

    let totalUpdated = 0;
    let totalErrors = 0;

    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];
      const idsParam = batch.join(',');

      // Build CoinGecko API URL
      const baseUrl = coingeckoApiKey 
        ? 'https://pro-api.coingecko.com/api/v3'
        : 'https://api.coingecko.com/api/v3';
      
      const url = `${baseUrl}/coins/markets?vs_currency=usd&ids=${idsParam}&order=market_cap_desc&per_page=250&page=1&sparkline=false&price_change_percentage=24h`;

      const headers: Record<string, string> = {
        'Accept': 'application/json',
      };
      
      if (coingeckoApiKey) {
        headers['x-cg-pro-api-key'] = coingeckoApiKey;
      }

      console.log(`[sync-token-cards-coingecko-prices] Fetching batch ${batchIndex + 1}/${batches.length} (${batch.length} coins)...`);

      try {
        const response = await fetch(url, { headers });
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error(`[sync-token-cards-coingecko-prices] CoinGecko API error (batch ${batchIndex + 1}):`, response.status, errorText);
          
          // Log failed API call
          await supabase.from('external_api_calls').insert({
            api_name: 'coingecko',
            function_name: 'sync-token-cards-coingecko-prices',
            call_count: 1,
            success: false,
            error_message: `HTTP ${response.status}: ${errorText.slice(0, 200)}`
          });
          
          // If rate limited, stop and return partial results
          if (response.status === 429) {
            console.log('[sync-token-cards-coingecko-prices] Rate limited, stopping early');
            break;
          }
          continue;
        }

        const marketData: CoinGeckoMarketData[] = await response.json();
        console.log(`[sync-token-cards-coingecko-prices] Received ${marketData.length} coins from CoinGecko`);

        // Update each token_card with CoinGecko data
        const updates: any[] = [];
        const now = new Date().toISOString();

        for (const coin of marketData) {
          const token = cgIdToToken.get(coin.id.toLowerCase());
          if (!token) continue;

          updates.push({
            id: token.id,
            canonical_symbol: token.symbol, // Required for INSERT attempt in upsert
            // Price data (dedicated CoinGecko columns)
            coingecko_price_usd: coin.current_price,
            coingecko_volume_24h: coin.total_volume,
            coingecko_change_24h_pct: coin.price_change_percentage_24h,
            coingecko_high_24h: coin.high_24h,
            coingecko_low_24h: coin.low_24h,
            coingecko_price_updated_at: now,
            // Market data (CoinGecko is authoritative)
            coingecko_market_cap: coin.market_cap,
            coingecko_market_cap_rank: coin.market_cap_rank,
            // Supply data
            coingecko_circulating_supply: coin.circulating_supply,
            coingecko_total_supply: coin.total_supply,
            coingecko_max_supply: coin.max_supply,
            // ATH/ATL data
            coingecko_ath_price: coin.ath,
            coingecko_ath_date: coin.ath_date,
            coingecko_atl_price: coin.atl,
            coingecko_atl_date: coin.atl_date,
            // Update timestamp
            updated_at: now
          });
        }

        // Batch upsert
        if (updates.length > 0) {
          const UPSERT_BATCH = 50;
          for (let i = 0; i < updates.length; i += UPSERT_BATCH) {
            const upsertBatch = updates.slice(i, i + UPSERT_BATCH);
            
            const { error: upsertError } = await supabase
              .from('token_cards')
              .upsert(upsertBatch, { onConflict: 'id' });

            if (upsertError) {
              console.error(`[sync-token-cards-coingecko-prices] Upsert error:`, upsertError);
              totalErrors += upsertBatch.length;
            } else {
              totalUpdated += upsertBatch.length;
            }
          }
        }

        console.log(`[sync-token-cards-coingecko-prices] Batch ${batchIndex + 1} complete: ${updates.length} updated`);

      } catch (fetchError) {
        console.error(`[sync-token-cards-coingecko-prices] Fetch error (batch ${batchIndex + 1}):`, fetchError);
        totalErrors++;
      }

      // Delay between batches to respect rate limits (1.5 seconds)
      if (batchIndex < batches.length - 1) {
        await new Promise(r => setTimeout(r, 1500));
      }
    }

    const duration = Date.now() - startTime;
    console.log(`[sync-token-cards-coingecko-prices] Sync complete in ${duration}ms`);
    console.log(`[sync-token-cards-coingecko-prices] Updated: ${totalUpdated}, Errors: ${totalErrors}`);

    return new Response(JSON.stringify({
      success: true,
      updated: totalUpdated,
      errors: totalErrors,
      totalCoins: cgIds.length,
      batches: batches.length,
      duration_ms: duration
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[sync-token-cards-coingecko-prices] Fatal error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
