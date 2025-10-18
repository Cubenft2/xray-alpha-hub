import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      throw new Error('OPENAI_API_KEY not configured');
    }

    const { topic, style, includeCharts } = await req.json();

    console.log('📝 Generating manual brief:', { topic, style, includeCharts });

    const prompt = `You are Xavier Rodriguez (XRay Crypto), an experienced crypto market analyst.

CRITICAL RULES:
1. Use REAL current market data (search for current prices if needed)
2. Never use byline "By Xavier Rodriguez" in output
3. Format: "AssetName (TICKER $PRICE CHANGE%): Analysis..."
4. No repetition of facts
5. Educational tone, no financial advice
6. Use "could," "might," "suggests" - never "will," "must"

${topic ? `TOPIC: ${topic}` : 'Create a comprehensive market brief for today'}
${style ? `STYLE: ${style}` : 'STYLE: Market Psychologist (conversational, educational, explanatory)'}

Create a professional crypto market brief with these sections:
1. Market Overview (BTC, ETH, total market cap, Fear & Greed Index)
2. Cryptocurrency Movers (top gainers/losers with context and reasons)
3. Traditional Markets (major stock indices, crypto-related equities if relevant)
4. What's Next (upcoming catalysts, key technical levels to watch)

${includeCharts ? 'IMPORTANT: Include TradingView chart links for major assets mentioned.' : ''}

Generate the brief now:`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: 'You are Xavier Rodriguez, an experienced crypto market analyst who writes professional, data-driven market briefs with educational insights.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.85,
        max_tokens: 3000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error:', response.status, errorText);
      throw new Error(`OpenAI API failed: ${response.status}`);
    }

    const data = await response.json();
    let briefContent = data.choices[0].message.content;

    // If charts requested, add TradingView links
    if (includeCharts) {
      briefContent += `\n\n---\n\n## 📊 Interactive Charts & Tools\n\n`;
      
      // Check what was mentioned and add relevant charts
      const btcMentioned = /Bitcoin|BTC/i.test(briefContent);
      const ethMentioned = /Ethereum|ETH/i.test(briefContent);
      const solMentioned = /Solana|SOL/i.test(briefContent);
      const nvdaMentioned = /NVDA|Nvidia/i.test(briefContent);
      const coinMentioned = /Coinbase|COIN/i.test(briefContent);
      const mstrMentioned = /MicroStrategy|MSTR/i.test(briefContent);
      
      if (btcMentioned) {
        briefContent += `**Bitcoin (BTC):** [View Chart →](https://www.tradingview.com/symbols/BTCUSD/)\n`;
      }
      
      if (ethMentioned) {
        briefContent += `**Ethereum (ETH):** [View Chart →](https://www.tradingview.com/symbols/ETHUSD/)\n`;
      }
      
      if (solMentioned) {
        briefContent += `**Solana (SOL):** [View Chart →](https://www.tradingview.com/symbols/SOLUSD/)\n`;
      }
      
      if (nvdaMentioned) {
        briefContent += `**NVIDIA (NVDA):** [View Chart →](https://www.tradingview.com/symbols/NVDA/)\n`;
      }
      
      if (coinMentioned) {
        briefContent += `**Coinbase (COIN):** [View Chart →](https://www.tradingview.com/symbols/NASDAQ-COIN/)\n`;
      }
      
      if (mstrMentioned) {
        briefContent += `**MicroStrategy (MSTR):** [View Chart →](https://www.tradingview.com/symbols/NASDAQ-MSTR/)\n`;
      }
      
      // Always add these
      briefContent += `**S&P 500 (SPY):** [View Chart →](https://www.tradingview.com/symbols/SPX/)\n`;
      briefContent += `**Fear & Greed Index:** [View Index →](https://alternative.me/crypto/fear-and-greed-index/)\n`;
      briefContent += `**Market Dashboard:** [TradingView Crypto →](https://www.tradingview.com/markets/cryptocurrencies/)\n`;
    }

    console.log('✅ Manual brief generated successfully');

    return new Response(
      JSON.stringify({
        success: true,
        brief: briefContent,
        timestamp: new Date().toISOString(),
        wordCount: briefContent.split(/\s+/).length,
        topic: topic || 'General market brief',
        style: style || 'Market Psychologist'
      }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    );

  } catch (error) {
    console.error('❌ Manual brief generation failed:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message || 'Unknown error occurred'
      }),
      { 
        status: 500,
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    );
  }
});
