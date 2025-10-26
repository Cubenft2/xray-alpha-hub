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

const CATEGORIES = [
  'money',
  'success', 
  'business',
  'inspirational',
  'wisdom',
  'learning',
  'leadership',
  'courage',
  'change',
  'dreams',
  'happiness',
  'age',
  'famous'
];

const QUOTES_PER_CATEGORY = 30; // We'll try to fetch this many per category
const BATCH_SIZE = 10; // API Ninjas typically allows up to 10 per request

async function fetchQuotesFromCategory(
  category: string,
  apiKey: string,
  targetCount: number
): Promise<ApiNinjasQuote[]> {
  const allQuotes: ApiNinjasQuote[] = [];
  const batches = Math.ceil(targetCount / BATCH_SIZE);

  for (let i = 0; i < batches; i++) {
    try {
      const url = `https://api.api-ninjas.com/v1/quotes?category=${category}&limit=${BATCH_SIZE}`;
      console.log(`📡 Fetching quotes from category: ${category} (batch ${i + 1}/${batches})`);
      
      const response = await fetch(url, {
        headers: {
          'X-Api-Key': apiKey,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ API Ninjas error for ${category}: ${response.status} - ${errorText}`);
        break; // Stop trying this category if we get an error
      }

      const quotes: ApiNinjasQuote[] = await response.json();
      console.log(`✅ Fetched ${quotes.length} quotes from ${category}`);
      
      allQuotes.push(...quotes);

      // Small delay to avoid rate limiting
      if (i < batches - 1) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    } catch (error) {
      console.error(`❌ Error fetching ${category}:`, error);
      break;
    }
  }

  return allQuotes;
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

    // Process each category
    for (const category of CATEGORIES) {
      console.log(`\n🔄 Processing category: ${category}`);
      
      try {
        const quotes = await fetchQuotesFromCategory(category, apiKey, QUOTES_PER_CATEGORY);
        stats.totalFetched += quotes.length;
        stats.categoriesProcessed[category] = 0;

        for (const quote of quotes) {
          const key = `${quote.quote}|||${quote.author}`.toLowerCase();
          
          if (existingSet.has(key)) {
            stats.totalDuplicates++;
            continue;
          }

          // Insert new quote
          const { error } = await supabase.from('quote_library').insert({
            quote_text: quote.quote,
            author: quote.author,
            category: category,
            is_active: true,
            times_used: 0,
          });

          if (error) {
            console.error(`❌ Error inserting quote:`, error);
            stats.errors.push(`Failed to insert quote from ${category}: ${error.message}`);
          } else {
            stats.totalInserted++;
            stats.categoriesProcessed[category]++;
            existingSet.add(key); // Add to set to avoid duplicates within this run
          }
        }

        console.log(`✅ Category ${category}: inserted ${stats.categoriesProcessed[category]} new quotes`);

        // Small delay between categories
        await new Promise(resolve => setTimeout(resolve, 300));
      } catch (error) {
        console.error(`❌ Failed to process category ${category}:`, error);
        stats.errors.push(`Category ${category} failed: ${error.message}`);
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
