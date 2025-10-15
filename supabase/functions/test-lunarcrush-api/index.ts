import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TestResult {
  passed: boolean;
  error?: string;
  [key: string]: any;
}

interface DiagnosticResults {
  success: boolean;
  timestamp: string;
  apiKeyPresent: boolean;
  summary: string;
  tests: {
    social_data?: TestResult;
    universe_data?: TestResult;
    coin_detail?: TestResult;
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const results: DiagnosticResults = {
    success: true,
    timestamp: new Date().toISOString(),
    apiKeyPresent: false,
    summary: '',
    tests: {},
  };

  try {
    // Check if API key is configured
    const lunarCrushApiKey = Deno.env.get('LUNARCRUSH_API_KEY');
    results.apiKeyPresent = !!lunarCrushApiKey;

    if (!lunarCrushApiKey) {
      results.success = false;
      results.summary = 'LUNARCRUSH_API_KEY is not configured';
      results.tests.social_data = { passed: false, error: 'API key not configured' };
      results.tests.universe_data = { passed: false, error: 'API key not configured' };
      results.tests.coin_detail = { passed: false, error: 'API key not configured' };
      
      return new Response(JSON.stringify(results), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // TEST 1: Social Data API
    console.log('🧪 Test 1: Testing lunarcrush-social endpoint...');
    try {
      const { data: socialData, error: socialError } = await supabase.functions.invoke('lunarcrush-social');

      if (socialError) throw socialError;

      const assets = socialData?.data || [];
      
      // Explicitly fail if dataset is empty
      if (assets.length === 0) {
        throw new Error(`Empty dataset from lunarcrush-social. Warning: ${socialData?.warning || 'No data returned'}`);
      }
      
      const btcAsset = assets.find((a: any) => a.symbol?.toLowerCase() === 'btc');
      const ethAsset = assets.find((a: any) => a.symbol?.toLowerCase() === 'eth');

      results.tests.social_data = {
        passed: true,
        assetCount: assets.length,
        btcFound: !!btcAsset,
        ethFound: !!ethAsset,
        btcGalaxyScore: btcAsset?.galaxy_score,
        ethGalaxyScore: ethAsset?.galaxy_score,
        sampleAsset: assets[0] || null,
      };

      console.log(`✅ Social Data: ${assets.length} assets returned`);
    } catch (error: any) {
      console.error('❌ Social Data test failed:', error);
      results.success = false;
      results.tests.social_data = {
        passed: false,
        error: error.message || 'Failed to fetch social data',
      };
    }

    // TEST 2: Universe Data API
    console.log('🧪 Test 2: Testing lunarcrush-universe endpoint...');
    try {
      const { data: universeData, error: universeError } = await supabase.functions.invoke('lunarcrush-universe');

      if (universeError) throw universeError;

      const coins = universeData?.data || [];
      const metadata = universeData?.metadata || {};
      const sampleCoin = coins[0];

      results.tests.universe_data = {
        passed: true,
        totalCoins: metadata.total_coins || coins.length,
        totalMarketCap: metadata.total_market_cap,
        totalVolume24h: metadata.total_volume_24h,
        averageGalaxyScore: metadata.average_galaxy_score,
        sampleCoin: {
          symbol: sampleCoin?.symbol,
          name: sampleCoin?.name,
          price: sampleCoin?.price,
          galaxy_score: sampleCoin?.galaxy_score,
          social_volume: sampleCoin?.social_volume,
        },
      };

      console.log(`✅ Universe Data: ${coins.length} coins returned`);
    } catch (error: any) {
      console.error('❌ Universe Data test failed:', error);
      results.success = false;
      results.tests.universe_data = {
        passed: false,
        error: error.message || 'Failed to fetch universe data',
      };
    }

    // TEST 3: Coin Detail API
    console.log('🧪 Test 3: Testing lunarcrush-coin-detail endpoint...');
    try {
      const { data: coinDetail, error: coinError } = await supabase.functions.invoke(
        'lunarcrush-coin-detail',
        {
          body: { coin: 'bitcoin' }
        }
      );

      if (coinError) throw coinError;

      const coin = coinDetail?.data;
      const analysis = coinDetail?.analysis;

      results.tests.coin_detail = {
        passed: true,
        coinName: coin?.name,
        symbol: coin?.symbol,
        price: coin?.price,
        marketCap: coin?.market_cap,
        galaxyScore: coin?.galaxy_score,
        socialVolume: coin?.social_volume,
        riskLevel: analysis?.risk_level,
        trends: analysis?.trends,
      };

      console.log(`✅ Coin Detail: ${coin?.name} (${coin?.symbol}) data fetched`);
    } catch (error: any) {
      console.error('❌ Coin Detail test failed:', error);
      results.success = false;
      results.tests.coin_detail = {
        passed: false,
        error: error.message || 'Failed to fetch coin detail',
      };
    }

    // Generate summary
    const passedTests = Object.values(results.tests).filter(t => t?.passed).length;
    const totalTests = Object.keys(results.tests).length;

    if (results.success) {
      results.summary = `All ${totalTests} tests passed! LunarCrush API is working correctly.`;
    } else {
      results.summary = `${passedTests}/${totalTests} tests passed. Check failed tests below.`;
    }

    return new Response(JSON.stringify(results), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('❌ Diagnostic error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        timestamp: new Date().toISOString(),
        apiKeyPresent: results.apiKeyPresent,
        summary: 'Diagnostic test failed with error',
        error: error.message,
        tests: results.tests,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
