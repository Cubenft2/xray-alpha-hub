import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Process all 100 tokens per run (4x daily = 400 calls/day)
const MAX_TOKENS = 100;

// LunarCrush AI API endpoint
const LUNARCRUSH_AI_URL = "https://lunarcrush.ai/api/topic";

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  const logs: string[] = [];
  const log = (msg: string) => {
    console.log(msg);
    logs.push(msg);
  };

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lunarcrushApiKey = Deno.env.get('LUNARCRUSH_API_KEY');

    if (!lunarcrushApiKey) {
      throw new Error('LUNARCRUSH_API_KEY not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch top 100 tokens by market cap rank
    const { data: tokens, error: fetchError } = await supabase
      .from('token_cards')
      .select('canonical_symbol, name, tier, market_cap_rank')
      .lte('market_cap_rank', MAX_TOKENS)
      .not('canonical_symbol', 'is', null)
      .order('market_cap_rank', { ascending: true, nullsFirst: false })
      .limit(MAX_TOKENS);

    if (fetchError) {
      throw new Error(`Failed to fetch tokens: ${fetchError.message}`);
    }

    if (!tokens || tokens.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        message: 'No tokens to process',
        logs
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    log(`📊 Processing ${tokens.length} tokens (all top 100)`);

    let updated = 0;
    let errors = 0;
    let totalTokenCost = 0;

    for (const token of tokens) {
      const symbol = token.canonical_symbol;
      
      try {
        // Call LunarCrush AI API
        const response = await fetch(`${LUNARCRUSH_AI_URL}/${symbol.toLowerCase()}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${lunarcrushApiKey}`,
            'Accept': 'application/json'
          }
        });

        if (!response.ok) {
          log(`⚠️ ${symbol}: API returned ${response.status}`);
          errors++;
          continue;
        }

        const data = await response.json();
        
        // Extract AI summary from response
        const aiSummary = data.summary || data.narrative || data.content || data.text || null;
        const tokenCost = data.tokens_used || data.token_count || 5000; // Estimate if not provided

        if (aiSummary) {
          const { error: updateError } = await supabase
            .from('token_cards')
            .update({
              ai_summary: aiSummary,
              ai_summary_updated_at: new Date().toISOString(),
              ai_token_cost: tokenCost
            })
            .eq('canonical_symbol', symbol);

          if (updateError) {
            log(`❌ ${symbol}: Failed to update - ${updateError.message}`);
            errors++;
          } else {
            log(`✅ ${symbol}: Updated AI summary (${tokenCost} tokens)`);
            updated++;
            totalTokenCost += tokenCost;
          }
        } else {
          log(`⚠️ ${symbol}: No AI summary in response`);
        }

        // Rate limit: small delay between calls
        await new Promise(resolve => setTimeout(resolve, 200));

      } catch (err) {
        log(`❌ ${symbol}: ${err.message}`);
        errors++;
      }
    }

    // Track AI token usage
    const today = new Date().toISOString().split('T')[0];
    
    // Get existing usage for today
    const { data: existingUsage } = await supabase
      .from('lunarcrush_ai_usage')
      .select('tokens_used, calls_made')
      .eq('date', today)
      .eq('source', 'sync-token-cards-lunarcrush-ai')
      .single();

    if (existingUsage) {
      // Update existing record
      await supabase
        .from('lunarcrush_ai_usage')
        .update({
          tokens_used: existingUsage.tokens_used + totalTokenCost,
          calls_made: existingUsage.calls_made + updated,
          updated_at: new Date().toISOString()
        })
        .eq('date', today)
        .eq('source', 'sync-token-cards-lunarcrush-ai');
    } else {
      // Insert new record
      await supabase
        .from('lunarcrush_ai_usage')
        .insert({
          date: today,
          source: 'sync-token-cards-lunarcrush-ai',
          tokens_used: totalTokenCost,
          calls_made: updated
        });
    }

    const duration = Date.now() - startTime;
    log(`\n📈 Summary: ${updated} updated, ${errors} errors, ${totalTokenCost} tokens used in ${duration}ms`);

    return new Response(JSON.stringify({
      success: true,
      processed: tokens.length,
      updated,
      errors,
      tokensUsed: totalTokenCost,
      durationMs: duration,
      logs
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    log(`❌ Fatal error: ${error.message}`);
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      logs
    }), { 
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  }
});
