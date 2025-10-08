import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const lunarKey = Deno.env.get("LUNARCRUSH_API_KEY");

interface EndpointTest {
  endpoint: string;
  description: string;
  url: string;
  method?: string;
  body?: any;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!lunarKey) {
      return new Response(
        JSON.stringify({ 
          error: "LUNARCRUSH_API_KEY not configured",
          results: []
        }),
        { 
          headers: { "Content-Type": "application/json", ...corsHeaders },
          status: 500 
        }
      );
    }

    console.log("🔍 Starting LunarCrush API diagnostics...");
    
    const endpoints: EndpointTest[] = [
      {
        endpoint: "/api4/public/coins/list/v2",
        description: "Original endpoint (failing with 402)",
        url: "https://lunarcrush.com/api4/public/coins/list/v2?limit=20&sort=galaxy_score"
      },
      {
        endpoint: "/api4/public/coins",
        description: "Basic coins list",
        url: "https://lunarcrush.com/api4/public/coins?limit=20"
      },
      {
        endpoint: "/api4/public/coins/list",
        description: "Coins list alternative",
        url: "https://lunarcrush.com/api4/public/coins/list?limit=20"
      },
      {
        endpoint: "/api4/public/topic",
        description: "Trending topics",
        url: "https://lunarcrush.com/api4/public/topic?limit=10"
      },
      {
        endpoint: "/api4/public/feeds",
        description: "Social feeds/posts",
        url: "https://lunarcrush.com/api4/public/feeds?limit=10"
      },
      {
        endpoint: "/api4/public/influencers",
        description: "Top influencers",
        url: "https://lunarcrush.com/api4/public/influencers?limit=10"
      },
      {
        endpoint: "/api4/public/coins/BTC",
        description: "Individual coin detail (BTC)",
        url: "https://lunarcrush.com/api4/public/coins/BTC"
      },
      {
        endpoint: "/api4/public/coins/BTC/time-series",
        description: "Time series data (BTC)",
        url: "https://lunarcrush.com/api4/public/coins/BTC/time-series?interval=1d&limit=7"
      },
      {
        endpoint: "/api/v2/coins",
        description: "Legacy v2 endpoint",
        url: "https://api.lunarcrush.com/v2?data=assets&key=" + lunarKey
      }
    ];

    const results = [];

    for (const test of endpoints) {
      console.log(`\n📡 Testing: ${test.endpoint}`);
      console.log(`   URL: ${test.url}`);
      
      try {
        const fetchOptions: RequestInit = {
          method: test.method || "GET",
          headers: {
            Authorization: `Bearer ${lunarKey}`,
            "Content-Type": "application/json"
          }
        };

        if (test.body) {
          fetchOptions.body = JSON.stringify(test.body);
        }

        const startTime = Date.now();
        const resp = await fetch(test.url, fetchOptions);
        const endTime = Date.now();
        const responseTime = endTime - startTime;

        const contentType = resp.headers.get("content-type");
        let data: any;
        
        if (contentType?.includes("application/json")) {
          data = await resp.json();
        } else {
          data = await resp.text();
        }

        const result = {
          endpoint: test.endpoint,
          description: test.description,
          status: resp.status,
          statusText: resp.statusText,
          success: resp.ok,
          responseTime: `${responseTime}ms`,
          dataPreview: typeof data === 'string' 
            ? data.substring(0, 200) 
            : JSON.stringify(data).substring(0, 500),
          dataStructure: typeof data === 'object' ? Object.keys(data).join(", ") : "N/A",
          recordCount: Array.isArray(data?.data) ? data.data.length : 
                       Array.isArray(data) ? data.length : "N/A"
        };

        if (resp.ok) {
          console.log(`   ✅ SUCCESS (${resp.status}) - ${responseTime}ms`);
          console.log(`   📊 Data keys: ${result.dataStructure}`);
          console.log(`   📈 Records: ${result.recordCount}`);
        } else {
          console.log(`   ❌ FAILED (${resp.status}) - ${resp.statusText}`);
          console.log(`   📄 Response: ${result.dataPreview}`);
        }

        results.push(result);

      } catch (error: any) {
        console.log(`   💥 ERROR: ${error.message}`);
        results.push({
          endpoint: test.endpoint,
          description: test.description,
          status: 0,
          statusText: "Request Failed",
          success: false,
          error: error.message,
          dataPreview: null,
          dataStructure: null,
          recordCount: 0
        });
      }

      // Small delay between requests to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    console.log("\n📊 Diagnostic Summary:");
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    console.log(`   ✅ Successful: ${successful}`);
    console.log(`   ❌ Failed: ${failed}`);

    return new Response(
      JSON.stringify({
        success: true,
        timestamp: new Date().toISOString(),
        summary: {
          total: results.length,
          successful,
          failed,
          apiKey: lunarKey ? "✓ Configured" : "✗ Missing"
        },
        results
      }),
      {
        headers: { "Content-Type": "application/json", ...corsHeaders },
        status: 200
      }
    );

  } catch (e) {
    console.error("❌ Diagnostic function failed:", e);
    return new Response(
      JSON.stringify({ 
        error: "diagnostic_failed", 
        message: e.message,
        results: []
      }),
      {
        headers: { "Content-Type": "application/json", ...corsHeaders },
        status: 500
      }
    );
  }
});
