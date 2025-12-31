import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Categorize topic based on prefix pattern
function categorize(topic: string): string {
  if (topic.startsWith('coins ')) return 'crypto_narrative';
  if (topic.startsWith('stocks ')) return 'stock_sector';
  if (topic.startsWith('$')) return 'ticker';
  return 'general';
}

// Log API call for rate limit tracking
async function logApiCall(
  supabase: any,
  functionName: string,
  callCount: number,
  success: boolean,
  errorMessage?: string
) {
  try {
    await supabase.from('external_api_calls').insert({
      api_name: 'lunarcrush',
      function_name: functionName,
      call_count: callCount,
      success,
      error_message: errorMessage || null,
    });
  } catch (e) {
    console.error('[sync-lunarcrush-topics] Failed to log API call:', e);
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  console.log('[sync-lunarcrush-topics] Starting sync...');

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const lunarCrushApiKey = Deno.env.get('LUNARCRUSH_API_KEY')!;

  if (!lunarCrushApiKey) {
    console.error('[sync-lunarcrush-topics] LUNARCRUSH_API_KEY not configured');
    return new Response(JSON.stringify({ error: 'API key not configured' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // Fetch topics list (1 API call = up to 1000 topics!)
    const response = await fetch(
      'https://lunarcrush.com/api4/public/topics/list/v1?limit=500',
      {
        headers: { 'Authorization': `Bearer ${lunarCrushApiKey}` },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[sync-lunarcrush-topics] LunarCrush API error:', response.status, errorText);
      await logApiCall(supabase, 'sync-lunarcrush-topics', 1, false, `HTTP ${response.status}`);
      return new Response(JSON.stringify({ error: 'API fetch failed', status: response.status }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Log successful API call
    await logApiCall(supabase, 'sync-lunarcrush-topics', 1, true);

    const responseData = await response.json();
    const topics = responseData.data || [];
    
    if (!Array.isArray(topics) || topics.length === 0) {
      console.warn('[sync-lunarcrush-topics] No topics returned from API');
      return new Response(JSON.stringify({ success: true, synced: 0, message: 'No topics returned' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const snapshotAt = new Date().toISOString();

    // Transform and prepare rows
    const rows = topics.map((t: any) => ({
      topic: t.topic || '',
      title: t.title || t.topic || '',
      category: categorize(t.topic || ''),
      topic_rank: t.topic_rank ?? 0,
      rank_1h_ago: t.topic_rank_1h_previous ?? null,
      rank_24h_ago: t.topic_rank_24h_previous ?? null,
      num_contributors: t.num_contributors ?? null,
      num_posts: t.num_posts ?? null,
      interactions_24h: t.interactions_24h ?? null,
      snapshot_at: snapshotAt,
    })).filter((r: any) => r.topic && r.topic.length > 0);

    console.log(`[sync-lunarcrush-topics] Prepared ${rows.length} topics for insert`);

    // Insert in batches of 100 to avoid payload size limits
    const batchSize = 100;
    let insertedCount = 0;
    
    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize);
      const { error } = await supabase.from('trending_topics').insert(batch);
      
      if (error) {
        console.error(`[sync-lunarcrush-topics] Insert error for batch ${i / batchSize + 1}:`, error);
        // Continue with next batch even if one fails
      } else {
        insertedCount += batch.length;
      }
    }

    // Cleanup old snapshots (keep 24 hours)
    const cutoffTime = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { error: deleteError, count: deletedCount } = await supabase
      .from('trending_topics')
      .delete()
      .lt('snapshot_at', cutoffTime);

    if (deleteError) {
      console.warn('[sync-lunarcrush-topics] Cleanup error:', deleteError);
    } else {
      console.log(`[sync-lunarcrush-topics] Cleaned up ${deletedCount || 0} old snapshots`);
    }

    // Count by category for logging
    const categories = {
      crypto_narrative: rows.filter((r: any) => r.category === 'crypto_narrative').length,
      stock_sector: rows.filter((r: any) => r.category === 'stock_sector').length,
      ticker: rows.filter((r: any) => r.category === 'ticker').length,
      general: rows.filter((r: any) => r.category === 'general').length,
    };

    const duration = Date.now() - startTime;
    console.log(`[sync-lunarcrush-topics] Completed in ${duration}ms - Synced ${insertedCount} topics`);
    console.log(`[sync-lunarcrush-topics] Categories:`, categories);

    return new Response(JSON.stringify({
      success: true,
      synced: insertedCount,
      snapshot_at: snapshotAt,
      categories,
      duration_ms: duration,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[sync-lunarcrush-topics] Unexpected error:', error);
    await logApiCall(supabase, 'sync-lunarcrush-topics', 1, false, String(error));
    
    return new Response(JSON.stringify({ 
      error: 'Unexpected error', 
      message: error instanceof Error ? error.message : String(error) 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
