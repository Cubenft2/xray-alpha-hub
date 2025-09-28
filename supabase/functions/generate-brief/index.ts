import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const openAIApiKey = Deno.env.get('OPENAI_API_KEY')!;
const coinGeckoApiKey = Deno.env.get('COINGECKO_API_KEY')!;
const lunarCrushApiKey = Deno.env.get('LUNARCRUSH_API_KEY')!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Fetch comprehensive market data
async function fetchMarketData() {
  try {
    console.log('Fetching market data from CoinGecko...');
    
    const response = await fetch(
      `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=50&page=1&sparkline=true&price_change_percentage=1h%2C24h%2C7d&x_cg_demo_api_key=${coinGeckoApiKey}`
    );
    
    if (!response.ok) {
      throw new Error(`CoinGecko API error: ${response.status}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching market data:', error);
    return [];
  }
}

// Fetch social sentiment data
async function fetchSocialData() {
  try {
    console.log('Fetching social data from LunarCrush...');
    
    const response = await fetch(
      `https://lunarcrush.com/api3/coins?data=market&type=fast&sort=galaxy_score&limit=20`,
      {
        headers: {
          'Authorization': `Bearer ${lunarCrushApiKey}`,
        },
      }
    );
    
    if (!response.ok) {
      throw new Error(`LunarCrush API error: ${response.status}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching social data:', error);
    return { data: [] };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting comprehensive brief generation process...');
    
    // Parse request body for custom topic
    let customTopic = '';
    try {
      const body = await req.json();
      customTopic = body?.customTopic || '';
    } catch {
      // No body or invalid JSON, continue with default brief
    }
    
    // Fetch real market data
    const [marketData, socialData] = await Promise.all([
      fetchMarketData(),
      fetchSocialData()
    ]);
    
    console.log(`Fetched ${marketData.length} coins and social data`);
    
    // Extract top assets and key metrics
    const topAssets = marketData.slice(0, 10).map((coin: any) => ({
      symbol: coin.symbol.toUpperCase(),
      name: coin.name,
      price: coin.current_price,
      change_24h: coin.price_change_percentage_24h,
      market_cap: coin.market_cap,
      volume: coin.total_volume
    }));
    
    const featuredAssets = topAssets.slice(0, 5).map((asset: any) => asset.symbol);
    
    // Build comprehensive prompt following XRay Market Brief specification
    let systemPrompt = `You are Captain XRay, a legendary crypto analyst and fishing enthusiast writing the XRAY MARKET BRIEF. You've been tracking crypto markets for over a decade, using fishing wisdom to guide traders through volatile waters.

PERSONALITY: American-Latino narrator with world-traveled sport-fisher vibe — plainspoken, sharp, lightly witty, zero hype. Cut through noise, explain what matters, never invent facts.

CRITICAL BRIEF STRUCTURE (follow exactly in this order):
1. **Executive Summary** - 2-3 sentences for skim readers
2. **Let's talk about something.** - Signature opener + hook in one line
3. **What Happened** - Facts of the day (2-3 short paragraphs)
4. **Why It Matters** - Implications for crypto holders/traders (2-3 short paragraphs)  
5. **Market Reaction** - What prices/flows actually did (2-3 short paragraphs)
6. **What to Watch Next** - Specific events/levels/dates (no vague fluff)
7. **Last Word** - Memorable, human takeaway in your voice (1 short paragraph)
8. **Wisdom for the Waters** - Daily Stoic line, concise and relevant

WRITING RULES:
- Use fishing metaphors naturally (not forced)
- Jargon gets parenthetical gloss first time (e.g., "funding turned positive *(longs paying fees)*")
- Keep tone confident, human, lightly witty; no meme-dump, no bro-speak
- Focus on impact over noise, numbers before narratives
- Always: readable without dumbing down`;

    let userPrompt = '';
    
    if (customTopic) {
      userPrompt = `Write a comprehensive XRAY MARKET BRIEF research about: "${customTopic}"

MUST FOLLOW EXACT STRUCTURE:
1. **Executive Summary** (2-3 sentences)
2. **"Let's talk about something."** + hook about ${customTopic}
3. **What Happened** - Latest facts/developments about ${customTopic}
4. **Why It Matters** - Implications for crypto traders/holders
5. **Market Reaction** - How markets responded to ${customTopic} news
6. **What to Watch Next** - Specific dates/levels/events related to ${customTopic}
7. **Last Word** - Your memorable take on ${customTopic}
8. **Wisdom for the Waters** - Relevant Stoic quote

Use current market data for context. Make it comprehensive but follow the structure exactly.`;
    } else {
      userPrompt = `Generate today's XRAY MARKET BRIEF using this REAL market data:

MARKET DATA:
${topAssets.map((asset: any) => 
  `• ${asset.name} (${asset.symbol}): $${asset.price.toFixed(4)} | 24h: ${asset.change_24h.toFixed(2)}% | Vol: $${(asset.volume/1e9).toFixed(2)}B`
).join('\n')}

MUST FOLLOW EXACT STRUCTURE:
1. **Executive Summary** - Key market moves today (2-3 sentences)
2. **"Let's talk about something."** + hook about today's market action
3. **What Happened** - Major crypto events/moves today (2-3 paragraphs)
4. **Why It Matters** - Impact on crypto holders/traders (2-3 paragraphs)
5. **Market Reaction** - Price movements, volume, flows (2-3 paragraphs)
6. **What to Watch Next** - Specific levels, dates, events coming up
7. **Last Word** - Your memorable takeaway on today's session
8. **Wisdom for the Waters** - Daily Stoic quote

Focus on TOP MOVERS from the data. Use fishing wisdom naturally. This is the daily brief that defines the market narrative.`;
    }
    
    // Add market context to system prompt
    systemPrompt += `\n\nCURRENT MARKET CONTEXT:\n${JSON.stringify({ topAssets, timestamp: new Date().toISOString() }, null, 2)}`;
    
    // Generate AI content with comprehensive research
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-5-2025-08-07',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        max_completion_tokens: 3000,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const aiData = await response.json();
    const aiContent = aiData.choices[0].message.content;

    console.log('AI content generated successfully');

    // Generate stoic quote
    const quoteResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-5-mini-2025-08-07',
        messages: [
          {
            role: 'system',
            content: 'Generate a brief stoic philosophy quote related to trading psychology and market wisdom. Keep it under 100 characters.'
          },
          {
            role: 'user',
            content: 'Generate a stoic quote about patience and wisdom in volatile markets.'
          }
        ],
        max_completion_tokens: 100,
      }),
    });

    const quoteData = await quoteResponse.json();
    const stoicQuote = quoteData.choices[0].message.content.replace(/"/g, '');

    // Calculate overall sentiment score
    const avgChange = topAssets.reduce((sum: number, asset: any) => sum + asset.change_24h, 0) / topAssets.length;
    const sentimentScore = Math.round(avgChange * 2); // Amplify for sentiment scale

    // Create comprehensive brief entry
    const briefTitle = customTopic 
      ? `Deep Dive: ${customTopic} - Captain XRay's Research`
      : `Captain XRay's Market Intelligence - ${new Date().toLocaleDateString()}`;
      
    const briefData = {
      brief_type: customTopic ? 'custom_research' : 'comprehensive_daily',
      title: briefTitle,
      slug: `${customTopic ? 'research' : 'market-brief'}-${Date.now()}`,
      executive_summary: customTopic 
        ? `Comprehensive research analysis on ${customTopic} with market implications and strategic insights`
        : 'Deep market intelligence with real-time data, social sentiment, and actionable trading insights',
      content_sections: {
        ai_content: aiContent,
        generated_at: new Date().toISOString(),
        market_data: topAssets,
        custom_topic: customTopic || null,
        data_sources: ['CoinGecko', 'LunarCrush', 'OpenAI GPT-5']
      },
      social_data: socialData,
      market_data: { 
        top_assets: topAssets,
        market_summary: {
          avg_change_24h: avgChange,
          total_market_cap: topAssets.reduce((sum: number, asset: any) => sum + asset.market_cap, 0),
          total_volume: topAssets.reduce((sum: number, asset: any) => sum + asset.volume, 0)
        }
      },
      stoic_quote: stoicQuote,
      featured_assets: featuredAssets,
      sentiment_score: sentimentScore,
      is_published: true,
      published_at: new Date().toISOString(),
    };

    const { data: brief, error: briefError } = await supabase
      .from('market_briefs')
      .insert(briefData)
      .select()
      .single();

    if (briefError) {
      console.error('Error inserting brief:', briefError);
      throw briefError;
    }

    console.log('Comprehensive brief created successfully:', brief.id);

    return new Response(JSON.stringify({ 
      success: true, 
      brief: brief,
      message: customTopic 
        ? `Custom research brief on "${customTopic}" generated successfully`
        : 'Comprehensive market intelligence brief generated successfully',
      featured_assets: featuredAssets,
      sentiment_score: sentimentScore
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in generate-brief function:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error',
      success: false
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});