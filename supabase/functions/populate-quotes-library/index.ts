import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ApiNinjasQuote {
  quote: string;
  author: string;
  category: string;
}

interface PopulateStats {
  totalFetched: number;
  totalInserted: number;
  totalDuplicates: number;
  errors: string[];
  categoriesProcessed: { [key: string]: number };
}

// Free tier: 10 random quotes per run (no category support on free tier)
const QUOTES_PER_RUN = 10;
const MAX_QUOTE_LEN = 200;

// Truncate to whole word to respect DB constraint
function truncateToWholeWord(text: string, maxLen: number): string {
  if (!text || text.length <= maxLen) return text;
  
  let truncated = text.slice(0, maxLen);
  const lastSpace = truncated.lastIndexOf(' ');
  
  if (lastSpace > 0) {
    truncated = truncated.slice(0, lastSpace);
  }
  
  return truncated.trim() + '…';
}

// Free tier: fetch one random quote (no parameters allowed)
async function fetchRandomQuote(
  apiKey: string
): Promise<ApiNinjasQuote | null> {
  try {
    // Free tier: no parameters at all, returns 1 random quote
    const url = 'https://api.api-ninjas.com/v1/quotes';
    console.log('📡 Fetching random quote from API Ninjas');
    
    const response = await fetch(url, {
      headers: {
        'X-Api-Key': apiKey,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ API Ninjas error: ${response.status} - ${errorText}`);
      return null;
    }

    const quotes: ApiNinjasQuote[] = await response.json();
    
    if (quotes.length > 0) {
      console.log(`✅ Fetched quote: "${quotes[0].quote.substring(0, 50)}..."`);
      return quotes[0];
    }
    
    return null;
  } catch (error) {
    console.error(`❌ Error fetching quote:`, error);
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get('API_NINJAS_KEY');
    if (!apiKey) {
      throw new Error('API_NINJAS_KEY not configured');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    console.log('🚀 Starting quote population from API Ninjas');

    const stats: PopulateStats = {
      totalFetched: 0,
      totalInserted: 0,
      totalDuplicates: 0,
      errors: [],
      categoriesProcessed: {},
    };

    // Fetch existing quotes to check for duplicates
    const { data: existingQuotes } = await supabase
      .from('quote_library')
      .select('quote_text, author');

    const existingSet = new Set(
      (existingQuotes || []).map(q => `${q.quote_text}|||${q.author}`.toLowerCase())
    );

    console.log(`📚 Found ${existingSet.size} existing quotes in database`);

    // Fetch random quotes (no categories on free tier)
    for (let i = 1; i <= QUOTES_PER_RUN; i++) {
      console.log(`\n🔄 Fetching quote ${i}/${QUOTES_PER_RUN}`);
      
      try {
        const quote = await fetchRandomQuote(apiKey);
        
        if (!quote) {
          console.log(`⚠️ No quote received`);
          continue;
        }
        
        stats.totalFetched++;
        
        // Normalize fields before checking duplicates or inserting
        const rawText = (quote.quote || '').trim();
        const text = truncateToWholeWord(rawText, MAX_QUOTE_LEN);
        const author = (quote.author || 'Unknown').trim();
        const category = (quote.category || 'general').trim().toLowerCase();
        
        // Skip if quote is too short after truncation
        if (!text || text.length < 5) {
          stats.errors.push('Skipped empty or too-short quote');
          console.log(`⏭️ Skipping empty/too-short quote`);
          continue;
        }
        
        // Use normalized text for duplicate check
        const key = `${text}|||${author}`.toLowerCase();
        
        if (existingSet.has(key)) {
          stats.totalDuplicates++;
          console.log(`⏭️ Skipping duplicate quote`);
          continue;
        }

        // Insert with normalized fields
        const { error } = await supabase.from('quote_library').insert({
          quote_text: text,
          author: author,
          category: category,
          is_active: true,
          times_used: 0,
        });

        if (error) {
          console.error(`❌ Error inserting quote:`, error);
          stats.errors.push(`Failed to insert quote: ${error.message}`);
        } else {
          stats.totalInserted++;
          stats.categoriesProcessed[category] = (stats.categoriesProcessed[category] || 0) + 1;
          existingSet.add(key);
          console.log(`✅ Inserted new quote (${category})`);
        }

        // Delay between calls to respect rate limits (500ms)
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        console.error(`❌ Failed to fetch quote:`, error);
        stats.errors.push(`Quote fetch failed: ${error.message}`);
      }
    }

    console.log('\n✅ Quote population completed!');
    console.log(`📊 Stats:`, stats);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Quote library populated successfully',
        stats,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('❌ Fatal error in populate-quotes-library:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
