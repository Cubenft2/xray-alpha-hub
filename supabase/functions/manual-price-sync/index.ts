import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const polygonKey = Deno.env.get('POLYGON_API_KEY');
    const coingeckoKey = Deno.env.get('COINGECKO_API_KEY');

    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('🚀 Starting manual price sync with bulk CoinGecko...');

    // Fetch top 250 cryptos from CoinGecko Pro by market cap
    const cgUrl = `https://pro-api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=250&page=1&sparkline=false&price_change_percentage=24h`;
    
    let cgCoins = [];
    try {
      const cgRes = await fetch(cgUrl, {
        headers: { 'x-cg-pro-api-key': coingeckoKey }
      });

      if (!cgRes.ok) {
        throw new Error(`CoinGecko API error: ${cgRes.status}`);
      }

      cgCoins = await cgRes.json();
      console.log(`📊 Fetched ${cgCoins.length} coins from CoinGecko Pro`);
    } catch (error) {
      console.error(`❌ CoinGecko bulk fetch failed: ${error.message}`);
      throw new Error(`Failed to fetch from CoinGecko: ${error.message}`);
    }

    // Fetch ALL ticker_mappings with coingecko_id
    const { data: mappings, error: mappingsError } = await supabase
      .from('ticker_mappings')
      .select('symbol, display_name, coingecko_id')
      .eq('type', 'crypto')
      .eq('is_active', true)
      .not('coingecko_id', 'is', null);

    if (mappingsError) {
      throw new Error(`Failed to fetch ticker mappings: ${mappingsError.message}`);
    }

    console.log(`📋 Loaded ${mappings?.length || 0} ticker mappings with coingecko_id`);

    // Create lookup map: coingecko_id -> ticker_mapping
    const cgIdMap = new Map(mappings.map(m => [m.coingecko_id, m]));

    // Match CoinGecko coins to our mappings
    const results = cgCoins
      .map(coin => {
        const mapping = cgIdMap.get(coin.id);
        if (!mapping) {
          console.log(`  ⚠️ No mapping found for CoinGecko ID: ${coin.id} (${coin.symbol})`);
          return null;
        }

        console.log(`  ✅ ${mapping.symbol}: $${coin.current_price} (${coin.price_change_percentage_24h?.toFixed(2)}%)`);

        return {
          ticker: mapping.symbol,
          display: mapping.display_name,
          price: coin.current_price,
          change24h: coin.price_change_percentage_24h || 0,
          updated_at: new Date().toISOString()
        };
      })
      .filter(r => r !== null);

    console.log(`\n✨ Matched ${results.length} coins to ticker_mappings`);

    // Upsert all results to live_prices
    if (results.length > 0) {
      console.log(`\n💾 Upserting ${results.length} prices to live_prices...`);
      
      const { error: upsertError } = await supabase
        .from('live_prices')
        .upsert(results, { onConflict: 'ticker' });

      if (upsertError) {
        throw new Error(`Failed to upsert prices: ${upsertError.message}`);
      }

      console.log(`✅ Successfully synced ${results.length} prices!`);
    }

    const response = {
      success: true,
      synced: results.length,
      total_from_coingecko: cgCoins.length,
      matched_to_mappings: results.length,
      source: 'coingecko-bulk',
      message: `Synced ${results.length} prices from CoinGecko top ${cgCoins.length} by market cap`
    };

    console.log('\n📊 Final stats:', response);

    return new Response(
      JSON.stringify(response),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('❌ Error in manual-price-sync:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message,
        details: error.stack 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
