import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { force = false, notes = "" } = await req.json().catch(() => ({}));
    
    console.log('Triggering market brief generation...');
    console.log('Force:', force);
    console.log('Notes:', notes);
    
    // Force generation by calling the news-fetch function and creating a simple brief
    console.log('Creating fresh market brief using current news...');
    
    // Get fresh news from the news-fetch function
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
    const newsRes = await fetch('https://odncvfiuzliyohxrsigc.supabase.co/functions/v1/news-fetch', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${anonKey}`,
        'apikey': anonKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ limit: 10 })
    });
    
    if (!newsRes.ok) {
      throw new Error(`News fetch failed: ${newsRes.status}`);
    }
    
    const newsData = await newsRes.json();
    
    // Create a simple fresh brief using the news data
    const today = new Date();
    const dateStr = today.toISOString().split('T')[0];
    
    const freshBrief = {
      slug: dateStr + '-fresh',
      date: dateStr,
      title: `Fresh Market Brief — ${dateStr} — Live News Update`,
      summary: `Real-time market update with fresh news from crypto, stocks, and macro markets.`,
      article_html: `
        <h2>Fresh Market News</h2>
        <p>Here's what's happening right now in the markets:</p>
        
        <h3>🚀 Crypto Headlines</h3>
        ${(newsData.crypto || []).slice(0, 3).map((item: any) => 
          `<p><strong>${item.title}</strong><br><small>Source: ${item.source}</small></p>`
        ).join('')}
        
        <h3>📈 Stock Market News</h3>  
        ${(newsData.stocks || []).slice(0, 3).map((item: any) => 
          `<p><strong>${item.title}</strong><br><small>Source: ${item.source}</small></p>`
        ).join('')}
        
        <h2>Market Action</h2>
        <p>Markets are reacting to fresh developments across crypto and traditional assets. The news flow shows continued institutional activity and regulatory developments that traders should monitor.</p>
        
        <h2>What's Next</h2>
        <p>Keep an eye on the upcoming market sessions and any breaking news from regulatory bodies. Fresh data suggests active trading environments ahead.</p>
      `,
      last_word: 'Stay informed, stay flexible, and remember that fresh news moves markets faster than old headlines.',
      generated_at: new Date().toISOString()
    };
    
    console.log('Fresh brief generated:', freshBrief.title);
    
    const result = freshBrief;

    return new Response(JSON.stringify({
      success: true,
      message: 'Market brief generation triggered successfully',
      result
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error triggering market brief generation:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Failed to trigger market brief generation';
    
    return new Response(JSON.stringify({
      success: false,
      error: errorMessage
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});