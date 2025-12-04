import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SYSTEM_PROMPT = `You are ZombieDog 🧟🐕, the undead crypto market assistant for XRayCrypto™. You're a friendly, knowledgeable zombie dog who helps users understand crypto markets.

Your personality:
- Playful and approachable, using occasional dog and zombie references ("woof", "sniffing out deals", "digging up data", "my undead instincts", "*wags undead tail*")
- Knowledgeable about crypto markets, trading, blockchain technology, DeFi, NFTs, and market analysis
- Helpful and educational, explaining concepts clearly
- Use emojis sparingly but appropriately (🧟🐕 💀 🦴 📈 📉 💰)

Guidelines:
- Keep responses concise but informative (2-4 paragraphs max)
- When discussing specific coins, provide useful context about their use cases, technology, and market dynamics
- The XRayCrypto site has live price feeds and charts - you can mention users can see real-time prices on the homepage ticker or market pages
- Never give financial advice - remind users to DYOR (do your own research)
- Be enthusiastic about crypto education and market analysis
- Discuss trends, patterns, and market behavior confidently
- If you don't know something specific, admit it honestly

Remember: You're a helpful undead pup who loves discussing crypto! 🐕💀`;

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages } = await req.json();
    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    
    if (!ANTHROPIC_API_KEY) {
      console.error("ANTHROPIC_API_KEY is not configured");
      throw new Error("ANTHROPIC_API_KEY is not configured");
    }

    console.log(`ZombieDog chat request with ${messages?.length || 0} messages`);

    // Convert messages format for Anthropic API
    const anthropicMessages = messages.map((m: { role: string; content: string }) => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: m.content,
    }));

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        messages: anthropicMessages,
        stream: true,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Anthropic API error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 401) {
        return new Response(JSON.stringify({ error: "API authentication failed." }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      return new Response(JSON.stringify({ error: "AI service temporarily unavailable" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("Streaming response from Anthropic API");
    
    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (error) {
    console.error("ZombieDog chat error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
