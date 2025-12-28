import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface LunarCrushAsset {
  id: string;
  symbol: string;
  name: string;
  price: number;
  market_cap: number;
  market_cap_rank: number;
  percent_change_24h: number;
  volume_24h: number;
  galaxy_score: number;
  alt_rank: number;
  sentiment: number;
  social_volume: number;
  social_dominance: number;
  interactions_24h: number;
  logo_url?: string;
  categories?: string[];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('🌙 Reading social data from token_cards (no LunarCrush API call)...');

    // Read from token_cards table instead of calling LunarCrush API
    const { data: tokenCards, error: dbError } = await supabase
      .from('token_cards')
      .select(`
        id, canonical_symbol, name, logo_url, market_cap, market_cap_rank,
        price_usd, volume_24h_usd, change_24h_pct,
        galaxy_score, alt_rank, sentiment, social_volume_24h, social_dominance, interactions_24h,
        categories, social_updated_at, is_active
      `)
      .eq('is_active', true)
      .not('galaxy_score', 'is', null)
      .order('galaxy_score', { ascending: false })
      .limit(500);

    if (dbError) {
      console.error('❌ Database error:', dbError.message);
      return new Response(
        JSON.stringify({
          data: [],
          cached: false,
          warning: `Database error: ${dbError.message}`
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Transform token_cards to LunarCrushAsset format
    const assets: LunarCrushAsset[] = (tokenCards || []).map((card: any) => ({
      id: card.id,
      symbol: card.canonical_symbol,
      name: card.name || card.canonical_symbol,
      price: card.price_usd || 0,
      market_cap: card.market_cap || 0,
      market_cap_rank: card.market_cap_rank || 9999,
      percent_change_24h: card.change_24h_pct || 0,
      volume_24h: card.volume_24h_usd || 0,
      galaxy_score: card.galaxy_score || 0,
      alt_rank: card.alt_rank || 0,
      sentiment: card.sentiment || 50,
      social_volume: card.social_volume_24h || 0,
      social_dominance: card.social_dominance || 0,
      interactions_24h: card.interactions_24h || 0,
      logo_url: card.logo_url,
      categories: Array.isArray(card.categories) ? card.categories : [],
    }));

    console.log(`✅ Loaded ${assets.length} assets with social data from token_cards`);

    return new Response(
      JSON.stringify({
        data: assets,
        cached: false,
        source: 'token_cards',
        timestamp: new Date().toISOString()
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Error in lunarcrush-social:', error);
    return new Response(
      JSON.stringify({
        data: [],
        cached: false,
        warning: 'Internal error',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
