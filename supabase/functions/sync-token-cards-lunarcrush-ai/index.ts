import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Process tokens per batch
const BATCH_SIZE = 50;

// Generate AI-style summary from existing token card data
function generateAISummary(token: any): { summary: string; shortSummary: string; themes: string[] } {
  const name = token.name || token.canonical_symbol;
  const symbol = token.canonical_symbol;
  
  // Sentiment analysis
  const sentiment = token.sentiment || 50;
  const sentimentLabel = sentiment > 70 ? 'strongly bullish' : 
                        sentiment > 55 ? 'bullish' : 
                        sentiment < 30 ? 'strongly bearish' : 
                        sentiment < 45 ? 'bearish' : 'neutral';
  
  // Galaxy score interpretation  
  const galaxyScore = token.galaxy_score || 0;
  const galaxyLabel = galaxyScore > 70 ? 'exceptional' :
                     galaxyScore > 60 ? 'strong' :
                     galaxyScore > 50 ? 'solid' :
                     galaxyScore > 40 ? 'moderate' : 'weak';
  
  // Price momentum
  const change24h = token.change_24h_pct || 0;
  const change7d = token.change_7d_pct || 0;
  const change30d = token.change_30d_pct || 0;
  
  let momentumPhrase = '';
  if (change24h > 5) momentumPhrase = `surging ${change24h.toFixed(1)}% today`;
  else if (change24h > 2) momentumPhrase = `up ${change24h.toFixed(1)}% in 24h`;
  else if (change24h < -5) momentumPhrase = `dropping ${Math.abs(change24h).toFixed(1)}% today`;
  else if (change24h < -2) momentumPhrase = `down ${Math.abs(change24h).toFixed(1)}% in 24h`;
  else momentumPhrase = 'trading sideways';
  
  // Trend analysis
  let trendPhrase = '';
  if (change7d > 10 && change30d > 20) trendPhrase = 'Strong uptrend across all timeframes.';
  else if (change7d < -10 && change30d < -20) trendPhrase = 'Downtrend persisting across timeframes.';
  else if (change7d > 0 && change30d > 0) trendPhrase = 'Positive momentum building.';
  else if (change7d < 0 && change30d < 0) trendPhrase = 'Negative pressure continues.';
  else trendPhrase = 'Mixed signals across timeframes.';
  
  // Social metrics
  const socialVolume = token.social_volume_24h || 0;
  let socialPhrase = '';
  if (socialVolume > 100000) socialPhrase = `Extremely high social activity with ${(socialVolume / 1000).toFixed(0)}K+ mentions.`;
  else if (socialVolume > 50000) socialPhrase = `Strong social engagement with ${(socialVolume / 1000).toFixed(0)}K mentions.`;
  else if (socialVolume > 10000) socialPhrase = `Active community discussion with ${(socialVolume / 1000).toFixed(0)}K mentions.`;
  else if (socialVolume > 1000) socialPhrase = `Moderate social volume.`;
  else socialPhrase = 'Quiet on social channels.';
  
  // Alt rank analysis
  const altRank = token.alt_rank || 0;
  const altRankChange = token.alt_rank_change || 0;
  let altRankPhrase = '';
  if (altRank > 0 && altRank <= 20) {
    altRankPhrase = `Top ${altRank} AltRank indicates strong relative performance.`;
  } else if (altRankChange > 10) {
    altRankPhrase = `AltRank improving significantly (+${altRankChange} positions).`;
  } else if (altRankChange < -10) {
    altRankPhrase = `AltRank declining (${altRankChange} positions).`;
  }
  
  // Market position
  const rank = token.market_cap_rank || 0;
  let rankPhrase = '';
  if (rank <= 10) rankPhrase = `Top 10 cryptocurrency`;
  else if (rank <= 50) rankPhrase = `Top 50 asset`;
  else if (rank <= 100) rankPhrase = `Top 100 token`;
  else rankPhrase = `Ranked #${rank}`;
  
  // Categories/themes
  const categories = token.categories || [];
  const themes = categories.slice(0, 5);
  
  // Build the summary
  const summary = `${name} (${symbol}) is currently ${momentumPhrase} with ${sentimentLabel} market sentiment. ${rankPhrase} with a ${galaxyLabel} Galaxy Score of ${galaxyScore}. ${trendPhrase} ${socialPhrase}${altRankPhrase ? ' ' + altRankPhrase : ''}`;
  
  // Short summary (280 chars max)
  const shortSummary = `${name} is ${momentumPhrase} with ${sentimentLabel} sentiment. Galaxy Score: ${galaxyScore}. ${socialVolume > 10000 ? 'High social activity.' : ''} ${trendPhrase}`.substring(0, 280);
  
  return { summary, shortSummary, themes };
}

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
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Parse optional parameters
    let offset = 0;
    let maxRank = 100;
    try {
      const body = await req.json();
      offset = body?.offset || 0;
      maxRank = body?.maxRank || 100;
    } catch {
      // No body, use defaults
    }

    // Fetch tokens that need AI summary updates
    // Get tokens with social data that haven't been summarized recently
    const { data: tokens, error: fetchError } = await supabase
      .from('token_cards')
      .select(`
        canonical_symbol, name, market_cap_rank, tier,
        sentiment, galaxy_score, galaxy_score_change, alt_rank, alt_rank_change,
        social_volume_24h, social_dominance, interactions_24h,
        change_24h_pct, change_7d_pct, change_30d_pct,
        categories, ai_summary_updated_at
      `)
      .lte('market_cap_rank', maxRank)
      .not('canonical_symbol', 'is', null)
      .not('galaxy_score', 'is', null)
      .order('market_cap_rank', { ascending: true })
      .range(offset, offset + BATCH_SIZE - 1);

    if (fetchError) {
      throw new Error(`Failed to fetch tokens: ${fetchError.message}`);
    }

    if (!tokens || tokens.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        message: 'No tokens to process',
        offset,
        logs
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    log(`📊 Processing ${tokens.length} tokens (offset: ${offset}, batch: ${BATCH_SIZE})`);

    let updated = 0;
    let errors = 0;
    const updates: any[] = [];

    for (const token of tokens) {
      try {
        const { summary, shortSummary, themes } = generateAISummary(token);
        
        updates.push({
          canonical_symbol: token.canonical_symbol,
          ai_summary: summary,
          ai_summary_short: shortSummary,
          key_themes: themes.length > 0 ? themes : null,
          ai_summary_updated_at: new Date().toISOString(),
          ai_token_cost: 0 // No external API cost
        });
        
        updated++;
      } catch (err) {
        log(`❌ ${token.canonical_symbol}: ${err.message}`);
        errors++;
      }
    }

    // Batch update all tokens
    if (updates.length > 0) {
      for (const update of updates) {
        const { canonical_symbol, ...data } = update;
        const { error: updateError } = await supabase
          .from('token_cards')
          .update(data)
          .eq('canonical_symbol', canonical_symbol);
        
        if (updateError) {
          log(`❌ ${canonical_symbol}: Update failed - ${updateError.message}`);
          errors++;
          updated--;
        }
      }
    }

    // Track usage (no tokens used since we're generating locally)
    const today = new Date().toISOString().split('T')[0];
    const { data: existingUsage } = await supabase
      .from('lunarcrush_ai_usage')
      .select('calls_made')
      .eq('date', today)
      .eq('source', 'sync-token-cards-lunarcrush-ai')
      .single();

    if (existingUsage) {
      await supabase
        .from('lunarcrush_ai_usage')
        .update({
          calls_made: existingUsage.calls_made + updated,
          updated_at: new Date().toISOString()
        })
        .eq('date', today)
        .eq('source', 'sync-token-cards-lunarcrush-ai');
    } else {
      await supabase
        .from('lunarcrush_ai_usage')
        .insert({
          date: today,
          source: 'sync-token-cards-lunarcrush-ai',
          tokens_used: 0,
          calls_made: updated
        });
    }

    const duration = Date.now() - startTime;
    const nextOffset = offset + tokens.length;
    log(`\n📈 Summary: ${updated} summaries generated, ${errors} errors in ${duration}ms`);

    return new Response(JSON.stringify({
      success: true,
      processed: tokens.length,
      updated,
      errors,
      durationMs: duration,
      currentOffset: offset,
      nextOffset,
      hasMore: tokens.length === BATCH_SIZE,
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
