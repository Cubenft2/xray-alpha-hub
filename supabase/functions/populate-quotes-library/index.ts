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

// Embedded stoic quotes collection
const STOIC_QUOTES: StoicQuote[] = [
  {
    "text": "You have power over your mind - not outside events. Realize this, and you will find strength.",
    "author": "Marcus Aurelius"
  },
  {
    "text": "The happiness of your life depends upon the quality of your thoughts.",
    "author": "Marcus Aurelius"
  },
  {
    "text": "Waste no more time arguing about what a good man should be. Be one.",
    "author": "Marcus Aurelius"
  },
  {
    "text": "If it is not right, do not do it. If it is not true, do not say it.",
    "author": "Marcus Aurelius"
  },
  {
    "text": "The best revenge is not to be like your enemy.",
    "author": "Marcus Aurelius"
  },
  {
    "text": "When you arise in the morning, think of what a precious privilege it is to be alive - to breathe, to think, to enjoy, to love.",
    "author": "Marcus Aurelius"
  },
  {
    "text": "Very little is needed to make a happy life; it is all within yourself, in your way of thinking.",
    "author": "Marcus Aurelius"
  },
  {
    "text": "Accept whatever comes to you woven in the pattern of your destiny, for what could more aptly fit your needs?",
    "author": "Marcus Aurelius"
  },
  {
    "text": "Our life is what our thoughts make it.",
    "author": "Marcus Aurelius"
  },
  {
    "text": "The soul becomes dyed with the color of its thoughts.",
    "author": "Marcus Aurelius"
  },
  {
    "text": "We suffer more often in imagination than in reality.",
    "author": "Seneca"
  },
  {
    "text": "Luck is what happens when preparation meets opportunity.",
    "author": "Seneca"
  },
  {
    "text": "Difficulties strengthen the mind, as labor does the body.",
    "author": "Seneca"
  },
  {
    "text": "It is not the man who has too little, but the man who craves more, that is poor.",
    "author": "Seneca"
  },
  {
    "text": "True happiness is to enjoy the present, without anxious dependence upon the future.",
    "author": "Seneca"
  },
  {
    "text": "Wealth is the slave of a wise man. The master of a fool.",
    "author": "Seneca"
  },
  {
    "text": "Begin at once to live, and count each separate day as a separate life.",
    "author": "Seneca"
  },
  {
    "text": "Life is long if you know how to use it.",
    "author": "Seneca"
  },
  {
    "text": "Associate with people who are likely to improve you.",
    "author": "Seneca"
  },
  {
    "text": "He who is brave is free.",
    "author": "Seneca"
  },
  {
    "text": "It's not what happens to you, but how you react to it that matters.",
    "author": "Epictetus"
  },
  {
    "text": "Don't explain your philosophy. Embody it.",
    "author": "Epictetus"
  },
  {
    "text": "First say to yourself what you would be; and then do what you have to do.",
    "author": "Epictetus"
  },
  {
    "text": "No man is free who is not master of himself.",
    "author": "Epictetus"
  },
  {
    "text": "Wealth consists not in having great possessions, but in having few wants.",
    "author": "Epictetus"
  },
  {
    "text": "He is a wise man who does not grieve for the things which he has not, but rejoices for those which he has.",
    "author": "Epictetus"
  },
  {
    "text": "If you want to improve, be content to be thought foolish and stupid.",
    "author": "Epictetus"
  },
  {
    "text": "The key is to keep company only with people who uplift you, whose presence calls forth your best.",
    "author": "Epictetus"
  },
  {
    "text": "Only the educated are free.",
    "author": "Epictetus"
  },
  {
    "text": "Any person capable of angering you becomes your master.",
    "author": "Epictetus"
  },
  {
    "text": "The obstacle is the way.",
    "author": "Ryan Holiday"
  },
  {
    "text": "The impediment to action advances action. What stands in the way becomes the way.",
    "author": "Ryan Holiday"
  },
  {
    "text": "Be tolerant with others and strict with yourself.",
    "author": "Marcus Aurelius"
  },
  {
    "text": "The best way to avenge yourself is to not be like that.",
    "author": "Marcus Aurelius"
  },
  {
    "text": "You could leave life right now. Let that determine what you do and say and think.",
    "author": "Marcus Aurelius"
  },
  {
    "text": "It is not death that a man should fear, but he should fear never beginning to live.",
    "author": "Marcus Aurelius"
  },
  {
    "text": "If you are distressed by anything external, the pain is not due to the thing itself, but to your estimate of it; and this you have the power to revoke at any moment.",
    "author": "Marcus Aurelius"
  },
  {
    "text": "Everything we hear is an opinion, not a fact. Everything we see is a perspective, not the truth.",
    "author": "Marcus Aurelius"
  },
  {
    "text": "The only wealth which you will keep forever is the wealth you have given away.",
    "author": "Marcus Aurelius"
  },
  {
    "text": "Do not indulge in dreams of having what you have not, but reckon up the chief of the blessings you do possess.",
    "author": "Marcus Aurelius"
  },
  {
    "text": "Life is not a problem to be solved, but a reality to be experienced.",
    "author": "Søren Kierkegaard"
  },
  {
    "text": "No person has the power to have everything they want, but it is in their power not to want what they don't have.",
    "author": "Seneca"
  },
  {
    "text": "What need is there to weep over parts of life? The whole of it calls for tears.",
    "author": "Seneca"
  },
  {
    "text": "As long as you live, keep learning how to live.",
    "author": "Seneca"
  },
  {
    "text": "If a man knows not which port he sails, no wind is favorable.",
    "author": "Seneca"
  },
  {
    "text": "A gem cannot be polished without friction, nor a man perfected without trials.",
    "author": "Seneca"
  },
  {
    "text": "The greatest wealth is to live content with little.",
    "author": "Plato"
  },
  {
    "text": "Know thyself.",
    "author": "Socrates"
  },
  {
    "text": "The unexamined life is not worth living.",
    "author": "Socrates"
  },
  {
    "text": "I cannot teach anybody anything. I can only make them think.",
    "author": "Socrates"
  },
  {
    "text": "The price of anything is the amount of life you exchange for it.",
    "author": "Henry David Thoreau"
  },
  {
    "text": "Be yourself; everyone else is already taken.",
    "author": "Oscar Wilde"
  },
  {
    "text": "In the end, we only regret the chances we didn't take.",
    "author": "Lewis Carroll"
  },
  {
    "text": "The way to get started is to quit talking and begin doing.",
    "author": "Walt Disney"
  },
  {
    "text": "It's fine to celebrate success but it is more important to heed the lessons of failure.",
    "author": "Bill Gates"
  },
  {
    "text": "Your most unhappy customers are your greatest source of learning.",
    "author": "Bill Gates"
  },
  {
    "text": "The biggest risk is not taking any risk. In a world that is changing really quickly, the only strategy that is guaranteed to fail is not taking risks.",
    "author": "Mark Zuckerberg"
  },
  {
    "text": "Risk comes from not knowing what you're doing.",
    "author": "Warren Buffett"
  },
  {
    "text": "It's far better to buy a wonderful company at a fair price than a fair company at a wonderful price.",
    "author": "Warren Buffett"
  },
  {
    "text": "The stock market is a device for transferring money from the impatient to the patient.",
    "author": "Warren Buffett"
  },
  {
    "text": "Price is what you pay. Value is what you get.",
    "author": "Warren Buffett"
  },
  {
    "text": "Someone is sitting in the shade today because someone planted a tree a long time ago.",
    "author": "Warren Buffett"
  },
  {
    "text": "In the world of business, the people who are most successful are those who are doing what they love.",
    "author": "Warren Buffett"
  },
  {
    "text": "Compound interest is the eighth wonder of the world. He who understands it, earns it; he who doesn't, pays it.",
    "author": "Albert Einstein"
  },
  {
    "text": "Desire is a contract you make with yourself to be unhappy until you get what you want.",
    "author": "Naval Ravikant"
  },
  {
    "text": "Seek wealth, not money or status. Wealth is having assets that earn while you sleep.",
    "author": "Naval Ravikant"
  },
  {
    "text": "Earn with your mind, not your time.",
    "author": "Naval Ravikant"
  },
  {
    "text": "The more you own, the more it owns you.",
    "author": "Naval Ravikant"
  },
  {
    "text": "Clear thinking requires courage rather than intelligence.",
    "author": "Naval Ravikant"
  },
  {
    "text": "Pain plus reflection equals progress.",
    "author": "Ray Dalio"
  },
  {
    "text": "He who lives in harmony with himself lives in harmony with the universe.",
    "author": "Marcus Aurelius"
  },
  {
    "text": "To be everywhere is to be nowhere.",
    "author": "Seneca"
  },
  {
    "text": "Happiness is not having what you want, it is wanting what you have.",
    "author": "Socrates"
  },
  {
    "text": "Character is long-standing habit.",
    "author": "Plutarch"
  },
  {
    "text": "The whole future lies in uncertainty: live immediately.",
    "author": "Seneca"
  }
];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    console.log('🚀 Starting stoic quote population from embedded collection');

    const stats: PopulateStats = {
      totalLoaded: 0,
      totalInserted: 0,
      totalDuplicates: 0,
      errors: [],
    };

    // Use embedded quotes
    const seedQuotes = STOIC_QUOTES;
    stats.totalLoaded = seedQuotes.length;

    // Fetch existing quotes to check for duplicates
    const { data: existingQuotes } = await supabase
      .from('quote_library')
      .select('quote_text, author');

    const existingSet = new Set(
      (existingQuotes || []).map(q => `${q.quote_text}|||${q.author}`.toLowerCase())
    );

    console.log(`📚 Found ${existingSet.size} existing quotes in database`);

    // Process each quote from embedded collection
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
