import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Map ambiguous symbols to their LunarCrush topic names
// These symbols have collisions with non-crypto topics (e.g., LEO → Pope Leo XIV)
const LUNARCRUSH_TOPIC_OVERRIDES: Record<string, string> = {
  'LEO': 'unus-sed-leo',      // Avoids Pope Leo XIV collision
  'SUI': 'sui-network',       // Avoids generic "sui" collisions
  'HYPE': 'hyperliquid',      // Uses full project name
  'LINK': 'chainlink',        // More specific than "LINK"
  'USDS': 'sky-dollar',       // Avoids generic dollar references
  'OM': 'mantra-dao',         // Avoids generic "om" collision
  'PI': 'pi-network',         // Avoids math constant collision
};

// Curated Top 25 tokens for premium AI summaries
// Excludes wrapped tokens (WBTC, STETH, etc.) and suspicious tokens (BZR, MGC)
const TOP_25_SYMBOLS = [
  'BTC', 'ETH', 'XRP', 'USDT', 'SOL',
  'BNB', 'DOGE', 'USDC', 'ADA', 'TRX',
  'HYPE', 'AVAX', 'LINK', 'SUI', 'XLM',
  'SHIB', 'TON', 'HBAR', 'BCH', 'DOT',
  'LTC', 'UNI', 'LEO', 'PEPE', 'NEAR'
];

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
  let currentSubsection = ""; // Track supportive vs critical themes

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Detect section headers and extract sentiment from "### Sentiment: 74%"
    if (line.startsWith("### ")) {
      const headerContent = line.replace("### ", "");
      currentSection = headerContent.toLowerCase().split(":")[0].trim();
      currentSubsection = ""; // Reset subsection on new section
      
      // Extract sentiment percentage from header like "Sentiment: 74%"
      if (currentSection === "sentiment") {
        const pctMatch = headerContent.match(/(\d+(?:\.\d+)?)\s*%/);
        if (pctMatch) {
          result.sentimentPct = parseFloat(pctMatch[1]);
        }
      }
      continue;
    }

    // Extract headline - usually the first paragraph after the title
    if (!result.headline && line.length > 50 && !line.startsWith("#") && !line.startsWith("|") && !line.startsWith("-") && !line.startsWith("!") && !line.startsWith("[")) {
      result.headline = line.slice(0, 500);
    }

    // Parse About section - header includes token name like "### About Ethereum"
    if (currentSection.startsWith("about") && line.length > 0 && !line.startsWith("#") && !line.startsWith("!") && !line.startsWith("[")) {
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
    if (currentSection.includes("price") && line.length > 0 && !line.startsWith("#") && !line.startsWith("!") && !line.startsWith("[")) {
      result.priceAnalysis = (result.priceAnalysis || "") + line + " ";
    }

    // Parse Sentiment section themes
    if (currentSection === "sentiment") {
      // Detect "Most Supportive Themes:" and "Most Critical Themes:" subsection markers
      if (line.toLowerCase().includes("most supportive themes")) {
        currentSubsection = "supportive";
        continue;
      }
      if (line.toLowerCase().includes("most critical themes")) {
        currentSubsection = "critical";
        continue;
      }
      
      // Parse theme lines: "- Theme Name: (percentage%) Description..."
      if (line.startsWith("-") && currentSubsection) {
        const themeMatch = line.match(/^-\s*(.+?):\s*\((\d+(?:\.\d+)?)\s*%\)\s*(.*)$/);
        if (themeMatch) {
          const themeData = {
            theme: themeMatch[1].trim(),
            percentage: parseFloat(themeMatch[2]),
            description: themeMatch[3].trim(),
          };
          if (currentSubsection === "supportive") {
            result.supportiveThemes.push(themeData);
          } else if (currentSubsection === "critical") {
            result.criticalThemes.push(themeData);
          }
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

    // Use curated list instead of dynamic query
    // This excludes wrapped tokens (STETH, WBTC) and suspicious tokens (BZR, MGC)
    const tokens = TOP_25_SYMBOLS.map((symbol, index) => ({
      canonical_symbol: symbol,
      name: symbol, // Name will be updated from API response if available
      market_cap_rank: index + 1
    }));

    log(`Processing ${tokens.length} curated tokens`);

    let successCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    for (const token of tokens) {
      const symbol = token.canonical_symbol;
      log(`Processing ${symbol} (rank ${token.market_cap_rank})`);

      try {
        // Resolve topic name using override map to avoid ticker collisions
        const lunarcrushTopic = LUNARCRUSH_TOPIC_OVERRIDES[symbol] || symbol;
        if (lunarcrushTopic !== symbol) {
          log(`Using topic override: ${symbol} → ${lunarcrushTopic}`);
        }

        // Call LunarCrush AI Topic API (lunarcrush.ai domain for AI narratives)
        const apiUrl = `https://lunarcrush.ai/topic/${encodeURIComponent(lunarcrushTopic)}`;
        const response = await fetch(apiUrl, {
          headers: {
            Authorization: `Bearer ${lunarcrushApiKey}`,
            Accept: "text/markdown",
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
          await sleep(6000); // Wait 6 seconds to respect rate limits (10/min burst)
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

        // Wait 6 seconds between calls to respect rate limits (10/min burst)
        if (tokens.indexOf(token) < tokens.length - 1) {
          await sleep(6000);
        }
      } catch (tokenError) {
        const errMsg = tokenError instanceof Error ? tokenError.message : String(tokenError);
        log(`Error processing ${symbol}: ${errMsg}`);
        errors.push(`${symbol}: ${errMsg}`);
        errorCount++;
        await sleep(6000);
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
