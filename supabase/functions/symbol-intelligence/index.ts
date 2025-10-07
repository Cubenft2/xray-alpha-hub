import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CapabilityResult {
  symbol: string;
  normalized: string;
  displaySymbol?: string;
  displayName?: string;
  price_ok: boolean;
  tv_ok: boolean;
  derivs_ok: boolean;
  social_ok: boolean;
  confidence: number;
  source: string;
  coingecko_id?: string;
  tradingview_symbol?: string;
  polygon_ticker?: string;
}

interface ValidationResponse {
  symbols: CapabilityResult[];
  missing: Array<{
    symbol: string;
    normalized: string;
    reason: string;
  }>;
  cached: boolean;
}

// Use database norm_symbol function for consistent normalization
async function normalize(supabase: any, symbol: string): Promise<string> {
  const { data, error } = await supabase.rpc('norm_symbol', { raw_symbol: symbol });
  if (error) {
    console.warn('Error normalizing symbol:', error);
    return symbol.toUpperCase().trim().replace(/[\s\-\.]/g, '_');
  }
  return data as string;
}

// Calculate string similarity (Levenshtein distance ratio)
function similarity(s1: string, s2: string): number {
  const longer = s1.length > s2.length ? s1 : s2;
  const shorter = s1.length > s2.length ? s2 : s1;
  const longerLength = longer.length;
  
  if (longerLength === 0) return 1.0;
  
  const editDistance = levenshteinDistance(longer, shorter);
  return (longerLength - editDistance) / longerLength;
}

