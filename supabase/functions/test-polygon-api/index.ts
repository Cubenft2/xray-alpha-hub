import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper to safely parse Polygon timestamps
function safeDate(value: unknown): Date | null {
  if (!value) return null;
  
  if (typeof value === 'number') {
    // Polygon uses milliseconds for some timestamps, seconds for others
    const ms = value < 10000000000 ? value * 1000 : value;
    const d = new Date(ms);
    return isNaN(d.getTime()) ? null : d;
  }
  
  if (typeof value === 'string') {
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  }
  
  return null;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const polygonApiKey = Deno.env.get('POLYGON_API_KEY');
  
  if (!polygonApiKey) {
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'POLYGON_API_KEY environment variable not set' 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }

  console.log('🔍 Starting Polygon API diagnostics...');

  const results: any = {
    timestamp: new Date().toISOString(),
    apiKeyPresent: true,
    tests: {}
  };

  try {
    // Test 1: Crypto Snapshot (BTC)
    console.log('📡 Testing crypto snapshot endpoint for BTC...');
    const snapshotUrl = `https://api.polygon.io/v2/snapshot/locale/global/markets/crypto/tickers?tickers=X:BTCUSD&apiKey=${polygonApiKey}`;
    
    const snapshotResponse = await fetch(snapshotUrl);
    const snapshotData = await snapshotResponse.json();
    
    if (snapshotResponse.ok && snapshotData.status === 'OK') {
      const ticker = snapshotData.tickers?.[0];
      
      if (ticker) {
        const price = ticker?.day?.c || ticker?.day?.vw || ticker?.lastTrade?.p;
        const timestampMs = ticker?.updated || ticker?.day?.t || ticker?.lastTrade?.t;
        const timestamp = safeDate(timestampMs);
        const ageMinutes = timestamp ? (Date.now() - timestamp.getTime()) / (1000 * 60) : null;
        
        // Price sanity check
        const priceValid = price && price > 10000 && price < 1000000;
        const dataFresh = ageMinutes !== null && ageMinutes < 60;
        
        results.tests.crypto_snapshot = {
          passed: priceValid && dataFresh,
          price: price,
          priceValid: priceValid,
          timestamp: timestamp?.toISOString() || null,
          ageMinutes: ageMinutes,
          dataFresh: dataFresh,
          rawTicker: {
            day_close: ticker?.day?.c,
            day_vw: ticker?.day?.vw,
            lastTrade_price: ticker?.lastTrade?.p,
            updated: ticker?.updated,
            day_timestamp: ticker?.day?.t,
            lastTrade_timestamp: ticker?.lastTrade?.t
          }
        };
        
        console.log(`✅ BTC price: $${price} (${ageMinutes?.toFixed(0)} min old)`);
      } else {
        results.tests.crypto_snapshot = {
          passed: false,
          error: 'No ticker data in response'
        };
        console.error('❌ No ticker data found in crypto snapshot');
      }
    } else {
      results.tests.crypto_snapshot = {
        passed: false,
        status: snapshotResponse.status,
        error: snapshotData.error || snapshotData.message || 'Unknown error',
        response: snapshotData
      };
      console.error(`❌ Crypto snapshot failed: ${snapshotResponse.status}`, snapshotData);
    }

    // Test 2: Account Status
    console.log('📡 Testing account status endpoint...');
    const statusUrl = `https://api.polygon.io/v1/marketstatus/now?apiKey=${polygonApiKey}`;
    
    const statusResponse = await fetch(statusUrl);
    const statusData = await statusResponse.json();
    
    if (statusResponse.ok) {
      results.tests.account_status = {
        passed: true,
        marketStatus: statusData
      };
      console.log('✅ Account status: Valid');
    } else {
      results.tests.account_status = {
        passed: false,
        status: statusResponse.status,
        error: statusData.error || statusData.message
      };
      console.error(`❌ Account status failed: ${statusResponse.status}`);
    }

    // Test 3: ETH for comparison
    console.log('📡 Testing ETH crypto snapshot...');
    const ethUrl = `https://api.polygon.io/v2/snapshot/locale/global/markets/crypto/tickers?tickers=X:ETHUSD&apiKey=${polygonApiKey}`;
    
    const ethResponse = await fetch(ethUrl);
    const ethData = await ethResponse.json();
    
    if (ethResponse.ok && ethData.status === 'OK') {
      const ethTicker = ethData.tickers?.[0];
      const ethPrice = ethTicker?.day?.c || ethTicker?.day?.vw || ethTicker?.lastTrade?.p;
      const ethTimestampMs = ethTicker?.updated || ethTicker?.day?.t || ethTicker?.lastTrade?.t;
      const ethTimestamp = safeDate(ethTimestampMs);
      
      results.tests.eth_snapshot = {
        passed: ethPrice && ethPrice > 500 && ethPrice < 50000,
        price: ethPrice,
        timestamp: ethTimestamp?.toISOString() || null
      };
      console.log(`✅ ETH price: $${ethPrice}`);
    } else {
      results.tests.eth_snapshot = {
        passed: false,
        status: ethResponse.status,
        error: ethData.error || ethData.message || 'Failed to fetch ETH data'
      };
      console.error('❌ ETH snapshot failed');
    }

    // Overall success
    const allPassed = Object.values(results.tests).every((test: any) => test.passed);
    results.success = allPassed;
    results.summary = allPassed 
      ? '✅ All tests passed! Polygon API key is working correctly.'
      : '❌ Some tests failed. Check the details above.';

    console.log(results.summary);

    return new Response(
      JSON.stringify(results, null, 2),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error: any) {
    console.error('❌ Diagnostic error:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message,
        stack: error.stack,
        results 
      }, null, 2),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
