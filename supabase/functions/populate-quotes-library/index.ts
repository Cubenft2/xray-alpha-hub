import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface StoicQuote {
  text: string;
  author: string;
}

interface PopulateStats {
  totalLoaded: number;
  totalInserted: number;
  totalDuplicates: number;
  errors: string[];
}

// Load stoic quotes from local JSON seed file
async function loadStoicQuotes(): Promise<StoicQuote[]> {
  try {
    const seedPath = new URL('../seed-data/stoic-quotes.json', import.meta.url);
    console.log('📚 Loading stoic quotes from seed file');
    
    const response = await fetch(seedPath);
    if (!response.ok) {
      throw new Error(`Failed to load seed file: ${response.status}`);
    }
    
    const quotes: StoicQuote[] = await response.json();
    console.log(`✅ Loaded ${quotes.length} stoic quotes from seed file`);
    return quotes;
  } catch (error) {
    console.error(`❌ Error loading stoic quotes:`, error);
    throw error;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    console.log('🚀 Starting stoic quote population from seed file');

    const stats: PopulateStats = {
      totalLoaded: 0,
      totalInserted: 0,
      totalDuplicates: 0,
      errors: [],
    };

    // Load quotes from seed file
    const seedQuotes = await loadStoicQuotes();
    stats.totalLoaded = seedQuotes.length;

    // Fetch existing quotes to check for duplicates
    const { data: existingQuotes } = await supabase
      .from('quote_library')
      .select('quote_text, author');

    const existingSet = new Set(
      (existingQuotes || []).map(q => `${q.quote_text}|||${q.author}`.toLowerCase())
    );

    console.log(`📚 Found ${existingSet.size} existing quotes in database`);

    // Process each quote from seed file
    for (const quote of seedQuotes) {
      try {
        const text = quote.text.trim();
        const author = quote.author.trim();
        
        if (!text || !author) {
          stats.errors.push('Skipped empty quote or author');
          console.log(`⏭️ Skipping empty quote`);
          continue;
        }
        
        // Check for duplicates
        const key = `${text}|||${author}`.toLowerCase();
        
        if (existingSet.has(key)) {
          stats.totalDuplicates++;
          console.log(`⏭️ Skipping duplicate: "${text.substring(0, 50)}..."`);
          continue;
        }

        // Insert quote
        const { error } = await supabase.from('quote_library').insert({
          quote_text: text,
          author: author,
          category: 'stoicism',
          is_active: true,
          times_used: 0,
        });

        if (error) {
          console.error(`❌ Error inserting quote:`, error);
          stats.errors.push(`Failed to insert quote: ${error.message}`);
        } else {
          stats.totalInserted++;
          existingSet.add(key);
          console.log(`✅ Inserted: "${text.substring(0, 50)}..." - ${author}`);
        }
      } catch (error) {
        console.error(`❌ Failed to process quote:`, error);
        stats.errors.push(`Quote processing failed: ${error.message}`);
      }
    }

    console.log('\n✅ Stoic quote population completed!');
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
