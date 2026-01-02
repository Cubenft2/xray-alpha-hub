import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Log API call to external_api_calls table
async function logApiCall(
  supabase: any,
  apiName: string,
  functionName: string,
  success: boolean,
  errorMessage?: string
) {
  try {
    await supabase.from("external_api_calls").insert({
      api_name: apiName,
      function_name: functionName,
      success,
      error_message: errorMessage || null,
      call_count: 1,
    });
  } catch (e) {
    console.error("Failed to log API call:", e);
  }
}

// Parse the LunarCrush AI markdown response
function parseMarkdownResponse(markdown: string): {
  headline: string | null;
  about: string | null;
  insights: string[];
  priceAnalysis: string | null;
  sentimentPct: number | null;
  supportiveThemes: Array<{ theme: string; percentage: number; description: string }>;
  criticalThemes: Array<{ theme: string; percentage: number; description: string }>;
  topCreators: Array<{ name: string; handle: string; followers: number; engagement: number }>;
  galaxyScore: number | null;
  altRank: number | null;
  engagements24h: number | null;
  mentions24h: number | null;
  socialDominancePct: number | null;
  creators24h: number | null;
} {
  const result = {
    headline: null as string | null,
    about: null as string | null,
    insights: [] as string[],
    priceAnalysis: null as string | null,
    sentimentPct: null as number | null,
    supportiveThemes: [] as Array<{ theme: string; percentage: number; description: string }>,
    criticalThemes: [] as Array<{ theme: string; percentage: number; description: string }>,
    topCreators: [] as Array<{ name: string; handle: string; followers: number; engagement: number }>,
    galaxyScore: null as number | null,
    altRank: null as number | null,
    engagements24h: null as number | null,
    mentions24h: null as number | null,
    socialDominancePct: null as number | null,
    creators24h: null as number | null,
  };

  if (!markdown) return result;

  const lines = markdown.split("\n");
  let currentSection = "";

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Detect section headers
    if (line.startsWith("### ")) {
      currentSection = line.replace("### ", "").toLowerCase();
      continue;
    }

    // Extract headline - usually the first paragraph after the title
    if (!result.headline && line.length > 50 && !line.startsWith("#") && !line.startsWith("|") && !line.startsWith("-")) {
      result.headline = line.slice(0, 500);
    }

    // Parse About section
    if (currentSection === "about" && line.length > 0 && !line.startsWith("#")) {
      result.about = (result.about || "") + line + " ";
    }

    // Parse Insights - bullet points
    if (currentSection === "insights" && line.startsWith("-")) {
      const insight = line.replace(/^-\s*/, "").trim();
      if (insight.length > 0) {
        result.insights.push(insight);
      }
    }

    // Parse Price Analysis
    if (currentSection.includes("price") && line.length > 0 && !line.startsWith("#")) {
      result.priceAnalysis = (result.priceAnalysis || "") + line + " ";
    }

    // Parse Sentiment percentage
    if (currentSection === "sentiment") {
      const pctMatch = line.match(/(\d+(?:\.\d+)?)\s*%/);
      if (pctMatch && !result.sentimentPct) {
        result.sentimentPct = parseFloat(pctMatch[1]);
      }

      // Parse supportive themes
      if (line.toLowerCase().includes("supportive") || line.toLowerCase().includes("bullish")) {
        const themeMatch = line.match(/\*\*(.+?)\*\*.*?(\d+(?:\.\d+)?)\s*%/);
        if (themeMatch) {
          result.supportiveThemes.push({
            theme: themeMatch[1],
            percentage: parseFloat(themeMatch[2]),
            description: line.replace(/\*\*/g, "").trim(),
          });
        }
      }

      // Parse critical themes
      if (line.toLowerCase().includes("critical") || line.toLowerCase().includes("bearish")) {
        const themeMatch = line.match(/\*\*(.+?)\*\*.*?(\d+(?:\.\d+)?)\s*%/);
        if (themeMatch) {
          result.criticalThemes.push({
            theme: themeMatch[1],
            percentage: parseFloat(themeMatch[2]),
            description: line.replace(/\*\*/g, "").trim(),
          });
        }
      }
    }

    // Parse metrics from the markdown
    if (line.includes("Galaxy Score")) {
      const match = line.match(/(\d+(?:\.\d+)?)/);
      if (match) result.galaxyScore = parseFloat(match[1]);
    }
    if (line.includes("AltRank") || line.includes("Alt Rank")) {
      const match = line.match(/(\d+)/);
      if (match) result.altRank = parseInt(match[1]);
    }
    if (line.includes("engagements") || line.includes("Engagements")) {
      const match = line.match(/([\d,]+)/);
      if (match) result.engagements24h = parseInt(match[1].replace(/,/g, ""));
    }
    if (line.includes("mentions") || line.includes("Mentions")) {
      const match = line.match(/([\d,]+)/);
      if (match) result.mentions24h = parseInt(match[1].replace(/,/g, ""));
    }
    if (line.includes("social dominance") || line.includes("Social Dominance")) {
      const match = line.match(/(\d+(?:\.\d+)?)\s*%/);
      if (match) result.socialDominancePct = parseFloat(match[1]);
    }
    if (line.includes("creators") || line.includes("Creators")) {
      const match = line.match(/([\d,]+)/);
      if (match) result.creators24h = parseInt(match[1].replace(/,/g, ""));
    }

    // Parse creators table
    if (currentSection.includes("creator") && line.startsWith("|") && !line.includes("---")) {
      const cells = line.split("|").map((c) => c.trim()).filter((c) => c.length > 0);
      if (cells.length >= 2 && !cells[0].toLowerCase().includes("name")) {
        result.topCreators.push({
          name: cells[0] || "",
          handle: cells[1] || "",
          followers: cells[2] ? parseInt(cells[2].replace(/[^0-9]/g, "")) || 0 : 0,
          engagement: cells[3] ? parseInt(cells[3].replace(/[^0-9]/g, "")) || 0 : 0,
        });
      }
    }
  }

  // Trim accumulated text
  if (result.about) result.about = result.about.trim();
  if (result.priceAnalysis) result.priceAnalysis = result.priceAnalysis.trim();

  return result;
}