function levenshteinDistance(s1: string, s2: string): number {
  const costs: number[] = [];
  for (let i = 0; i <= s1.length; i++) {
    let lastValue = i;
    for (let j = 0; j <= s2.length; j++) {
      if (i === 0) {
        costs[j] = j;
      } else if (j > 0) {
        let newValue = costs[j - 1];
        if (s1.charAt(i - 1) !== s2.charAt(j - 1)) {
          newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
        }
        costs[j - 1] = lastValue;
        lastValue = newValue;
      }
    }
    if (i > 0) costs[s2.length] = lastValue;
  }
  return costs[s2.length];
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { symbols }: { symbols: string[] } = await req.json();
    
    if (!symbols || !Array.isArray(symbols) || symbols.length === 0) {
      throw new Error('Invalid symbols array');
    }

    console.log(`Processing ${symbols.length} symbols:`, symbols);

    // Check cache first
    const cacheKey = `sil:${symbols.sort().join(',')}`;
    const { data: cachedData } = await supabase
      .from('cache_kv')
      .select('v, expires_at')
      .eq('k', cacheKey)
      .single();

    if (cachedData && new Date(cachedData.expires_at) > new Date()) {
      console.log('Returning cached result');
      return new Response(
        JSON.stringify({ ...cachedData.v, cached: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const results: CapabilityResult[] = [];
    const missing: Array<{ symbol: string; normalized: string; reason: string }> = [];

    // Process each symbol
    for (const rawSymbol of symbols) {
      const normalized = await normalize(supabase, rawSymbol);
      console.log(`Processing: ${rawSymbol} → ${normalized}`);

      // Step 1: Check ticker_mappings (exact match on symbol or aliases)
      const { data: mapping } = await supabase
        .from('ticker_mappings')
        .select('*')
        .or(`symbol.eq.${normalized},aliases.cs.{${normalized}}`)
        .eq('is_active', true)
        .maybeSingle();

      if (mapping) {
        console.log(`✓ Found in ticker_mappings: ${mapping.symbol}`);
        
        // Check if TV is supported via tradingview_symbol or exchange pair
        let tv_ok = mapping.tradingview_supported || false;
        
        if (mapping.tradingview_symbol && mapping.tradingview_symbol !== '') {
          tv_ok = true;
        } else if (mapping.type === 'crypto' && mapping.symbol) {
          // Check if it exists in exchange_pairs (Binance or Coinbase)
          const { data: exchangePair } = await supabase
            .from('exchange_pairs')
            .select('exchange')
            .or(`symbol.eq.${mapping.symbol}USDT,symbol.eq.${mapping.symbol}USD`)
            .eq('is_active', true)
            .limit(1)
            .maybeSingle();
          
          if (exchangePair) {
            tv_ok = true;
            console.log(`  ✓ Verified on ${exchangePair.exchange}`);
          }
        }

        results.push({
          symbol: rawSymbol,
          normalized,
          displaySymbol: mapping.display_symbol || mapping.symbol,
          displayName: mapping.display_name,
          price_ok: mapping.price_supported || false,
          tv_ok,
          derivs_ok: mapping.derivs_supported || false,
          social_ok: mapping.social_supported || false,
          confidence: 1.0,
          source: 'ticker_mappings',
          coingecko_id: mapping.coingecko_id,
          tradingview_symbol: mapping.tradingview_symbol,
          polygon_ticker: mapping.polygon_ticker,
        });
        continue;
      }

      // Check if already pending - just increment seen_count
      const { data: existingPending } = await supabase
        .from('pending_ticker_mappings')
        .select('*')
        .eq('normalized_symbol', normalized)
        .eq('status', 'pending')
        .maybeSingle();

      if (existingPending) {
        console.log(`📊 Incrementing seen_count for existing pending: ${rawSymbol}`);
        await supabase
          .from('pending_ticker_mappings')
          .update({ 
            seen_count: (existingPending.seen_count || 0) + 1,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingPending.id);
        
        missing.push({
          symbol: rawSymbol,
          normalized,
          reason: `Already in pending queue (seen ${(existingPending.seen_count || 0) + 1} times)`,
        });
        continue;
      }

      // Step 2: Check poly_tickers (stocks, FX, crypto from Polygon)
      const { data: polyExact } = await supabase
        .from('poly_tickers')
        .select('*')
        .ilike('ticker', `%${normalized}%`)
        .eq('active', true)
        .limit(5);

      if (polyExact && polyExact.length > 0) {
        const polyMatch = polyExact[0];
        console.log(`  ✓ Found in poly_tickers: ${polyMatch.ticker} (${polyMatch.name})`);
        
        // Add to pending with Polygon info
        // Auto-detect type based on Polygon market
        let detectedType = 'crypto'; // default
        if (polyMatch.market === 'stocks') {
          detectedType = 'stock';
        } else if (polyMatch.market === 'fx') {
          detectedType = 'forex';
        } else if (polyMatch.market === 'crypto') {
          detectedType = 'crypto';
        }
        
        // Generate proper TradingView symbol with exchange prefix for stocks
        let tvSymbol = undefined;
        if (polyMatch.market === 'stocks') {
          if (polyMatch.primary_exchange?.includes('NASDAQ')) {
            tvSymbol = `NASDAQ:${polyMatch.ticker}`;
          } else if (polyMatch.primary_exchange?.includes('NYSE')) {
            tvSymbol = `NYSE:${polyMatch.ticker}`;
          } else {
            tvSymbol = polyMatch.ticker;
          }
        } else if (polyMatch.market === 'crypto') {
          tvSymbol = `CRYPTO:${normalized}USDT`;
        } else if (polyMatch.market === 'fx') {
          tvSymbol = `FX:${normalized}`;
        }
        
        // Auto-approve if confidence is high enough
        if (bestConfidence >= 0.85 && detectedType === 'stock') {
          // Insert directly into ticker_mappings for stocks with high confidence
          const { error: insertError } = await supabase
            .from('ticker_mappings')
            .insert({
              symbol: normalized,
              display_name: polyMatch.name,
              type: detectedType,
              polygon_ticker: polyMatch.ticker,
              tradingview_symbol: tvSymbol,
              is_active: true,
              tradingview_supported: true,
              price_supported: true,
              derivs_supported: false,
              social_supported: false,
            })
            .select()
            .single();
          
          if (!insertError) {
            console.log(`  ✓ Auto-approved stock ${normalized} with confidence 0.85+`);
            results.push({
              symbol: rawSymbol,
              normalized,
              displaySymbol: normalized,
              displayName: polyMatch.name,
              price_ok: true,
              tv_ok: true,
              derivs_ok: false,
              social_ok: false,
              confidence: 0.85,
              source: 'poly_tickers_auto',
              polygon_ticker: polyMatch.ticker,
              tradingview_symbol: tvSymbol,
            });
            continue;
          }
        }
        
        // Add to pending with proper type field
        const { error: upsertError } = await supabase
          .from('pending_ticker_mappings')
          .upsert({
            symbol: rawSymbol,
            normalized_symbol: normalized,
            display_name: polyMatch.name,
            polygon_ticker: polyMatch.ticker,
            tradingview_symbol: tvSymbol,
            confidence_score: 0.85,
            match_type: 'polygon_exact',
            status: 'pending',
            seen_count: 1,
            context: {
              polygon_ticker: polyMatch.ticker,
              polygon_market: polyMatch.market,
              polygon_type: polyMatch.type,
              detected_type: detectedType,
              added_at: new Date().toISOString(),
            },
          }, {
            onConflict: 'normalized_symbol,status',
          });
        
        if (upsertError) {
          console.error(`Failed to upsert ${rawSymbol}:`, upsertError);
        }

        missing.push({
          symbol: rawSymbol,
          normalized,
          reason: `Polygon match found (85%) - added to pending queue`,
        });
        continue;
      }

      // Step 3: Check cg_master (exact symbol match, then fuzzy name match)
      const { data: cgExact } = await supabase
        .from('cg_master')
        .select('*')
        .eq('symbol', normalized)
        .order('name')
        .limit(5);

      let bestMatch = null;
      let bestConfidence = 0.0;
      let matchType = 'no_match';

      if (cgExact && cgExact.length > 0) {
        // Exact symbol match
        bestMatch = cgExact[0];
        matchType = 'exact_symbol';
        
        // Calculate confidence using database function
        const { data: conf } = await supabase.rpc('calculate_confidence', {
          p_match_type: matchType,
          p_name_similarity: 0,
          p_has_alias: false,
          p_tv_validated: false
        });
        bestConfidence = conf || 0.70;
        
        console.log(`  ✓ Found exact symbol in cg_master: ${bestMatch.cg_id} (${bestMatch.name})`);
      } else {
        // Fuzzy name match
        const { data: cgAll } = await supabase
          .from('cg_master')
          .select('*')
          .limit(1000);

        if (cgAll) {
          for (const coin of cgAll) {
            const nameSim = similarity(rawSymbol.toLowerCase(), coin.name.toLowerCase());
            if (nameSim > bestConfidence) {
              bestConfidence = nameSim;
              bestMatch = coin;
            }
          }
          
          if (bestMatch && bestConfidence >= 0.75) {
            matchType = 'fuzzy_name';
            // Calculate confidence
            const { data: conf } = await supabase.rpc('calculate_confidence', {
              p_match_type: matchType,
              p_name_similarity: bestConfidence,
              p_has_alias: false,
              p_tv_validated: false
            });
            bestConfidence = conf || bestConfidence;
            
            console.log(`  ~ Fuzzy match: ${bestMatch.cg_id} (${bestMatch.name}) confidence=${bestConfidence.toFixed(2)}`);
          }
        }
      }

      if (bestMatch && bestConfidence >= 0.5) {
        // Check if we should auto-insert into ticker_mappings
        if (bestConfidence >= 0.9 && matchType === 'exact_symbol') {
          // High confidence - auto-insert
          const newMapping = {
            symbol: normalized,
            display_name: bestMatch.name,
            type: 'crypto',
            coingecko_id: bestMatch.cg_id,
            tradingview_symbol: `CRYPTO:${normalized}USDT`,
            price_supported: true,
            tradingview_supported: false,
            derivs_supported: false,
            social_supported: false,
            aliases: rawSymbol !== normalized ? [rawSymbol] : [],
            is_active: true,
          };

          const { data: inserted, error: insertError } = await supabase
            .from('ticker_mappings')
            .insert(newMapping)
            .select()
            .single();

          if (!insertError && inserted) {
            console.log(`  ✓ Auto-inserted into ticker_mappings with confidence ${bestConfidence.toFixed(2)}`);
            results.push({
              symbol: rawSymbol,
              normalized,
              displaySymbol: normalized,
              displayName: bestMatch.name,
              price_ok: true,
              tv_ok: false,
              derivs_ok: false,
              social_ok: false,
              confidence: bestConfidence,
              source: 'cg_master_auto',
              coingecko_id: bestMatch.cg_id,
            });
            continue;
          }
        }
        
        // Lower confidence or failed insert - add to pending with upsert
        console.log(`  → Adding to pending_ticker_mappings with confidence ${bestConfidence.toFixed(2)}`);
        const { error: upsertError2 } = await supabase
          .from('pending_ticker_mappings')
          .upsert({
            symbol: rawSymbol,
            normalized_symbol: normalized,
            display_name: bestMatch.name,
            coingecko_id: bestMatch.cg_id,
            confidence_score: bestConfidence,
            match_type: matchType,
            status: 'pending',
            seen_count: 1,
            context: {
              cg_name: bestMatch.name,
              cg_symbol: bestMatch.symbol,
              match_type: matchType,
              added_at: new Date().toISOString(),
            },
          }, {
            onConflict: 'normalized_symbol,status',
          });
        
        if (upsertError2) {
          console.error(`Failed to upsert ${rawSymbol}:`, upsertError2);
        }

        missing.push({
          symbol: rawSymbol,
          normalized,
          reason: `Match found (${(bestConfidence * 100).toFixed(0)}%) - added to pending queue`,
        });
        continue;
      }

      // Step 4: Not found anywhere - add to pending
      console.log(`  ✗ Not found: ${rawSymbol}`);
      
      const { error: upsertError3 } = await supabase
        .from('pending_ticker_mappings')
        .upsert({
          symbol: rawSymbol,
          normalized_symbol: normalized,
          confidence_score: 0.0,
          match_type: 'no_match',
          status: 'pending',
          seen_count: 1,
          context: { 
            match_type: 'none',
            added_at: new Date().toISOString(),
          },
        }, {
          onConflict: 'normalized_symbol,status',
        });
      
      if (upsertError3) {
        console.error(`Failed to upsert ${rawSymbol}:`, upsertError3);
      }

      missing.push({
        symbol: rawSymbol,
        normalized,
        reason: 'No match found in any source',
      });
    }

    const response: ValidationResponse = {
      symbols: results,
      missing,
      cached: false,
    };

    // Cache the result (120-180s TTL)
    const cacheTTL = 150; // 150 seconds
    const expiresAt = new Date(Date.now() + cacheTTL * 1000).toISOString();
    
    await supabase
      .from('cache_kv')
      .upsert({
        k: cacheKey,
        v: response,
        expires_at: expiresAt,
      });

    console.log(`Processed ${results.length} symbols, ${missing.length} missing`);

    return new Response(
      JSON.stringify(response),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Error in symbol-intelligence:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        details: error.toString(),
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
