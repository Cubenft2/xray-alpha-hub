import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface LunarCrushAsset {
  name: string;
  symbol: string;
  galaxy_score?: number;
  gs?: number;
  sentiment?: number;
  sentiment_score?: number;
  social_volume?: number;
  social_volume_24h?: number;
  volume_24h?: number;
  social_dominance?: number;
  market_dominance?: number;
  fomo_score?: number;
  alt_rank?: number;
}

interface NormalizedAsset {
  name: string;
  symbol: string;
  galaxy_score: number;
  sentiment: number;
  social_volume: number;
  social_dominance: number;
  fomo_score: number;
  alt_rank?: number;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🚀 Starting LunarCrush scheduled sync...');

    // Verify cron secret for security
    const cronSecret = Deno.env.get('CRON_SECRET');
    const authHeader = req.headers.get('authorization');
    
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      console.warn('⚠️ Unauthorized cron attempt');
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch data from LunarCrush API
    const lunarKey = Deno.env.get('LUNARCRUSH_API_KEY');
    if (!lunarKey) {
      throw new Error('LUNARCRUSH_API_KEY not configured');
    }

    console.log('📡 Fetching top assets from LunarCrush API...');
    
    const response = await fetch(
      'https://lunarcrush.com/api4/public/coins/list/v2?limit=20&sort=galaxy_score',
      {
        headers: {
          'Authorization': `Bearer ${lunarKey}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`LunarCrush API error: ${response.status} ${response.statusText}`);
    }

    const apiData = await response.json();
    console.log('✅ LunarCrush API response received');

    // Extract assets from various possible response formats
    let assets: LunarCrushAsset[] = [];
    if (apiData.data && Array.isArray(apiData.data)) {
      assets = apiData.data;
    } else if (Array.isArray(apiData)) {
      assets = apiData;
    } else {
      throw new Error('Unexpected API response format');
    }

    if (assets.length === 0) {
      console.warn('⚠️ No assets returned from LunarCrush API');
      return new Response(
        JSON.stringify({ success: false, message: 'No data available' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`📊 Processing ${assets.length} assets`);

    // Normalize the data
    const normalizedData: NormalizedAsset[] = assets.map((asset: LunarCrushAsset) => ({
      name: asset.name || asset.symbol,
      symbol: String(asset.symbol || '').toUpperCase(),
      galaxy_score: Number(asset.galaxy_score || asset.gs || 0),
      sentiment: Number(asset.sentiment || asset.sentiment_score || 0),
      social_volume: Number(asset.social_volume || asset.social_volume_24h || asset.volume_24h || 0),
      social_dominance: Number(asset.social_dominance || asset.market_dominance || 0),
      fomo_score: Number(asset.fomo_score || asset.alt_rank || 0),
      alt_rank: asset.alt_rank ? Number(asset.alt_rank) : undefined,
    }));

    console.log(`🔄 Normalized ${normalizedData.length} assets - sample:`, JSON.stringify(normalizedData[0]));

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Deactivate all previously active records
    console.log('🔄 Deactivating old cache entries...');
    const { error: deactivateError } = await supabase
      .from('social_sentiment_cache')
      .update({ is_active: false })
      .eq('is_active', true);

    if (deactivateError) {
      console.error('❌ Error deactivating old entries:', deactivateError);
      throw deactivateError;
    }

    // Insert new data
    const generatedAt = new Date().toISOString();
    console.log('💾 Storing new cache entry...');
    
    const { data: insertData, error: insertError } = await supabase
      .from('social_sentiment_cache')
      .insert({
        data: normalizedData,
        generated_at: generatedAt,
        is_active: true,
      })
      .select()
      .single();

    if (insertError) {
      console.error('❌ Error inserting data:', insertError);
      throw insertError;
    }

    console.log(`✅ Successfully synced ${normalizedData.length} assets at ${generatedAt}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'LunarCrush data synced successfully',
        assets_count: normalizedData.length,
        generated_at: generatedAt,
        cache_id: insertData.id,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Sync failed:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
