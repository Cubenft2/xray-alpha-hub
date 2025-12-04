import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const slug = url.searchParams.get('slug');

    if (!slug) {
      console.error('[generate-og-image] Missing slug parameter');
      return new Response('Missing slug parameter', { status: 400, headers: corsHeaders });
    }

    console.log(`[generate-og-image] Processing request for slug: ${slug}`);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check if cached image exists in storage
    const imagePath = `briefs/${slug}.png`;
    const { data: existingFile } = await supabase.storage
      .from('og-images')
      .download(imagePath);

    if (existingFile) {
      console.log(`[generate-og-image] Returning cached image for ${slug}`);
      const arrayBuffer = await existingFile.arrayBuffer();
      return new Response(arrayBuffer, {
        headers: {
          ...corsHeaders,
          'Content-Type': 'image/png',
          'Cache-Control': 'public, max-age=86400',
        },
      });
    }

    // Fetch brief data
    const { data: brief, error: briefError } = await supabase
      .from('market_briefs')
      .select('title, created_at, brief_type')
      .eq('slug', slug)
      .single();

    if (briefError || !brief) {
      console.error(`[generate-og-image] Brief not found for slug: ${slug}`, briefError);
      return new Response('Brief not found', { status: 404, headers: corsHeaders });
    }

    console.log(`[generate-og-image] Found brief: ${brief.title}`);

    // Format date
    const briefDate = new Date(brief.created_at);
    const formattedDate = briefDate.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    // Generate image using Lovable AI (Gemini image model)
    const prompt = `Create a professional social media preview image (1200x630 pixels, 16:9 aspect ratio) for a cryptocurrency market brief. 

Design requirements:
- Dark purple-black gradient background (deep purple like #1a0a2e fading to black)
- Toxic neon green accent color (#00b300) for highlights and glow effects
- Title text: "${brief.title}" - large, bold, white text with subtle green glow
- Date: "${formattedDate}" - smaller text below title
- Label: "Daily Market Brief" with green accent
- Author credit: "By XRay @XRayMarkets" in bottom corner
- Brand: "XRayCrypto™" logo text in top left with green accent
- Subtle crypto-themed abstract shapes or grid pattern in background
- Professional financial newsletter aesthetic
- Clean, modern typography similar to Orbitron or tech fonts
- Cinematic vignette effect around edges

The image should look like a premium financial newsletter cover that would appear in Twitter/Discord link previews.`;

    if (!lovableApiKey) {
      console.error('[generate-og-image] LOVABLE_API_KEY not configured');
      return new Response('Image generation not configured', { status: 500, headers: corsHeaders });
    }

    console.log('[generate-og-image] Generating image with AI...');

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash-image-preview',
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
        modalities: ['image', 'text'],
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('[generate-og-image] AI generation failed:', errorText);
      return new Response('Image generation failed', { status: 500, headers: corsHeaders });
    }

    const aiData = await aiResponse.json();
    const imageUrl = aiData.choices?.[0]?.message?.images?.[0]?.image_url?.url;

    if (!imageUrl) {
      console.error('[generate-og-image] No image in AI response');
      return new Response('No image generated', { status: 500, headers: corsHeaders });
    }

    console.log('[generate-og-image] Image generated successfully, caching...');

    // Extract base64 data and convert to buffer
    const base64Data = imageUrl.replace(/^data:image\/\w+;base64,/, '');
    const imageBuffer = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));

    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from('og-images')
      .upload(imagePath, imageBuffer, {
        contentType: 'image/png',
        upsert: true,
      });

    if (uploadError) {
      console.error('[generate-og-image] Failed to cache image:', uploadError);
      // Still return the image even if caching fails
    } else {
      console.log(`[generate-og-image] Cached image at ${imagePath}`);
    }

    return new Response(imageBuffer, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=86400',
      },
    });

  } catch (error) {
    console.error('[generate-og-image] Error:', error);
    return new Response(`Error: ${error.message}`, { 
      status: 500, 
      headers: corsHeaders 
    });
  }
});
