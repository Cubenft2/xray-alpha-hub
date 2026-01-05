import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { Resvg, initWasm } from "https://esm.sh/@resvg/resvg-wasm@2.6.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

let wasmInitialized = false;

async function ensureWasmInitialized() {
  if (!wasmInitialized) {
    const wasmUrl = "https://unpkg.com/@aspect-dev/resvg-wasm@2.6.2/index_bg.wasm";
    const wasmResponse = await fetch(wasmUrl);
    const wasmBuffer = await wasmResponse.arrayBuffer();
    await initWasm(wasmBuffer);
    wasmInitialized = true;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const metal = url.searchParams.get("metal")?.toLowerCase();

    if (!metal || !["gold", "silver"].includes(metal)) {
      return new Response(JSON.stringify({ error: "Invalid metal. Use ?metal=gold or ?metal=silver" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check cache first
    const cacheKey = `forex/${metal}.png`;
    const { data: cachedImage } = await supabase.storage
      .from("og-images")
      .download(cacheKey);

    if (cachedImage) {
      // Check if cache is fresh (less than 1 hour old)
      const { data: fileInfo } = await supabase.storage
        .from("og-images")
        .list("forex", { search: `${metal}.png` });
      
      if (fileInfo && fileInfo.length > 0) {
        const fileDate = new Date(fileInfo[0].updated_at || fileInfo[0].created_at);
        const ageMs = Date.now() - fileDate.getTime();
        const oneHour = 60 * 60 * 1000;
        
        if (ageMs < oneHour) {
          console.log(`Serving cached OG image for ${metal}`);
          const arrayBuffer = await cachedImage.arrayBuffer();
          return new Response(new Uint8Array(arrayBuffer), {
            headers: {
              ...corsHeaders,
              "Content-Type": "image/png",
              "Cache-Control": "public, max-age=3600",
            },
          });
        }
      }
    }

    // Fetch forex data
    const forexPair = metal === "gold" ? "XAUUSD" : "XAGUSD";
    const { data: forexData, error: forexError } = await supabase
      .from("forex_cards")
      .select("rate, change_24h_pct")
      .eq("pair", forexPair)
      .maybeSingle();

    if (forexError) {
      console.error("Forex fetch error:", forexError);
    }

    // Fetch COT data
    const cotCommodity = metal === "gold" ? "Gold" : "Silver";
    const { data: cotData, error: cotError } = await supabase
      .from("cot_reports")
      .select("swap_net, as_of_date")
      .eq("commodity", cotCommodity)
      .order("as_of_date", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (cotError) {
      console.error("COT fetch error:", cotError);
    }

    // Format data
    const price = forexData?.rate ?? (metal === "gold" ? 2620 : 30);
    const change = forexData?.change_24h_pct ?? 0;
    const changeSign = change >= 0 ? "+" : "";
    const changeColor = change >= 0 ? "#22c55e" : "#ef4444";
    
    const banksNet = cotData?.swap_net ?? 0;
    const banksNetFormatted = Math.abs(banksNet).toLocaleString();
    const banksPosition = banksNet < 0 ? "Net Short" : "Net Long";
    
    const cotDate = cotData?.as_of_date 
      ? new Date(cotData.as_of_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
      : "N/A";

    const metalName = metal === "gold" ? "GOLD" : "SILVER";
    const metalIcon = metal === "gold" ? "🥇" : "🥈";
    const priceFormatted = metal === "gold" 
      ? `$${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      : `$${price.toFixed(2)}`;

    // Generate SVG
    const svg = `
<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#1a1625"/>
      <stop offset="100%" style="stop-color:#0f0d15"/>
    </linearGradient>
    <linearGradient id="accent" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" style="stop-color:#22c55e"/>
      <stop offset="50%" style="stop-color:#16a34a"/>
      <stop offset="100%" style="stop-color:#22c55e"/>
    </linearGradient>
  </defs>
  
  <!-- Background -->
  <rect width="1200" height="630" fill="url(#bg)"/>
  
  <!-- Top accent bar -->
  <rect x="0" y="0" width="1200" height="6" fill="url(#accent)"/>
  
  <!-- Bottom accent bar -->
  <rect x="0" y="624" width="1200" height="6" fill="url(#accent)"/>
  
  <!-- Metal icon and title -->
  <text x="80" y="120" font-family="Arial, sans-serif" font-size="48" fill="#ffffff">
    ${metalIcon} ${metalName} DEEP DIVE
  </text>
  
  <!-- Subtitle -->
  <text x="80" y="165" font-family="Arial, sans-serif" font-size="24" fill="#9ca3af">
    Institutional Analysis &amp; COT Positioning
  </text>
  
  <!-- Divider -->
  <line x1="80" y1="200" x2="1120" y2="200" stroke="#374151" stroke-width="1"/>
  
  <!-- Price section -->
  <text x="80" y="320" font-family="Arial, sans-serif" font-size="96" font-weight="bold" fill="#ffffff">
    ${escapeXml(priceFormatted)}
  </text>
  
  <!-- Change badge -->
  <rect x="80" y="350" width="140" height="50" rx="8" fill="${changeColor}" opacity="0.2"/>
  <text x="150" y="385" font-family="Arial, sans-serif" font-size="28" font-weight="bold" fill="${changeColor}" text-anchor="middle">
    ${changeSign}${change.toFixed(2)}%
  </text>
  
  <!-- COT section -->
  <text x="80" y="480" font-family="Arial, sans-serif" font-size="28" fill="#9ca3af">
    Banks ${banksPosition}:
  </text>
  <text x="350" y="480" font-family="Arial, sans-serif" font-size="28" font-weight="bold" fill="#ffffff">
    ${banksNetFormatted} contracts
  </text>
  
  <text x="80" y="530" font-family="Arial, sans-serif" font-size="22" fill="#6b7280">
    COT Report: ${escapeXml(cotDate)}
  </text>
  
  <!-- Branding -->
  <text x="1120" y="580" font-family="Arial, sans-serif" font-size="28" font-weight="bold" fill="#22c55e" text-anchor="end">
    XRayCrypto™
  </text>
  <text x="1120" y="520" font-family="Arial, sans-serif" font-size="18" fill="#6b7280" text-anchor="end">
    xraycrypto.io/forex/${metal}
  </text>
</svg>`;

    // Convert SVG to PNG
    await ensureWasmInitialized();
    const resvg = new Resvg(svg, {
      fitTo: { mode: "width", value: 1200 },
    });
    const pngData = resvg.render();
    const pngBuffer = pngData.asPng();

    // Cache the image
    await supabase.storage
      .from("og-images")
      .upload(cacheKey, pngBuffer, {
        contentType: "image/png",
        upsert: true,
      });

    console.log(`Generated and cached OG image for ${metal}`);

    return new Response(pngBuffer.buffer, {
      headers: {
        ...corsHeaders,
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (error) {
    console.error("Error generating forex OG image:", error);
    const message = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
