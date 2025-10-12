import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get LunarCrush API key from environment
    const lunarCrushApiKey = Deno.env.get('LUNARCRUSH_API_KEY');
    
    if (!lunarCrushApiKey) {
      console.error('❌ LUNARCRUSH_API_KEY not configured');
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'LunarCrush API key not configured' 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const url = new URL(req.url);
    const coinIdentifier = url.searchParams.get('coin') || url.searchParams.get('symbol');

    if (!coinIdentifier) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing coin parameter' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const cacheKey = `lunarcrush:coin:${coinIdentifier.toLowerCase()}`;
    const cacheTTL = 300; // 5 minutes (crypto details need to be fresh)

    // Check cache (fresh)
    const { data: cachedData } = await supabase
      .from('cache_kv')
      .select('v, expires_at')
      .eq('key', cacheKey)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (cachedData?.v) {
      console.log(`✅ Returning cached data for ${coinIdentifier}`);
      return new Response(JSON.stringify(cachedData.v), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Also get expired cache as fallback for rate limiting
    const { data: expiredCache } = await supabase
      .from('cache_kv')
      .select('v, expires_at')
      .eq('key', cacheKey)
      .single();

    // Fetch fresh data
    console.log(`Fetching fresh data for ${coinIdentifier}...`);
    const response = await fetch(
      `https://lunarcrush.com/api4/public/coins/${coinIdentifier}/v1`,
      {
        headers: {
          'Authorization': `Bearer ${lunarCrushApiKey}`,
        },
      }
    );

    if (!response.ok) {
      // If rate limited and we have expired cache, return that instead
      if (response.status === 429 && expiredCache?.v) {
        console.log(`⚠️ Rate limited! Returning expired cache for ${coinIdentifier}`);
        return new Response(JSON.stringify(expiredCache.v), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      throw new Error(`LunarCrush API error: ${response.status} ${response.statusText}`);
    }

    const apiData = await response.json();

    if (!apiData.data) {
      throw new Error('No data returned from LunarCrush');
    }

    const coinData = apiData.data;

    // Calculate risk score
    const volatility = coinData.volatility || 0;
    const galaxyScore = coinData.galaxy_score || 0;
    let riskLevel = 'MEDIUM';
    if (volatility > 0.05 || galaxyScore < 40) riskLevel = 'HIGH';
    else if (volatility > 0.03 || galaxyScore < 50) riskLevel = 'ELEVATED';
    else if (volatility < 0.015 && galaxyScore > 60) riskLevel = 'LOW';

    // Analyze trends
    const trends = {
      short_term: coinData.percent_change_24h > 0 ? 'BULLISH' : 'BEARISH',
      medium_term: coinData.percent_change_7d > 0 ? 'BULLISH' : 'BEARISH',
      long_term: coinData.percent_change_30d > 0 ? 'BULLISH' : 'BEARISH',
    };

    const result = {
      success: true,
      data: coinData,
      analysis: {
        risk_level: riskLevel,
        trends,
        volume_to_mcap_ratio: coinData.volume_24h / coinData.market_cap,
        galaxy_score_interpretation:
          galaxyScore > 70 ? 'Excellent' :
          galaxyScore > 60 ? 'Strong' :
          galaxyScore > 50 ? 'Moderate' :
          galaxyScore > 40 ? 'Weak' : 'Poor',
      },
    };

    // Store in cache
    const expiresAt = new Date(Date.now() + cacheTTL * 1000).toISOString();
    await supabase
      .from('cache_kv')
      .upsert({
        key: cacheKey,
        v: result,
        expires_at: expiresAt,
      });

    console.log(`✅ Fetched detail for ${coinData.symbol} (${coinData.name})`);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('❌ LunarCrush Coin Detail Error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
