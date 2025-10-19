import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';
import { toZonedTime, format } from 'https://esm.sh/date-fns-tz@3.2.0';
import { fetchComprehensiveMarketData } from './data-fetchers.ts';
import { buildEnhancedPrompt, countWords } from './prompt-builder.ts';
import { buildSundaySpecialPrompt } from './sunday-special-prompt.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY')!;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  
  try {
    const { briefType = 'morning' } = await req.json();
    console.log(`🤖 Automated Brief Generation Started - Type: ${briefType}`);
    console.log(`⏰ Timestamp: ${new Date().toISOString()}`);

    // Validate brief type
    const validTypes = ['morning', 'evening', 'weekend', 'sunday_special'];
    if (!validTypes.includes(briefType)) {
      throw new Error(`Invalid brief type: ${briefType}`);
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get current ET time
    const etNow = toZonedTime(new Date(), 'America/New_York');
    const dateStr = format(etNow, 'yyyy-MM-dd', { timeZone: 'America/New_York' });
    const timeStr = format(etNow, 'h:mm a zzz', { timeZone: 'America/New_York' });

    // ===================================================================
    // STEP 1: Fetch Comprehensive Market Data
    // ===================================================================
    console.log('📊 Fetching comprehensive market data from 5+ APIs...');
    const marketData = await fetchComprehensiveMarketData();
    
    console.log(`✅ Market data fetched:
      - ${marketData.topCoins.length} coins from CoinGecko
      - ${marketData.socialSentiment.length} assets with social data
      - Fear & Greed: ${marketData.fearGreedIndex} (${marketData.fearGreedLabel})
      - BTC Funding: ${marketData.btcFundingRate.toFixed(4)}%
      - ETH Funding: ${marketData.ethFundingRate.toFixed(4)}%
      - COIN Stock: ${marketData.coinStock ? '$' + marketData.coinStock.close.toFixed(2) : 'N/A'}
      - MSTR Stock: ${marketData.mstrStock ? '$' + marketData.mstrStock.close.toFixed(2) : 'N/A'}`);

    // ===================================================================
    // STEP 2: Build Enhanced Prompt
    // ===================================================================
    console.log('📝 Building enhanced prompt with comprehensive data...');
    const prompt = briefType === 'sunday_special'
      ? buildSundaySpecialPrompt(dateStr, timeStr, marketData)
      : buildEnhancedPrompt(briefType, dateStr, timeStr, marketData);
    console.log(`✅ Prompt built: ${prompt.length} characters`);

    // ===================================================================
    // STEP 3: Call Claude API
    // ===================================================================
    console.log('🧠 Calling Claude Sonnet 4 (2025-05-14)...');
    
    const claudeResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicApiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: briefType === 'sunday_special' ? 6000 : 4000,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!claudeResponse.ok) {
      const errorText = await claudeResponse.text();
      console.error('❌ Claude API error:', claudeResponse.status, errorText);
      throw new Error(`Claude API error: ${claudeResponse.status}`);
    }

    const claudeData = await claudeResponse.json();
    const generatedContent = claudeData.content[0].text;
    const wordCount = countWords(generatedContent);

    console.log(`✅ Claude generated ${generatedContent.length} characters (${wordCount} words)`);
    console.log(`📊 Token usage: ${claudeData.usage.input_tokens} input, ${claudeData.usage.output_tokens} output`);

    // ===================================================================
    // STEP 4: Fetch Quote
    // ===================================================================
    const { data: quoteData } = await supabase
      .from('quote_library')
      .select('quote_text, author')
      .eq('is_active', true)
      .order('times_used', { ascending: true })
      .limit(10);

    let stoicQuote = '';
    let stoicQuoteAuthor = '';
    
    if (quoteData && quoteData.length > 0) {
      const randomQuote = quoteData[Math.floor(Math.random() * quoteData.length)];
      stoicQuote = randomQuote.quote_text;
      stoicQuoteAuthor = randomQuote.author;
    }

    // ===================================================================
    // STEP 5: Save Brief to Database
    // ===================================================================
    const slug = `${briefType}-${dateStr}`;
    const briefTypeTitle = briefType === 'morning' 
      ? 'Morning Brief' 
      : briefType === 'evening' 
        ? 'Evening Wrap'
        : briefType === 'sunday_special'
          ? '🎬 Sunday Special'
          : 'Weekly Recap';
    const title = `${briefTypeTitle} - ${format(etNow, 'EEEE, MMMM d, yyyy', { timeZone: 'America/New_York' })}`;

    // Extract featured assets from top movers
    const featuredAssets = ['BTC', 'ETH', ...marketData.topCoins.slice(0, 5).map(c => c.symbol.toUpperCase())];

    const briefData = {
      slug,
      title,
      brief_type: briefType,
      executive_summary: generatedContent.split('\n\n')[0] || generatedContent.substring(0, 300),
      content_sections: {
        full_content: generatedContent,
        generated_by: 'claude-sonnet-4-20250514',
        generation_method: 'comprehensive_auto',
        data_sources: ['coingecko', 'lunarcrush', 'polygon', 'binance', 'feargreed']
      },
      stoic_quote: stoicQuote,
      stoic_quote_author: stoicQuoteAuthor,
      is_published: true,
      published_at: new Date().toISOString(),
      word_count: wordCount,
      market_data: {
        btc: marketData.btc,
        eth: marketData.eth,
        total_market_cap: marketData.totalMarketCap,
        btc_dominance: marketData.btcDominance,
        fear_greed_index: marketData.fearGreedIndex,
        btc_funding_rate: marketData.btcFundingRate,
        eth_funding_rate: marketData.ethFundingRate,
        token_usage: claudeData.usage
      },
      featured_assets: featuredAssets
    };

    const { data: savedBrief, error: saveError } = await supabase
      .from('market_briefs')
      .upsert(briefData, { onConflict: 'slug' })
      .select()
      .single();

    if (saveError) {
      throw saveError;
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`✅ Brief saved successfully in ${duration}s`);

    // ===================================================================
    // STEP 6: Return Response
    // ===================================================================
    return new Response(
      JSON.stringify({
        success: true,
        brief: savedBrief,
        slug: savedBrief.slug,
        message: `${briefTypeTitle} generated successfully`,
        metadata: {
          model: 'claude-sonnet-4-20250514',
          duration_seconds: parseFloat(duration),
          word_count: wordCount,
          tokens: claudeData.usage,
          data_sources: ['coingecko', 'lunarcrush', 'polygon', 'binance', 'feargreed']
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error: any) {
    console.error('❌ Brief generation error:', error);
    return new Response(
      JSON.stringify({ error: error.message, details: error.toString() }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