// Sleep helper
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

Deno.serve(async (req) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  const logs: string[] = [];
  const log = (msg: string) => {
    console.log(msg);
    logs.push(`[${new Date().toISOString()}] ${msg}`);
  };

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lunarcrushApiKey = Deno.env.get("LUNARCRUSH_API_KEY");

    if (!lunarcrushApiKey) {
      throw new Error("LUNARCRUSH_API_KEY not configured");
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    log("Starting sync-lunarcrush-ai-top25");

    // Fetch top 25 tokens by market cap rank
    const { data: tokens, error: tokensError } = await supabase
      .from("token_cards")
      .select("canonical_symbol, name, market_cap_rank")
      .not("market_cap_rank", "is", null)
      .order("market_cap_rank", { ascending: true })
      .limit(25);

    if (tokensError) {
      throw new Error(`Failed to fetch tokens: ${tokensError.message}`);
    }

    if (!tokens || tokens.length === 0) {
      log("No tokens found in token_cards");
      return new Response(
        JSON.stringify({ success: false, error: "No tokens found", logs }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    log(`Found ${tokens.length} tokens to process`);

    let successCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    for (const token of tokens) {
      const symbol = token.canonical_symbol;
      log(`Processing ${symbol} (rank ${token.market_cap_rank})`);

      try {
        // Call LunarCrush AI Topic API
        const apiUrl = `https://lunarcrush.com/api4/public/topic/${symbol}/v1`;
        const response = await fetch(apiUrl, {
          headers: {
            Authorization: `Bearer ${lunarcrushApiKey}`,
            Accept: "text/plain",
          },
        });

        // Log the API call
        await logApiCall(
          supabase,
          "lunarcrush",
          "sync-lunarcrush-ai-top25",
          response.ok,
          response.ok ? undefined : `Status ${response.status}`
        );

        if (!response.ok) {
          const errorText = await response.text();
          log(`API error for ${symbol}: ${response.status} - ${errorText}`);
          errors.push(`${symbol}: ${response.status}`);
          errorCount++;
          await sleep(3000); // Still wait to respect rate limits
          continue;
        }

        const markdown = await response.text();
        log(`Received ${markdown.length} chars for ${symbol}`);

        // Parse the markdown response
        const parsed = parseMarkdownResponse(markdown);

        // Upsert into lunarcrush_ai_summaries
        const { error: upsertError } = await supabase
          .from("lunarcrush_ai_summaries")
          .upsert(
            {
              canonical_symbol: symbol,
              name: token.name,
              headline: parsed.headline,
              about: parsed.about,
              insights: parsed.insights,
              price_analysis: parsed.priceAnalysis,
              sentiment_pct: parsed.sentimentPct,
              supportive_themes: parsed.supportiveThemes,
              critical_themes: parsed.criticalThemes,
              galaxy_score: parsed.galaxyScore,
              alt_rank: parsed.altRank,
              engagements_24h: parsed.engagements24h,
              mentions_24h: parsed.mentions24h,
              social_dominance_pct: parsed.socialDominancePct,
              creators_24h: parsed.creators24h,
              top_creators: parsed.topCreators,
              raw_markdown: markdown,
              fetched_at: new Date().toISOString(),
            },
            { onConflict: "canonical_symbol" }
          );

        if (upsertError) {
          log(`Upsert error for ${symbol}: ${upsertError.message}`);
          errors.push(`${symbol}: upsert failed`);
          errorCount++;
        } else {
          log(`Successfully upserted ${symbol}`);
          successCount++;
        }

        // Wait 3 seconds between calls to respect rate limits (10/min burst)
        if (tokens.indexOf(token) < tokens.length - 1) {
          await sleep(3000);
        }
      } catch (tokenError) {
        const errMsg = tokenError instanceof Error ? tokenError.message : String(tokenError);
        log(`Error processing ${symbol}: ${errMsg}`);
        errors.push(`${symbol}: ${errMsg}`);
        errorCount++;
        await sleep(3000);
      }
    }

    const duration = Date.now() - startTime;
    log(`Completed: ${successCount} success, ${errorCount} errors in ${duration}ms`);

    return new Response(
      JSON.stringify({
        success: true,
        processed: tokens.length,
        successCount,
        errorCount,
        errors: errors.slice(0, 10), // Limit error messages
        durationMs: duration,
        logs,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    log(`Fatal error: ${errMsg}`);

    return new Response(
      JSON.stringify({ success: false, error: errMsg, logs }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
