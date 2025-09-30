import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ValidationResult {
  symbol: string;
  normalized: string;
  resolved: boolean;
  capabilities: {
    price_ok: boolean;
    tv_ok: boolean;
    derivs_ok: boolean;
    social_ok: boolean;
  };
  mapping?: any;
  display_name?: string;
}

interface ValidationReport {
  validated: ValidationResult[];
  missing: string[];
  summary: {
    total: number;
    resolved: number;
    missing: number;
    price_supported: number;
    tv_supported: number;
    derivs_supported: number;
    social_supported: number;
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { symbols } = await req.json();
    
    if (!symbols || !Array.isArray(symbols)) {
      return new Response(
        JSON.stringify({ error: 'symbols array required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`🔍 Validating ${symbols.length} symbols...`);

    const validated: ValidationResult[] = [];
    const missing: string[] = [];

    // Normalize function
    const normalize = (s: string) => s.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');

    for (const rawSymbol of symbols) {
      const normalized = normalize(rawSymbol);
      
      // Query ticker_mappings for this symbol
      const { data: mapping, error } = await supabase
        .from('ticker_mappings')
        .select(`
          symbol,
          display_name,
          type,
          price_supported,
          tradingview_supported,
          derivs_supported,
          social_supported,
          coingecko_id,
          polygon_ticker,
          tradingview_symbol
        `)
        .or(`symbol.ilike.${normalized},aliases.cs.{${normalized}}`)
        .eq('is_active', true)
        .maybeSingle();

      if (error) {
        console.warn(`Error querying mapping for ${normalized}:`, error);
      }

      if (mapping) {
        // Symbol resolved
        validated.push({
          symbol: rawSymbol,
          normalized,
          resolved: true,
          capabilities: {
            price_ok: mapping.price_supported !== false,
            tv_ok: mapping.tradingview_supported !== false,
            derivs_ok: mapping.derivs_supported === true,
            social_ok: mapping.social_supported === true,
          },
          mapping,
          display_name: mapping.display_name,
        });
      } else {
        // Symbol not found - add to missing
        missing.push(rawSymbol);
        validated.push({
          symbol: rawSymbol,
          normalized,
          resolved: false,
          capabilities: {
            price_ok: false,
            tv_ok: false,
            derivs_ok: false,
            social_ok: false,
          },
        });

        // Track missing symbol in database
        await supabase.from('missing_symbols').upsert({
          symbol: rawSymbol,
          normalized_symbol: normalized,
          last_seen_at: new Date().toISOString(),
          occurrence_count: 1,
        }, {
          onConflict: 'normalized_symbol',
          ignoreDuplicates: false,
        }).then(({ error: upsertError }) => {
          if (upsertError) {
            console.warn(`Failed to track missing symbol ${normalized}:`, upsertError);
          }
        });
      }
    }

    const summary = {
      total: symbols.length,
      resolved: validated.filter(v => v.resolved).length,
      missing: missing.length,
      price_supported: validated.filter(v => v.capabilities.price_ok).length,
      tv_supported: validated.filter(v => v.capabilities.tv_ok).length,
      derivs_supported: validated.filter(v => v.capabilities.derivs_ok).length,
      social_supported: validated.filter(v => v.capabilities.social_ok).length,
    };

    console.log(`✅ Validation complete:`, summary);
    if (missing.length > 0) {
      console.warn(`⚠️ Missing mappings for:`, missing);
    }

    const report: ValidationReport = {
      validated,
      missing,
      summary,
    };

    return new Response(
      JSON.stringify(report),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in symbol-validation:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
