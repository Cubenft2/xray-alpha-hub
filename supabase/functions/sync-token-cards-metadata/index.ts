import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CoinGeckoResponse {
  id: string;
  symbol: string;
  name: string;
  description?: { en?: string };
  links?: {
    homepage?: string[];
    twitter_screen_name?: string;
    telegram_channel_identifier?: string;
    chat_url?: string[];
    repos_url?: { github?: string[] };
  };
  categories?: string[];
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

    // Parse request body for optional parameters
    let batchSize = 500; // Increased for bulk sync (Pro API: 500 calls/min)
    let forceRefresh = false;
    
    try {
      const body = await req.json();
      if (body.batchSize) batchSize = Math.min(body.batchSize, 500);
      if (body.forceRefresh) forceRefresh = body.forceRefresh;
    } catch {
      // No body or invalid JSON, use defaults
    }

    console.log(`[sync-token-cards-metadata] Starting sync, batchSize=${batchSize}, forceRefresh=${forceRefresh}`);

    // Query tokens that need metadata (have coingecko_id but no description)
    // Prioritize by tier (1, 2, 3, 4) then by market cap rank
    let query = supabase
      .from('token_cards')
      .select('id, canonical_symbol, coingecko_id, tier, market_cap_rank')
      .not('coingecko_id', 'is', null);

    if (!forceRefresh) {
      query = query.or('description.is.null,description.eq.'); // No description yet
    }

    const { data: tokens, error: fetchError } = await query
      .order('tier', { ascending: true, nullsFirst: false })
      .order('market_cap_rank', { ascending: true, nullsFirst: true })
      .limit(batchSize);

    if (fetchError) {
      throw new Error(`Failed to fetch tokens: ${fetchError.message}`);
    }

    if (!tokens || tokens.length === 0) {
      console.log('[sync-token-cards-metadata] No tokens need metadata updates');
      return new Response(JSON.stringify({
        success: true,
        message: 'No tokens need metadata updates',
        processed: 0,
        duration_ms: Date.now() - startTime
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    console.log(`[sync-token-cards-metadata] Found ${tokens.length} tokens to process`);

    let processed = 0;
    let failed = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const token of tokens) {
      try {
        // Rate limit: 100ms delay between requests (Pro API allows 500/min)
        if (processed > 0) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }

        const cgId = token.coingecko_id;
        if (!cgId) {
          skipped++;
          continue;
        }

        // Fetch from CoinGecko API
        const headers: Record<string, string> = {
          'Accept': 'application/json',
        };
        
        // Use pro API if key available, otherwise demo API
        let cgUrl: string;
        if (coingeckoApiKey) {
          headers['x-cg-pro-api-key'] = coingeckoApiKey;
          cgUrl = `https://pro-api.coingecko.com/api/v3/coins/${cgId}?localization=false&tickers=false&market_data=false&community_data=false&developer_data=false&sparkline=false`;
        } else {
          cgUrl = `https://api.coingecko.com/api/v3/coins/${cgId}?localization=false&tickers=false&market_data=false&community_data=false&developer_data=false&sparkline=false`;
        }
        
        console.log(`[sync-token-cards-metadata] Fetching ${token.canonical_symbol} from ${cgUrl.substring(0, 60)}...`);
        const response = await fetch(cgUrl, { headers });

        if (!response.ok) {
          const errorBody = await response.text();
          console.error(`[sync-token-cards-metadata] CoinGecko error for ${cgId}: ${response.status} - ${errorBody.substring(0, 200)}`);
          
          if (response.status === 404) {
            console.warn(`[sync-token-cards-metadata] CoinGecko ID not found: ${cgId}`);
            skipped++;
            continue;
          }
          if (response.status === 429) {
            console.warn('[sync-token-cards-metadata] Rate limited, stopping batch');
            break;
          }
          throw new Error(`CoinGecko API error: ${response.status}`);
        }

        const data: CoinGeckoResponse = await response.json();

        // Extract metadata
        const description = data.description?.en?.substring(0, 5000) || null; // Limit description length
        const website = data.links?.homepage?.find(url => url && url.length > 0) || null;
        const twitter = data.links?.twitter_screen_name || null;
        const telegram = data.links?.telegram_channel_identifier || null;
        const discord = data.links?.chat_url?.find(url => url?.includes('discord')) || null;
        const github = data.links?.repos_url?.github?.[0] || null;
        const categories = data.categories || [];

        // Update token_cards
        const { error: updateError } = await supabase
          .from('token_cards')
          .update({
            description,
            website: website,
            twitter_url: twitter ? `https://twitter.com/${twitter}` : null,
            telegram_url: telegram ? `https://t.me/${telegram}` : null,
            discord_url: discord,
            github_url: github,
            categories: categories.length > 0 ? categories : null,
            metadata_updated_at: new Date().toISOString()
          })
          .eq('id', token.id);

        if (updateError) {
          console.error(`[sync-token-cards-metadata] Failed to update ${token.canonical_symbol}: ${updateError.message}`);
          errors.push(`${token.canonical_symbol}: ${updateError.message}`);
          failed++;
        } else {
          console.log(`[sync-token-cards-metadata] Updated ${token.canonical_symbol} (${cgId}): desc=${!!description}, web=${!!website}, tw=${!!twitter}`);
          processed++;
        }
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        console.error(`[sync-token-cards-metadata] Error processing ${token.canonical_symbol}: ${errMsg}`);
        errors.push(`${token.canonical_symbol}: ${errMsg}`);
        failed++;
      }
    }

    const duration = Date.now() - startTime;
    console.log(`[sync-token-cards-metadata] Completed: processed=${processed}, failed=${failed}, skipped=${skipped}, duration=${duration}ms`);

    return new Response(JSON.stringify({
      success: true,
      processed,
      failed,
      skipped,
      errors: errors.slice(0, 10), // Limit error list
      duration_ms: duration
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error(`[sync-token-cards-metadata] Fatal error: ${errMsg}`);
    
    return new Response(JSON.stringify({
      success: false,
      error: errMsg,
      duration_ms: Date.now() - startTime
    }), { 
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  }
});
