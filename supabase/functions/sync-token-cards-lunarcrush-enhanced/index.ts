import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const LUNARCRUSH_API_KEY = Deno.env.get('LUNARCRUSH_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Hardcoded Top 25 tokens by market cap - no database queries for selection
// Source: top100MarketCap.ts - updated Dec 2024
const TOP_25_SYMBOLS = [
  'BTC', 'ETH', 'XRP', 'USDT', 'SOL',
  'BNB', 'DOGE', 'USDC', 'ADA', 'TRX',
  'HYPE', 'AVAX', 'LINK', 'SUI', 'XLM',
  'SHIB', 'TON', 'HBAR', 'BCH', 'DOT',
  'LTC', 'UNI', 'LEO', 'PEPE', 'NEAR'
];

// 6 second delay between tokens to respect rate limits
const DELAY_BETWEEN_TOKENS_MS = 6000;

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Helper to log API calls for rate limit tracking
async function logApiCall(supabase: any, success: boolean, errorMessage?: string) {
  try {
    await supabase.from('external_api_calls').insert({
      api_name: 'lunarcrush',
      function_name: 'sync-token-cards-lunarcrush-enhanced',
      call_count: 1,
      success,
      error_message: errorMessage || null,
    });
  } catch (e) {
    console.error('Failed to log API call:', e);
  }
}

async function fetchLunarCrush(endpoint: string, symbol: string, supabase: any): Promise<any> {
  const lowerSymbol = symbol.toLowerCase();
  const url = `https://lunarcrush.com/api4/public/topic/${lowerSymbol}/${endpoint}/v1`;
  
  try {
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${LUNARCRUSH_API_KEY}`,
      },
    });
    
    await logApiCall(supabase, response.ok, response.ok ? undefined : `${response.status}`);
    
    if (!response.ok) {
      console.log(`LunarCrush ${endpoint} for ${symbol}: ${response.status}`);
      return null;
    }
    
    const data = await response.json();
    console.log(`LunarCrush ${endpoint} for ${symbol}: OK`);
    return data;
  } catch (error) {
    console.error(`Error fetching ${endpoint} for ${symbol}:`, error);
    await logApiCall(supabase, false, error.message);
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

    console.log(`Processing all ${TOP_25_SYMBOLS.length} top tokens with ${DELAY_BETWEEN_TOKENS_MS}ms delay between each`);
    
    const results = {
      processed: 0,
      updated: 0,
      skipped: 0,
      errors: [] as string[],
    };

    for (let i = 0; i < TOP_25_SYMBOLS.length; i++) {
      const symbol = TOP_25_SYMBOLS[i];
      console.log(`[${i + 1}/${TOP_25_SYMBOLS.length}] Fetching enhanced data for ${symbol}`);
      
      try {
        // Fetch all 4 endpoints for this token
        const [whatsupData, postsData, newsData, creatorsData] = await Promise.all([
          fetchLunarCrush('whatsup', symbol, supabase),
          fetchLunarCrush('posts', symbol, supabase),
          fetchLunarCrush('news', symbol, supabase),
          fetchLunarCrush('creators', symbol, supabase),
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
        } else {
          results.skipped++;
          console.log(`Skipped ${symbol} - no data returned`);
        }
        
        results.processed++;
        
      } catch (error) {
        console.error(`Error processing ${symbol}:`, error);
        results.errors.push(`${symbol}: ${error.message}`);
      }
      
      // Add delay between tokens (except after the last one)
      if (i < TOP_25_SYMBOLS.length - 1) {
        console.log(`Waiting ${DELAY_BETWEEN_TOKENS_MS}ms before next token...`);
        await sleep(DELAY_BETWEEN_TOKENS_MS);
      }
    }

    const duration = Date.now() - startTime;
    const durationMinutes = (duration / 60000).toFixed(1);
    console.log(`Completed in ${durationMinutes} minutes: ${results.processed} processed, ${results.updated} updated, ${results.skipped} skipped, ${results.errors.length} errors`);

    return new Response(JSON.stringify({
      success: true,
      tokensProcessed: results.processed,
      tokensUpdated: results.updated,
      tokensSkipped: results.skipped,
      errors: results.errors,
      totalTokens: TOP_25_SYMBOLS.length,
      durationMs: duration,
      durationMinutes: parseFloat(durationMinutes),
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
