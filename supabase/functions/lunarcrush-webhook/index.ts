import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-secret',
};

interface SocialAsset {
  name: string;
  symbol: string;
  galaxy_score: number;
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

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🔔 Webhook received from LunarCrush AI Agent');

    // Validate authentication
    const webhookSecret = Deno.env.get('LUNARCRUSH_WEBHOOK_SECRET');
    const providedSecret = req.headers.get('X-Webhook-Secret');

    if (!webhookSecret) {
      console.error('❌ LUNARCRUSH_WEBHOOK_SECRET not configured');
      return new Response(
        JSON.stringify({ error: 'Webhook secret not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (providedSecret !== webhookSecret) {
      console.error('❌ Invalid webhook secret provided');
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const body = await req.json();
    console.log('📦 Received payload:', JSON.stringify(body).substring(0, 200) + '...');

    // Extract data and metadata
    let socialData: SocialAsset[];
    let generatedAt: string;

    if (body.data && Array.isArray(body.data)) {
      // Format: { data: [...], generated_at: "..." }
      socialData = body.data;
      generatedAt = body.generated_at || new Date().toISOString();
    } else if (Array.isArray(body)) {
      // Format: [...]
      socialData = body;
      generatedAt = new Date().toISOString();
    } else {
      throw new Error('Invalid payload format: expected array or object with data property');
    }

    // Validate data structure
    if (socialData.length === 0) {
      throw new Error('Empty data array received');
    }

    // Validate first item has required fields
    const firstItem = socialData[0];
    const requiredFields = ['symbol', 'galaxy_score', 'sentiment'];
    for (const field of requiredFields) {
      if (!(field in firstItem)) {
        throw new Error(`Missing required field: ${field}`);
      }
    }

    console.log(`✅ Validated ${socialData.length} social assets`);

    // Normalize the data to ensure consistent field names
    const normalizedData: NormalizedAsset[] = socialData.map((asset: SocialAsset) => ({
      name: asset.name,
      symbol: asset.symbol,
      galaxy_score: asset.galaxy_score,
      sentiment: asset.sentiment || asset.sentiment_score || 0,
      social_volume: asset.social_volume || asset.social_volume_24h || asset.volume_24h || 0,
      social_dominance: asset.social_dominance || asset.market_dominance || 0,
      fomo_score: asset.fomo_score || asset.alt_rank || 0,
      alt_rank: asset.alt_rank
    }));

    console.log(`🔄 Normalized data - sample:`, JSON.stringify(normalizedData[0]));

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Deactivate all previous records
    const { error: deactivateError } = await supabase
      .from('social_sentiment_cache')
      .update({ is_active: false })
      .eq('is_active', true);

    if (deactivateError) {
      console.error('❌ Failed to deactivate old records:', deactivateError);
      throw deactivateError;
    }

    console.log('🔄 Deactivated previous records');

    // Insert new data
    const { data: insertData, error: insertError } = await supabase
      .from('social_sentiment_cache')
      .insert({
        data: normalizedData,
        generated_at: generatedAt,
        is_active: true
      })
      .select()
      .single();

    if (insertError) {
      console.error('❌ Failed to insert new data:', insertError);
      throw insertError;
    }

    console.log('✅ Stored new social sentiment data:', insertData.id);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Social sentiment data stored successfully',
        id: insertData.id,
        assets_count: normalizedData.length,
        generated_at: generatedAt,
        received_at: insertData.received_at
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error: any) {
    console.error('❌ Webhook error:', error);
    return new Response(
      JSON.stringify({
        error: error.message || 'Internal server error',
        details: error.toString()
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
