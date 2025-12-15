import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const LUNARCRUSH_API_KEY = Deno.env.get('LUNARCRUSH_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const TOKENS_PER_RUN = 2; // 2 tokens × 4 endpoints = 8 calls (under 10/min limit)
const CACHE_KEY = 'lunarcrush_enhanced_offset';

async function fetchLunarCrush(endpoint: string, symbol: string): Promise<any> {
  // LunarCrush API v4 uses lowercase symbols and /v1 suffix
  const lowerSymbol = symbol.toLowerCase();
  const url = `https://lunarcrush.com/api4/public/topic/${lowerSymbol}/${endpoint}/v1`;
  
  try {
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${LUNARCRUSH_API_KEY}`,
      },
    });
    
    if (!response.ok) {
      console.log(`LunarCrush ${endpoint} for ${symbol}: ${response.status}`);
      return null;
    }
    
    const data = await response.json();
    console.log(`LunarCrush ${endpoint} for ${symbol}: OK`);
    return data;
  } catch (error) {
    console.error(`Error fetching ${endpoint} for ${symbol}:`, error);
    return null;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    if (!LUNARCRUSH_API_KEY) {
      throw new Error('LUNARCRUSH_API_KEY not configured');
    }

    // Get current offset from cache
    const { data: cacheData } = await supabase
      .from('cache_kv')
      .select('v')
      .eq('k', CACHE_KEY)
      .single();
    
    let currentOffset = cacheData?.v?.offset || 0;
    
    // Fetch Tier 1-2 tokens (top 500 by market cap rank)
    const { data: tokens, error: fetchError } = await supabase
      .from('token_cards')
      .select('canonical_symbol, tier, market_cap_rank')
      .in('tier', [1, 2])
      .not('canonical_symbol', 'is', null)
      .order('market_cap_rank', { ascending: true, nullsFirst: false })
      .range(currentOffset, currentOffset + TOKENS_PER_RUN - 1);
    
    if (fetchError) {
      throw new Error(`Failed to fetch tokens: ${fetchError.message}`);
    }
    
    if (!tokens || tokens.length === 0) {
      // Reset offset and start over
      await supabase
        .from('cache_kv')
        .upsert({
          k: CACHE_KEY,
          v: { offset: 0, lastReset: new Date().toISOString() },
          expires_at: new Date(Date.now() + 86400000).toISOString(),
        }, { onConflict: 'k' });
      
      console.log('Completed full cycle, resetting offset to 0');
      return new Response(JSON.stringify({
        success: true,
        message: 'Cycle complete, reset to beginning',
        tokensProcessed: 0,
        nextOffset: 0,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    console.log(`Processing ${tokens.length} tokens starting at offset ${currentOffset}`);
    
    const results = {
      processed: 0,
      updated: 0,
      errors: [] as string[],
    };

    for (const token of tokens) {
      const symbol = token.canonical_symbol;
      console.log(`Fetching enhanced data for ${symbol} (rank ${token.market_cap_rank})`);
      
      try {
        // Fetch all 4 endpoints for this token
        const [whatsupData, postsData, newsData, creatorsData] = await Promise.all([
          fetchLunarCrush('whatsup', symbol),
          fetchLunarCrush('posts', symbol),
          fetchLunarCrush('news', symbol),
          fetchLunarCrush('creators', symbol),
        ]);
        
        const now = new Date().toISOString();
        const updateData: Record<string, any> = {};
        
        // Process whatsup (AI summary)
        if (whatsupData?.data) {
          updateData.ai_summary = whatsupData.data.summary || whatsupData.data.whatsup || null;
          updateData.key_themes = whatsupData.data.themes || whatsupData.data.key_themes || null;
          updateData.ai_updated_at = now;
        }
        
        // Process posts (top 5)
        if (postsData?.data && Array.isArray(postsData.data)) {
          updateData.top_posts = postsData.data.slice(0, 5).map((post: any) => ({
            id: post.id,
            text: post.text || post.body,
            created_at: post.created_at || post.time,
            interactions: post.interactions || post.engagement,
            sentiment: post.sentiment,
            platform: post.network || post.source,
            url: post.url,
            author: post.creator?.name || post.author,
          }));
          updateData.posts_updated_at = now;
        }
        
        // Process news (top 5)
        if (newsData?.data && Array.isArray(newsData.data)) {
          updateData.top_news = newsData.data.slice(0, 5).map((news: any) => ({
            id: news.id,
            title: news.title,
            url: news.url,
            source: news.source || news.publisher,
            published_at: news.created_at || news.time,
            sentiment: news.sentiment,
            image: news.image,
          }));
          updateData.news_updated_at = now;
        }
        
        // Process creators (top 5)
        if (creatorsData?.data && Array.isArray(creatorsData.data)) {
          updateData.top_creators = creatorsData.data.slice(0, 5).map((creator: any) => ({
            id: creator.id,
            name: creator.name || creator.display_name,
            handle: creator.handle || creator.screen_name,
            platform: creator.network || 'twitter',
            followers: creator.followers || creator.follower_count,
            engagement: creator.engagement || creator.interactions,
            influence_score: creator.influence_score || creator.rank,
            avatar: creator.profile_image || creator.avatar,
          }));
          updateData.creators_updated_at = now;
        }
        
        // Only update if we got some data
        if (Object.keys(updateData).length > 0) {
          const { error: updateError } = await supabase
            .from('token_cards')
            .update(updateData)
            .eq('canonical_symbol', symbol);
          
          if (updateError) {
            console.error(`Error updating ${symbol}:`, updateError);
            results.errors.push(`${symbol}: ${updateError.message}`);
          } else {
            results.updated++;
            console.log(`Updated ${symbol} with ${Object.keys(updateData).length} fields`);
          }
        }
        
        results.processed++;
        
      } catch (error) {
        console.error(`Error processing ${symbol}:`, error);
        results.errors.push(`${symbol}: ${error.message}`);
      }
    }

    // Update offset for next run
    const nextOffset = currentOffset + tokens.length;
    await supabase
      .from('cache_kv')
      .upsert({
        k: CACHE_KEY,
        v: { 
          offset: nextOffset, 
          lastProcessed: tokens.map(t => t.canonical_symbol),
          lastRun: new Date().toISOString(),
        },
        expires_at: new Date(Date.now() + 86400000).toISOString(),
      }, { onConflict: 'k' });

    const duration = Date.now() - startTime;
    console.log(`Completed in ${duration}ms: ${results.processed} processed, ${results.updated} updated, ${results.errors.length} errors`);

    return new Response(JSON.stringify({
      success: true,
      tokensProcessed: results.processed,
      tokensUpdated: results.updated,
      errors: results.errors,
      currentOffset,
      nextOffset,
      durationMs: duration,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('sync-token-cards-lunarcrush-enhanced error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
    }), { 
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
