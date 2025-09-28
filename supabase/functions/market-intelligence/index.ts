import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface LunarCrushResponse {
  data: Array<{
    symbol: string;
    name: string;
    social_volume_24h: number;
    social_dominance: number;
    sentiment: number;
    galaxy_score: number;
    interactions_24h: number;
    social_volume_24h_change: number;
  }>;
}

interface CoinGeckoResponse {
  [key: string]: {
    usd: number;
    usd_24h_change: number;
    usd_market_cap: number;
    usd_24h_vol: number;
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lunarCrushKey = Deno.env.get('LUNARCRUSH_API_KEY')!;
    const coinGeckoKey = Deno.env.get('COINGECKO_API_KEY')!;
    const openaiKey = Deno.env.get('OPENAI_API_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('🚀 Starting comprehensive market intelligence gathering...');

    // 1. Fetch LunarCrush Social Data
    console.log('📊 Fetching LunarCrush social sentiment data...');
    const lunarCrushResponse = await fetch('https://lunarcrush.com/api4/public/coins/list/v2', {
      headers: {
        'Authorization': `Bearer ${lunarCrushKey}`,
        'Content-Type': 'application/json'
      }
    });

    const lunarData: LunarCrushResponse = await lunarCrushResponse.json();
    console.log(`🎯 Retrieved ${lunarData.data?.length || 0} social sentiment records`);

    // 2. Fetch CoinGecko Price Data
    console.log('💰 Fetching CoinGecko market data...');
    const topSymbols = lunarData.data?.slice(0, 20).map(coin => coin.symbol.toLowerCase()).join(',') || 'bitcoin,ethereum';
    
    const coinGeckoResponse = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${topSymbols}&vs_currencies=usd&include_market_cap=true&include_24hr_vol=true&include_24hr_change=true&x_cg_demo_api_key=${coinGeckoKey}`
    );
    
    const priceData: CoinGeckoResponse = await coinGeckoResponse.json();
    console.log(`💎 Retrieved price data for ${Object.keys(priceData).length} assets`);

    // 3. Process and Store Social Sentiment Data
    if (lunarData.data && lunarData.data.length > 0) {
      const socialSentimentData = lunarData.data.slice(0, 50).map(coin => ({
        asset_symbol: coin.symbol,
        asset_name: coin.name,
        sentiment_score: coin.sentiment || 0,
        social_volume: coin.social_volume_24h || 0,
        social_volume_24h_change: coin.social_volume_24h_change || 0,
        galaxy_score: coin.galaxy_score || 0,
        trending_rank: lunarData.data.indexOf(coin) + 1,
        top_influencers: [],
        viral_posts: [],
        data_timestamp: new Date().toISOString()
      }));

      const { error: sentimentError } = await supabase
        .from('social_sentiment')
        .insert(socialSentimentData);

      if (sentimentError) {
        console.error('❌ Error storing social sentiment:', sentimentError);
      } else {
        console.log(`✅ Stored ${socialSentimentData.length} social sentiment records`);
      }
    }

    // 4. Generate Market Alerts for Unusual Activity
    const alerts = [];
    if (lunarData.data) {
      for (const coin of lunarData.data.slice(0, 20)) {
        // Social volume spike alert
        if (coin.social_volume_24h_change > 100) {
          alerts.push({
            alert_type: 'social_spike',
            asset_symbol: coin.symbol,
            asset_name: coin.name,
            trigger_value: 100,
            current_value: coin.social_volume_24h_change,
            alert_message: `${coin.name} experiencing ${coin.social_volume_24h_change.toFixed(1)}% increase in social volume`,
            severity: coin.social_volume_24h_change > 500 ? 'critical' : 'high'
          });
        }

        // Sentiment shift alert
        if (Math.abs(coin.sentiment || 0) > 75) {
          alerts.push({
            alert_type: 'sentiment_shift',
            asset_symbol: coin.symbol,
            asset_name: coin.name,
            trigger_value: 75,
            current_value: Math.abs(coin.sentiment || 0),
            alert_message: `${coin.name} showing ${coin.sentiment > 0 ? 'extremely bullish' : 'extremely bearish'} sentiment (${coin.sentiment})`,
            severity: Math.abs(coin.sentiment || 0) > 90 ? 'critical' : 'high'
          });
        }
      }
    }

    if (alerts.length > 0) {
      const { error: alertError } = await supabase
        .from('market_alerts')
        .insert(alerts);

      if (!alertError) {
        console.log(`🚨 Generated ${alerts.length} market alerts`);
      }
    }

    // 5. Generate AI Market Brief using OpenAI
    console.log('🤖 Generating AI market brief...');
    
    const topSocialCoins = lunarData.data?.slice(0, 10) || [];
    const briefContext = {
      topSocialCoins,
      alerts: alerts.slice(0, 5),
      timestamp: new Date().toISOString()
    };

    const aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are the market brief writer with an American-Latino fisherman persona. Write professional crypto market briefs that start with "Let's talk about something..." and use fishing/ocean analogies. Be witty, confident, and clear. Include factual analysis without being fake news. Target both experienced traders and newcomers.`
          },
          {
            role: 'user',
            content: `Generate a market brief based on this data: ${JSON.stringify(briefContext)}. Include sections for What Happened, Why It Matters, Market Reaction, and What to Watch Next. Add a fishing-themed mini-section title and end with a Stoic quote.`
          }
        ],
        max_tokens: 1500,
        temperature: 0.7
      }),
    });

    const aiData = await aiResponse.json();
    const briefContent = aiData.choices?.[0]?.message?.content || 'Brief generation failed';

    // 6. Store the Generated Brief
    const briefSlug = `market-brief-${new Date().toISOString().split('T')[0]}-${Date.now()}`;
    
    const { error: briefError } = await supabase
      .from('market_briefs')
      .insert({
        brief_type: 'premarket',
        title: `Market Brief - ${new Date().toLocaleDateString()}`,
        slug: briefSlug,
        executive_summary: 'AI-generated market intelligence combining social sentiment and price data',
        content_sections: {
          ai_content: briefContent,
          social_data: topSocialCoins,
          alerts: alerts.slice(0, 5)
        },
        social_data: { top_coins: topSocialCoins },
        market_data: priceData,
        featured_assets: topSocialCoins.slice(0, 5).map(coin => coin.symbol),
        sentiment_score: topSocialCoins.reduce((acc, coin) => acc + (coin.sentiment || 0), 0) / topSocialCoins.length,
        is_published: true,
        published_at: new Date().toISOString()
      });

    if (briefError) {
      console.error('❌ Error storing market brief:', briefError);
      throw briefError;
    }

    console.log('✅ Market intelligence gathering completed successfully');

    return new Response(JSON.stringify({
      success: true,
      briefSlug,
      socialRecords: lunarData.data?.length || 0,
      priceRecords: Object.keys(priceData).length,
      alertsGenerated: alerts.length,
      briefContent: briefContent.substring(0, 200) + '...'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('🔥 Error in market intelligence function:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      details: 'Check function logs for more information'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});