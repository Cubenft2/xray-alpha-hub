import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';
import { toZonedTime, format } from 'https://esm.sh/date-fns-tz@3.2.0';

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

  try {
    const { briefType = 'morning' } = await req.json();
    console.log(`🤖 Claude Brief Generation Started - Type: ${briefType}`);

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // ===================================================================
    // STEP 1: Minimal Data Anchors (BTC, ETH, Date)
    // ===================================================================
    console.log('📊 Fetching minimal anchor data...');
    
    const etNow = toZonedTime(new Date(), 'America/New_York');
    const dateStr = format(etNow, 'yyyy-MM-dd', { timeZone: 'America/New_York' });
    const timeStr = format(etNow, 'h:mm a zzz', { timeZone: 'America/New_York' });

    // Fetch BTC and ETH prices from live_prices
    const { data: priceData, error: priceError } = await supabase
      .from('live_prices')
      .select('ticker, price, change24h, updated_at')
      .in('ticker', ['BTC', 'ETH'])
      .order('updated_at', { ascending: false });

    if (priceError) {
      throw new Error(`❌ Failed to fetch price data: ${priceError.message}`);
    }

    if (!priceData || priceData.length === 0) {
      throw new Error('❌ No price data found - run manual-price-sync first');
    }

    // Find BTC and ETH from results
    const btcData = priceData.find(p => p.ticker === 'BTC');
    const ethData = priceData.find(p => p.ticker === 'ETH');

    if (!btcData || !ethData) {
      throw new Error(`❌ Missing price data - BTC: ${!!btcData}, ETH: ${!!ethData}`);
    }

    const btcPrice = btcData.price || 0;
    const ethPrice = ethData.price || 0;
    const btcChange = btcData.change24h || 0;
    const ethChange = ethData.change24h || 0;

    // Validate prices are not zero
    if (btcPrice === 0 || ethPrice === 0) {
      throw new Error(`❌ Invalid price data - BTC: $${btcPrice}, ETH: $${ethPrice}`);
    }

    // Check if data is recent (within 24 hours)
    const btcAge = new Date().getTime() - new Date(btcData.updated_at).getTime();
    const ethAge = new Date().getTime() - new Date(ethData.updated_at).getTime();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours

    if (btcAge > maxAge || ethAge > maxAge) {
      console.warn(`⚠️ Price data is stale - BTC: ${Math.round(btcAge/3600000)}h, ETH: ${Math.round(ethAge/3600000)}h old`);
    }

    console.log(`✅ Anchors: BTC=$${btcPrice} (${btcChange.toFixed(2)}%), ETH=$${ethPrice} (${ethChange.toFixed(2)}%)`);

    // ===================================================================
    // STEP 2: Build Claude Prompt
    // ===================================================================
    const briefTypeTitle = briefType === 'morning' 
      ? 'Morning Brief' 
      : briefType === 'evening' 
        ? 'Evening Wrap' 
        : 'Weekly Recap';

    const prompt = `You are XRayCrypto's senior crypto market analyst. Write a comprehensive ${briefTypeTitle} for ${dateStr} at ${timeStr}.

CURRENT MARKET ANCHORS (verify these are accurate):
- Bitcoin (BTC): $${btcPrice.toLocaleString()} (${btcChange > 0 ? '+' : ''}${btcChange}% 24h)
- Ethereum (ETH): $${ethPrice.toLocaleString()} (${ethChange > 0 ? '+' : ''}${ethChange}% 24h)

STRUCTURE YOUR ANALYSIS:

1. **Market Overview** (150 words)
   - What's the headline story today? What's driving BTC/ETH?
   - Reference current prices and 24h changes
   - Mention overall market sentiment (bullish, bearish, neutral)

2. **Cryptocurrency Movers** (150 words)
   - Identify top 5 assets with significant movement today
   - For each asset, provide:
     * Current price and 24h change %
     * WHY it's moving (news, fundamentals, technicals)
   - Focus on assets beyond just BTC/ETH

3. **Social Sentiment & Trending Topics** (100 words)
   - What's trending in crypto social media today?
   - Key narratives, viral posts, or community discussions
   - Mention any major influencer takes

4. **Outlook & What to Watch** (50 words)
   - Key levels to watch for BTC/ETH
   - Upcoming events or catalysts
   - Risk factors or opportunities

CRITICAL RULES:
- Use ONLY factual data you have high confidence in
- If you don't have current data for a specific asset, write "data unavailable for [ASSET]"
- DO NOT invent numbers, percentages, or price movements
- Cite your reasoning (e.g., "based on recent trends..." or "historically during...")
- Write in XRayCrypto's style: analytical, concise, professional
- Format numbers clearly: $1,234.56 for prices, +12.34% for changes
- Use clear section headers with ## markdown
- Keep each section focused and avoid repetition

Write the ${briefTypeTitle} now:`;

    // ===================================================================
    // STEP 3: Call Claude API
    // ===================================================================
    console.log('🧠 Calling Claude Sonnet 4.5...');
    
    const claudeResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicApiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',
        max_tokens: 4096,
        temperature: 0.2, // Low temperature for factual accuracy
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      })
    });

    if (!claudeResponse.ok) {
      const errorText = await claudeResponse.text();
      console.error('❌ Claude API error:', claudeResponse.status, errorText);
      throw new Error(`Claude API error: ${claudeResponse.status} - ${errorText}`);
    }

    const claudeData = await claudeResponse.json();
    const generatedContent = claudeData.content[0].text;

    console.log(`✅ Claude generated ${generatedContent.length} characters`);

    // ===================================================================
    // STEP 4: Validate Response
    // ===================================================================
    console.log('🔍 Validating response...');

    // Check for template placeholders (shouldn't happen with Claude)
    if (generatedContent.includes('${{') || generatedContent.includes('undefined')) {
      throw new Error('Claude returned template placeholders - regenerating');
    }

    // Check minimum length
    if (generatedContent.length < 500) {
      throw new Error('Brief too short - regenerating');
    }

    // Check for obvious hallucination patterns (e.g., BTC at $10M)
    const suspiciousPricePattern = /\$\d{7,}/;
    if (suspiciousPricePattern.test(generatedContent)) {
      console.warn('⚠️ Suspicious price detected in content');
    }

    // Check for "data unavailable" mentions - log them
    const unavailableMatches = generatedContent.match(/data unavailable for \[(.*?)\]/gi);
    if (unavailableMatches) {
      console.log('ℹ️ Claude mentioned unavailable data for:', unavailableMatches);
    }

    // ===================================================================
    // STEP 5: Generate Slug and Title
    // ===================================================================
    const slug = `${briefType}-${dateStr}`;
    const title = `${briefTypeTitle} - ${format(etNow, 'EEEE, MMMM d, yyyy', { timeZone: 'America/New_York' })}`;

    // ===================================================================
    // STEP 6: Fetch or Generate Quote
    // ===================================================================
    console.log('📝 Fetching quote...');
    
    // Check for custom quote override
    const { data: customQuoteData } = await supabase
      .from('cache_kv')
      .select('v')
      .eq('k', 'custom_quote_override')
      .gt('expires_at', new Date().toISOString())
      .single();

    let stoicQuote = '';
    let stoicQuoteAuthor = '';

    if (customQuoteData?.v?.quote && customQuoteData?.v?.author) {
      stoicQuote = customQuoteData.v.quote;
      stoicQuoteAuthor = customQuoteData.v.author;
      console.log('✅ Using custom quote override');
    } else {
      // Fetch random quote from library
      const { data: quoteData } = await supabase
        .from('quote_library')
        .select('quote_text, author')
        .eq('is_active', true)
        .order('times_used', { ascending: true })
        .limit(10);

      if (quoteData && quoteData.length > 0) {
        const randomQuote = quoteData[Math.floor(Math.random() * quoteData.length)];
        stoicQuote = randomQuote.quote_text;
        stoicQuoteAuthor = randomQuote.author;
      }
    }

    // ===================================================================
    // STEP 7: Save Brief to Database
    // ===================================================================
    console.log('💾 Saving brief to database...');

    const briefData = {
      slug,
      title,
      brief_type: briefType,
      executive_summary: generatedContent.split('\n\n')[0] || generatedContent.substring(0, 300),
      content_sections: {
        full_content: generatedContent,
        generated_by: 'claude-sonnet-4-5',
        generation_method: 'minimal_anchor',
        anchors_used: {
          btc_price: btcPrice,
          btc_change: btcChange,
          eth_price: ethPrice,
          eth_change: ethChange
        }
      },
      stoic_quote: stoicQuote,
      stoic_quote_author: stoicQuoteAuthor,
      is_published: true,
      published_at: new Date().toISOString(),
      market_data: {
        btc: { price: btcPrice, change_24h: btcChange },
        eth: { price: ethPrice, change_24h: ethChange }
      },
      featured_assets: ['BTC', 'ETH']
    };

    const { data: savedBrief, error: saveError } = await supabase
      .from('market_briefs')
      .upsert(briefData, { onConflict: 'slug' })
      .select()
      .single();

    if (saveError) {
      console.error('❌ Error saving brief:', saveError);
      throw saveError;
    }

    console.log(`✅ Brief saved with ID: ${savedBrief.id}`);

    // Save quote usage
    if (stoicQuote && stoicQuoteAuthor && !customQuoteData) {
      await supabase.from('daily_quotes').insert({
        quote_text: stoicQuote,
        author: stoicQuoteAuthor,
        used_date: dateStr,
        brief_type: briefType,
        brief_id: savedBrief.id,
        source: 'quote_library'
      });
    }

    // ===================================================================
    // STEP 8: Return Response
    // ===================================================================
    return new Response(
      JSON.stringify({
        success: true,
        brief: savedBrief,
        slug: savedBrief.slug,
        message: `${briefTypeTitle} generated successfully with Claude Sonnet 4.5`,
        metadata: {
          model: 'claude-sonnet-4-5',
          temperature: 0.2,
          tokens: claudeData.usage,
          anchors: { btcPrice, ethPrice, btcChange, ethChange }
        }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );

  } catch (error: any) {
    console.error('❌ Claude brief generation error:', error);
    return new Response(
      JSON.stringify({
        error: error.message || 'Failed to generate brief with Claude',
        details: error.toString()
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});
