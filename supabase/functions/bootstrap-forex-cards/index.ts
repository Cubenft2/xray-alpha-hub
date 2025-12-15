import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Major forex pairs to flag
const MAJOR_PAIRS = [
  'EURUSD', 'GBPUSD', 'USDJPY', 'USDCHF', 'AUDUSD', 'USDCAD', 'NZDUSD',
  'EURGBP', 'EURJPY', 'GBPJPY', 'AUDJPY', 'EURAUD', 'EURCHF', 'GBPCHF'
];

// Currency flag emojis
const CURRENCY_FLAGS: Record<string, string> = {
  'USD': '🇺🇸', 'EUR': '🇪🇺', 'GBP': '🇬🇧', 'JPY': '🇯🇵', 'CHF': '🇨🇭',
  'AUD': '🇦🇺', 'CAD': '🇨🇦', 'NZD': '🇳🇿', 'CNY': '🇨🇳', 'HKD': '🇭🇰',
  'SGD': '🇸🇬', 'SEK': '🇸🇪', 'NOK': '🇳🇴', 'DKK': '🇩🇰', 'MXN': '🇲🇽',
  'ZAR': '🇿🇦', 'TRY': '🇹🇷', 'INR': '🇮🇳', 'BRL': '🇧🇷', 'RUB': '🇷🇺',
  'PLN': '🇵🇱', 'THB': '🇹🇭', 'IDR': '🇮🇩', 'MYR': '🇲🇾', 'PHP': '🇵🇭',
  'CZK': '🇨🇿', 'ILS': '🇮🇱', 'KRW': '🇰🇷', 'CLP': '🇨🇱', 'COP': '🇨🇴',
  'PEN': '🇵🇪', 'ARS': '🇦🇷', 'TWD': '🇹🇼', 'VND': '🇻🇳', 'EGP': '🇪🇬',
  'PKR': '🇵🇰', 'NGN': '🇳🇬', 'KES': '🇰🇪', 'GHS': '🇬🇭', 'MAD': '🇲🇦',
  'AED': '🇦🇪', 'SAR': '🇸🇦', 'QAR': '🇶🇦', 'KWD': '🇰🇼', 'BHD': '🇧🇭',
  'OMR': '🇴🇲', 'JOD': '🇯🇴', 'LBP': '🇱🇧', 'HUF': '🇭🇺', 'RON': '🇷🇴',
  'BGN': '🇧🇬', 'HRK': '🇭🇷', 'ISK': '🇮🇸', 'UAH': '🇺🇦', 'KZT': '🇰🇿'
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('[bootstrap-forex-cards] Starting bootstrap from poly_fx_pairs...');

    // Fetch all forex pairs from poly_fx_pairs with pagination
    const PAGE_SIZE = 1000;
    let fxPairs: any[] = [];
    let offset = 0;
    
    while (true) {
      const { data: page, error: fetchError } = await supabase
        .from('poly_fx_pairs')
        .select('*')
        .eq('active', true)
        .range(offset, offset + PAGE_SIZE - 1);

      if (fetchError) {
        throw new Error(`Failed to fetch poly_fx_pairs: ${fetchError.message}`);
      }

      if (!page || page.length === 0) break;
      fxPairs.push(...page);
      
      if (page.length < PAGE_SIZE) break;
      offset += PAGE_SIZE;
    }

    console.log(`[bootstrap-forex-cards] Fetched ${fxPairs.length} forex pairs`);

    if (!fxPairs || fxPairs.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        message: 'No forex pairs to bootstrap',
        stats: { created: 0 }
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Transform to forex_cards format
    const forexCards = fxPairs.map(pair => {
      // Extract base and quote from ticker C:EURUSD -> EUR, USD
      const rawPair = pair.ticker.replace('C:', '');
      const base = pair.base_currency;
      const quote = pair.quote_currency;
      
      // Check if major pair
      const isMajor = MAJOR_PAIRS.includes(rawPair) || 
                      MAJOR_PAIRS.includes(`${quote}${base}`);

      return {
        pair: rawPair,
        base_currency: base,
        quote_currency: quote,
        display_name: `${base}/${quote}`,
        base_flag: CURRENCY_FLAGS[base] || null,
        quote_flag: CURRENCY_FLAGS[quote] || null,
        is_major: isMajor,
        is_active: true
      };
    });

    console.log(`[bootstrap-forex-cards] Prepared ${forexCards.length} forex cards`);
    console.log(`[bootstrap-forex-cards] Major pairs: ${forexCards.filter(c => c.is_major).length}`);

    // Upsert in batches
    const BATCH_SIZE = 100;
    let created = 0;
    let errors = 0;

    for (let i = 0; i < forexCards.length; i += BATCH_SIZE) {
      const batch = forexCards.slice(i, i + BATCH_SIZE);
      
      const { data, error } = await supabase
        .from('forex_cards')
        .upsert(batch, { onConflict: 'pair', ignoreDuplicates: false })
        .select('pair');

      if (error) {
        console.error(`[bootstrap-forex-cards] Batch ${Math.floor(i / BATCH_SIZE) + 1} error:`, error.message);
        errors += batch.length;
      } else {
        created += data?.length || batch.length;
      }
    }

    const duration = Date.now() - startTime;
    console.log(`[bootstrap-forex-cards] Bootstrap complete in ${duration}ms: ${created} created, ${errors} errors`);

    return new Response(JSON.stringify({
      success: true,
      stats: {
        source_pairs: fxPairs.length,
        created,
        majors: forexCards.filter(c => c.is_major).length,
        errors,
        duration_ms: duration
      }
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('[bootstrap-forex-cards] Fatal error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), { 
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  }
});
