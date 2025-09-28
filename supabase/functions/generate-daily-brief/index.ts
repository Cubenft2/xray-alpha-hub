import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const openaiApiKey = Deno.env.get('OPENAI_API_KEY')!;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('Fetching latest news data...');
    
    // Call news-fetch function to get current market data
    const { data: newsData, error: newsError } = await supabase.functions.invoke('news-fetch', {
      body: { limit: 50 }
    });

    if (newsError) {
      console.error('Error fetching news:', newsError);
      throw new Error('Failed to fetch news data');
    }

    console.log('News data fetched:', newsData);

    // Generate AI analysis
    const marketAnalysisPrompt = `Based on the following financial news data, create a comprehensive daily market brief:

Crypto News: ${JSON.stringify(newsData.crypto?.slice(0, 10) || [])}
Stock News: ${JSON.stringify(newsData.stocks?.slice(0, 10) || [])}

Create a market brief with the following structure:
1. Executive Summary (2-3 sentences)
2. Key Market Developments
3. Sector Analysis
4. What to Watch
5. Trading Outlook

Keep it professional, informative, and actionable for traders and investors. Focus on the most significant trends and developments from today's news.`;

    console.log('Generating AI analysis...');
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { 
            role: 'system', 
            content: 'You are a professional financial analyst creating daily market briefs. Be concise, accurate, and focus on actionable insights.'
          },
          { role: 'user', content: marketAnalysisPrompt }
        ],
        max_tokens: 1500,
        temperature: 0.7
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const aiData = await response.json();
    const generatedAnalysis = aiData.choices[0].message.content;

    // Create today's date string
    const today = new Date();
    const dateStr = today.toISOString().split('T')[0];
    const timestamp = Math.floor(Date.now() / 1000);

    // Insert market brief into database
    console.log('Inserting market brief into database...');
    
    const { data: briefData, error: insertError } = await supabase
      .from('market_briefs')
      .insert({
        brief_type: 'daily',
        title: `Daily Market Brief - ${today.toLocaleDateString('en-US', { 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric' 
        })}`,
        slug: `daily-market-brief-${dateStr}-${timestamp}`,
        executive_summary: 'Comprehensive daily analysis of market trends, key developments, and trading opportunities across crypto and traditional markets.',
        content_sections: {
          ai_generated_content: generatedAnalysis,
          generation_timestamp: new Date().toISOString(),
          model_used: 'gpt-4o-mini',
          news_sources: ['crypto_feeds', 'stock_feeds'],
          data_points: {
            crypto_articles: newsData.crypto?.length || 0,
            stock_articles: newsData.stocks?.length || 0
          }
        },
        market_data: {
          session_type: 'daily_analysis',
          generation_time: dateStr,
          news_volume: {
            crypto: newsData.crypto?.length || 0,
            stocks: newsData.stocks?.length || 0
          }
        },
        social_data: {
          analysis_type: 'news_based',
          sentiment: 'calculated_from_news',
          coverage: 'comprehensive'
        },
        is_published: true,
        published_at: new Date().toISOString(),
        stoic_quote: 'The market is a device for transferring money from the impatient to the patient.',
        sentiment_score: 0.0
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error inserting brief:', insertError);
      throw new Error('Failed to create market brief');
    }

    console.log('Market brief created successfully:', briefData);

    return new Response(JSON.stringify({ 
      success: true, 
      brief: briefData,
      message: 'Daily market brief generated successfully'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error generating daily brief:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      success: false
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});