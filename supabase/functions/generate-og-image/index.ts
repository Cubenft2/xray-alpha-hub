import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { Resvg, initWasm } from "https://esm.sh/@resvg/resvg-wasm@2.4.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

let wasmInitialized = false;

async function ensureWasmInitialized() {
  if (!wasmInitialized) {
    try {
      const wasmResponse = await fetch(
        "https://unpkg.com/@resvg/resvg-wasm@2.4.0/index_bg.wasm"
      );
      const wasmBuffer = await wasmResponse.arrayBuffer();
      await initWasm(wasmBuffer);
      wasmInitialized = true;
      console.log("WASM initialized successfully");
    } catch (error) {
      console.error("Failed to initialize WASM:", error);
      throw error;
    }
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const slug = url.searchParams.get("slug");

    if (!slug) {
      return new Response(JSON.stringify({ error: "Missing slug parameter" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Generating OG image for slug: ${slug}`);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check if cached image exists in storage
    const cachedPath = `briefs/${slug}.png`;
    const { data: publicUrl } = supabase.storage
      .from("og-images")
      .getPublicUrl(cachedPath);

    // Try to fetch cached image
    try {
      const checkResponse = await fetch(publicUrl.publicUrl, { method: "HEAD" });
      if (checkResponse.ok && checkResponse.status === 200) {
        console.log(`Returning cached image for ${slug}`);
        const imageResponse = await fetch(publicUrl.publicUrl);
        if (imageResponse.ok) {
          const imageData = await imageResponse.arrayBuffer();
          return new Response(imageData, {
            headers: {
              ...corsHeaders,
              "Content-Type": "image/png",
              "Cache-Control": "public, max-age=86400",
            },
          });
        }
      }
    } catch (e) {
      console.log("No cached image found, generating new one");
    }

    // Fetch brief data
    const { data: brief, error: briefError } = await supabase
      .from("market_briefs")
      .select("title, published_at, brief_type")
      .eq("slug", slug)
      .eq("is_published", true)
      .single();

    if (briefError || !brief) {
      console.error("Brief not found:", briefError);
      return new Response(JSON.stringify({ error: "Brief not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Generating image for: ${brief.title}`);

    // Format date
    const publishedDate = new Date(brief.published_at);
    const formattedDate = publishedDate.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });

    // Get brief type label
    const briefTypeLabel = brief.brief_type === "morning" ? "MORNING BRIEF" : 
                          brief.brief_type === "evening" ? "EVENING BRIEF" : 
                          brief.brief_type === "sunday_special" ? "SUNDAY SPECIAL" : "MARKET BRIEF";

    // Truncate and split title for display
    const title = brief.title.length > 90 ? brief.title.substring(0, 87) + "..." : brief.title;
    
    const words = title.split(" ");
    const lines: string[] = [];
    let currentLine = "";
    
    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      if (testLine.length > 32) {
        if (currentLine) lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }
    if (currentLine) lines.push(currentLine);

    const displayLines = lines.slice(0, 3);
    if (lines.length > 3) {
      displayLines[2] = displayLines[2].substring(0, displayLines[2].length - 3) + "...";
    }

    const titleY = 260;
    const lineHeight = 58;

    // Generate SVG with ZombieDog design
    const svg = `<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bgGradient" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#1a0a2e"/>
      <stop offset="50%" style="stop-color:#2d1b4e"/>
      <stop offset="100%" style="stop-color:#1a0a2e"/>
    </linearGradient>
    <filter id="glow">
      <feGaussianBlur stdDeviation="6" result="coloredBlur"/>
      <feMerge>
        <feMergeNode in="coloredBlur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
    <filter id="textGlow">
      <feGaussianBlur stdDeviation="1.5" result="coloredBlur"/>
      <feMerge>
        <feMergeNode in="coloredBlur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>
  
  <!-- Background -->
  <rect width="1200" height="630" fill="url(#bgGradient)"/>
  
  <!-- Grid pattern -->
  <defs>
    <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
      <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#00b300" stroke-width="0.3" opacity="0.15"/>
    </pattern>
  </defs>
  <rect width="1200" height="630" fill="url(#grid)"/>
  
  <!-- Top accent line -->
  <rect x="0" y="0" width="1200" height="5" fill="#00b300"/>
  
  <!-- ZombieDog mascot area -->
  <circle cx="150" cy="300" r="100" fill="#0d0518" stroke="#00b300" stroke-width="3" filter="url(#glow)"/>
  <text x="150" y="320" font-family="Arial, sans-serif" font-size="70" fill="#00b300" text-anchor="middle" filter="url(#textGlow)">🐕</text>
  <text x="150" y="375" font-family="Arial, sans-serif" font-size="14" fill="#00b300" text-anchor="middle" font-weight="bold">ZOMBIEDOG</text>
  
  <!-- Brief type badge -->
  <rect x="300" y="170" rx="18" ry="18" width="${briefTypeLabel.length * 13 + 36}" height="36" fill="rgba(0,179,0,0.2)" stroke="#00b300" stroke-width="2"/>
  <text x="318" y="195" font-family="Arial, sans-serif" font-size="16" font-weight="bold" fill="#00b300" filter="url(#textGlow)">${briefTypeLabel}</text>
  
  <!-- Title lines -->
  ${displayLines.map((line, i) => 
    `<text x="300" y="${titleY + i * lineHeight}" font-family="Arial, sans-serif" font-size="46" font-weight="bold" fill="#ffffff">${escapeXml(line)}</text>`
  ).join("\n  ")}
  
  <!-- Green accent line -->
  <rect x="300" y="${titleY + displayLines.length * lineHeight + 15}" width="450" height="4" fill="#00b300"/>
  
  <!-- Author and date -->
  <text x="300" y="${titleY + displayLines.length * lineHeight + 55}" font-family="Arial, sans-serif" font-size="22" fill="#a0a0a0">By XRay • ${formattedDate}</text>
  
  <!-- Bottom branding bar -->
  <rect x="0" y="555" width="1200" height="75" fill="#0d0518"/>
  <text x="50" y="602" font-family="Arial, sans-serif" font-size="30" font-weight="bold" fill="#00b300" filter="url(#textGlow)">XRayCrypto™</text>
  <text x="1150" y="600" font-family="Arial, sans-serif" font-size="16" fill="#555555" text-anchor="end">Pixel Power • Crypto Vision • Woof!</text>
  
  <!-- Bottom accent line -->
  <rect x="0" y="625" width="1200" height="5" fill="#00b300"/>
</svg>`;

    // Initialize WASM and render
    await ensureWasmInitialized();
    
    const resvg = new Resvg(svg, {
      fitTo: {
        mode: "width",
        value: 1200,
      },
    });
    
    const pngData = resvg.render();
    const pngBuffer = pngData.asPng();

    // Cache the generated image
    const { error: uploadError } = await supabase.storage
      .from("og-images")
      .upload(cachedPath, pngBuffer, {
        contentType: "image/png",
        upsert: true,
      });

    if (uploadError) {
      console.error("Failed to cache image:", uploadError);
    } else {
      console.log(`Cached image at ${cachedPath}`);
    }

    return new Response(pngBuffer, {
      headers: {
        ...corsHeaders,
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch (error) {
    console.error("Error generating OG image:", error);
    return new Response(JSON.stringify({ error: error.message }), {
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
