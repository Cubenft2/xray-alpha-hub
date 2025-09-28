import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const STOIC_QUOTES = [
  "The best trader is one who can adapt to changing tides without losing sight of the horizon.",
  "In the market's storms, the wise captain doesn't fight the waves—they navigate through them.",
  "A smooth sea never made a skilled sailor, just as easy profits never made a wise trader.",
  "The market will test your patience like the ocean tests a fisherman's resolve.",
  "Fortune favors the prepared mind, but it rewards the disciplined hand.",
  "What we control is our response to the market, not the market itself.",
  "The best time to repair your nets is when the sea is calm.",
  "Every loss is a lesson the market offers for the price of tuition.",
  "The wise trader fishes with patience, not desperation.",
  "In volatile waters, steady hands catch the biggest fish."
];

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { briefType = 'premarket' } = await req.json();
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const openaiKey = Deno.env.get('OPENAI_API_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log(`🎣 Generating ${briefType} market brief...`);

    // Get latest social sentiment data
    const { data: socialData, error: socialError } = await supabase
      .from('social_sentiment')
      .select('*')
      .order('data_timestamp', { ascending: false })
      .limit(10);

    if (socialError) {
      console.error('Error fetching social data:', socialError);
    }

    // Get latest market alerts
    const { data: alertsData, error: alertsError } = await supabase
      .from('market_alerts')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(5);

    if (alertsError) {
      console.error('Error fetching alerts:', alertsError);
    }

    // Generate current market context
    const currentTime = new Date();
    const timeContext = briefType === 'premarket' ? 'before market open' : 
                       briefType === 'postmarket' ? 'after market close' : 
                       briefType === 'weekend' ? 'weekend analysis' : 'special brief';

    const marketContext = {
      timeContext,
      briefType,
      socialSentiment: socialData || [],
      marketAlerts: alertsData || [],
      timestamp: currentTime.toISOString(),
      topAssets: socialData?.slice(0, 5).map(d => ({ 
        symbol: d.asset_symbol, 
        sentiment: d.sentiment_score,
        volume: d.social_volume 
      })) || []
    };

    // Generate AI brief
    console.log('🤖 Calling OpenAI for brief generation...');
    
    const systemPrompt = `You are the market brief writer with an American-Latino fisherman persona. Your voice is:

IDENTITY: American-Latino narrator, fisherman/traveler vibes, plainspoken but sharp
OPENER: Always start with "Let's talk about something..."
TONE: Witty, confident, clear (John Oliver sarcasm + fishing analogies, but professional)
FACTUAL: Only use verified data provided. No invention. Be realistic but not offensive.
STYLE: Can be sarcastic but respectful. Use technical jargon but explain for newcomers.
OPTIMISM: Optimistic but cautious. Confident but realistic.

STRUCTURE:
1. Executive Summary (2-3 sentences)
2. Opener (Let's talk about something...)
3. What Happened (facts from data)
4. Why It Matters (analysis)
5. Market Reaction (sentiment/social data)
6. What to Watch Next (forward-looking)
7. Last Word (personal sign-off)
8. Mini-section with fishing theme
9. Wisdom for the Waters (Stoic quote)

Use fishing/ocean analogies naturally. Target both salty traders and newcomers. Be worth reading.`;

    const aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { 
            role: 'user', 
            content: `Generate a ${briefType} market brief using this data: ${JSON.stringify(marketContext)}. 
            Focus on crypto markets, social sentiment analysis, and provide actionable insights. 
            Make it engaging for both experienced traders and newcomers.` 
          }
        ],
        max_tokens: 2000,
        temperature: 0.8
      }),
    });

    const aiData = await aiResponse.json();
    
    if (!aiData.choices?.[0]?.message?.content) {
      throw new Error('Failed to generate AI content');
    }

    const briefContent = aiData.choices[0].message.content;
    console.log('✅ AI brief generated successfully');

    // Select random Stoic quote
    const randomQuote = STOIC_QUOTES[Math.floor(Math.random() * STOIC_QUOTES.length)];

    // Calculate overall sentiment score
    const avgSentiment = socialData && socialData.length > 0 
      ? socialData.reduce((acc, curr) => acc + curr.sentiment_score, 0) / socialData.length 
      : 0;

    // Create brief slug
    const briefSlug = `${briefType}-brief-${currentTime.toISOString().split('T')[0]}-${Date.now()}`;

    // Store the brief
    const { data: briefData, error: briefError } = await supabase
      .from('market_briefs')
      .insert({
        brief_type: briefType,
        title: `${briefType.charAt(0).toUpperCase() + briefType.slice(1)} Market Brief - ${currentTime.toLocaleDateString()}`,
        slug: briefSlug,
        executive_summary: `AI-generated ${briefType} market intelligence combining social sentiment and market analysis`,
        content_sections: {
          ai_generated_content: briefContent,
          social_sentiment_data: socialData?.slice(0, 10) || [],
          market_alerts: alertsData || [],
          generation_timestamp: currentTime.toISOString(),
          model_used: 'gpt-4o-mini'
        },
        social_data: {
          top_assets: marketContext.topAssets,
          total_tracked: socialData?.length || 0,
          avg_sentiment: avgSentiment
        },
        market_data: {
          brief_type: briefType,
          alerts_count: alertsData?.length || 0,
          time_context: timeContext
        },
        stoic_quote: randomQuote,
        featured_assets: marketContext.topAssets.map(asset => asset.symbol),
        sentiment_score: Math.round(avgSentiment * 100) / 100,
        is_published: true,
        published_at: currentTime.toISOString()
      })
      .select()
      .single();

    if (briefError) {
      console.error('Error storing brief:', briefError);
      throw briefError;
    }

    console.log(`🎣 ${briefType} market brief generated and stored successfully`);

    return new Response(JSON.stringify({
      success: true,
      brief: briefData,
      slug: briefSlug,
      contentPreview: briefContent.substring(0, 300) + '...',
      socialRecords: socialData?.length || 0,
      alertsProcessed: alertsData?.length || 0,
      sentimentScore: avgSentiment
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('🔥 Error generating market brief:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      details: 'Check function logs for more information'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});