import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ZombieDog mascot as base64 - we'll fetch it from the public URL
const ZOMBIEDOG_URL = "https://odncvfiuzliyohxrsigc.supabase.co/storage/v1/object/public/og-images/zombiedog-mascot.png";

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

    // Check if cached image exists
    const cachedPath = `briefs/${slug}.png`;
    const { data: existingFile } = await supabase.storage
      .from("og-images")
      .createSignedUrl(cachedPath, 60);

    if (existingFile?.signedUrl) {
      // Verify the file actually exists by trying to fetch it
      const checkResponse = await fetch(existingFile.signedUrl, { method: "HEAD" });
      if (checkResponse.ok) {
        console.log(`Returning cached image for ${slug}`);
        const imageResponse = await fetch(existingFile.signedUrl);
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

    // Generate SVG image
    const title = brief.title.length > 80 ? brief.title.substring(0, 77) + "..." : brief.title;
    
    // Split title into lines for better display
    const words = title.split(" ");
    const lines: string[] = [];
    let currentLine = "";
    
    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      if (testLine.length > 35) {
        if (currentLine) lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }
    if (currentLine) lines.push(currentLine);

    // Limit to 3 lines max
    const displayLines = lines.slice(0, 3);
    if (lines.length > 3) {
      displayLines[2] = displayLines[2].substring(0, displayLines[2].length - 3) + "...";
    }

    const titleY = 280;
    const lineHeight = 52;

    const svg = `
      <svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="bgGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:#1a0a2e;stop-opacity:1" />
            <stop offset="50%" style="stop-color:#2d1b4e;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#1a0a2e;stop-opacity:1" />
          </linearGradient>
          <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="8" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
          <filter id="textGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>
        
        <!-- Background -->
        <rect width="1200" height="630" fill="url(#bgGradient)"/>
        
        <!-- Grid pattern overlay -->
        <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
          <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#00b300" stroke-width="0.5" opacity="0.1"/>
        </pattern>
        <rect width="1200" height="630" fill="url(#grid)"/>
        
        <!-- Top accent line -->
        <rect x="0" y="0" width="1200" height="4" fill="#00b300"/>
        
        <!-- ZombieDog placeholder circle with glow -->
        <circle cx="160" cy="315" r="120" fill="#1a0a2e" stroke="#00b300" stroke-width="3" filter="url(#glow)"/>
        <text x="160" y="330" font-family="Arial, sans-serif" font-size="80" fill="#00b300" text-anchor="middle">🐕</text>
        
        <!-- Brief type badge -->
        <rect x="320" y="180" width="${briefTypeLabel.length * 14 + 40}" height="40" rx="20" fill="#00b300" opacity="0.2"/>
        <rect x="320" y="180" width="${briefTypeLabel.length * 14 + 40}" height="40" rx="20" fill="none" stroke="#00b300" stroke-width="2"/>
        <text x="340" y="207" font-family="Arial, sans-serif" font-size="18" font-weight="bold" fill="#00b300" filter="url(#textGlow)">${briefTypeLabel}</text>
        
        <!-- Title -->
        ${displayLines.map((line, i) => `
          <text x="320" y="${titleY + i * lineHeight}" font-family="Arial Black, Arial, sans-serif" font-size="42" font-weight="900" fill="#ffffff">${escapeXml(line)}</text>
        `).join("")}
        
        <!-- Accent line under title -->
        <rect x="320" y="${titleY + displayLines.length * lineHeight + 20}" width="500" height="3" fill="#00b300"/>
        
        <!-- Author and date -->
        <text x="320" y="${titleY + displayLines.length * lineHeight + 60}" font-family="Arial, sans-serif" font-size="24" fill="#a0a0a0">By XRay • ${formattedDate}</text>
        
        <!-- Bottom branding bar -->
        <rect x="0" y="560" width="1200" height="70" fill="#0d0518"/>
        <text x="60" y="605" font-family="Arial Black, Arial, sans-serif" font-size="28" font-weight="bold" fill="#00b300" filter="url(#textGlow)">XRayCrypto™</text>
        <text x="1140" y="605" font-family="Arial, sans-serif" font-size="18" fill="#666666" text-anchor="end">Pixel Power • Crypto Vision • Woof!</text>
        
        <!-- Bottom accent line -->
        <rect x="0" y="626" width="1200" height="4" fill="#00b300"/>
      </svg>
    `;

    // Convert SVG to PNG using resvg
    const { Resvg } = await import("npm:@resvg/resvg-js@2.6.0");
    
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
