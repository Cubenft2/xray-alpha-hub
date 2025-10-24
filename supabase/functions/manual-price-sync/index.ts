import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const polygonKey = Deno.env.get('POLYGON_API_KEY');
    const coingeckoKey = Deno.env.get('COINGECKO_API_KEY');

    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('🚀 Starting manual price sync with bulk CoinGecko...');

    // Fetch top 250 cryptos from CoinGecko Pro by market cap
    const cgUrl = `https://pro-api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=250&page=1&sparkline=false&price_change_percentage=24h`;
    
    let cgCoins = [];
    try {
      const cgRes = await fetch(cgUrl, {
        headers: { 'x-cg-pro-api-key': coingeckoKey }
      });

      if (!cgRes.ok) {
        throw new Error(`CoinGecko API error: ${cgRes.status}`);
      }

      cgCoins = await cgRes.json();
      console.log(`📊 Fetched ${cgCoins.length} coins from CoinGecko Pro`);
    } catch (error) {
      console.error(`❌ CoinGecko bulk fetch failed: ${error.message}`);
      throw new Error(`Failed to fetch from CoinGecko: ${error.message}`);
    }

    // Fetch ticker_mappings: separate fetches for ID-based and all mappings
    const { data: idMappings, error: idError } = await supabase
      .from('ticker_mappings')
      .select('symbol, display_name, coingecko_id')
      .eq('type', 'crypto')
      .eq('is_active', true)
      .not('coingecko_id', 'is', null);

    if (idError) {
      throw new Error(`Failed to fetch ID mappings: ${idError.message}`);
    }

    const { data: allMappings, error: allError } = await supabase
      .from('ticker_mappings')
      .select('symbol, display_name, display_symbol, aliases')
      .eq('type', 'crypto')
      .eq('is_active', true);

    if (allError) {
      throw new Error(`Failed to fetch all mappings: ${allError.message}`);
    }

    console.log(`📋 Loaded ${idMappings?.length || 0} mappings with coingecko_id, ${allMappings?.length || 0} total mappings`);

    // Create lookup maps for matching
    const cgIdMap = new Map(idMappings.map(m => [m.coingecko_id, m]));
    const symbolMap = new Map(allMappings.map(m => [m.symbol.toUpperCase(), m]));
    const displaySymbolMap = new Map(
      allMappings.filter(m => m.display_symbol).map(m => [m.display_symbol!.toUpperCase(), m])
    );
    
    // Build alias map: alias -> ticker_mapping
    const aliasMap = new Map();
    for (const m of allMappings) {
      if (m.aliases && Array.isArray(m.aliases)) {
        for (const alias of m.aliases) {
          aliasMap.set(alias.toUpperCase(), m);
        }
      }
    }

    // Match CoinGecko coins to our mappings with fallbacks and metadata
    type MatchPrecedence = 'coingecko_id' | 'forced_anchor' | 'alias' | 'symbol';
    const precedenceOrder: Record<MatchPrecedence, number> = {
      'coingecko_id': 4,
      'forced_anchor': 3,
      'alias': 2,
      'symbol': 1
    };

    const matchStats = { coingecko_id: 0, forced_anchor: 0, alias: 0, symbol: 0 };
    
    const candidateResults = cgCoins
      .map(coin => {
        let mapping = null;
        let matchedBy: MatchPrecedence | '' = '';
        
        // 1. Try coingecko_id match (primary)
        mapping = cgIdMap.get(coin.id);
        if (mapping) {
          matchedBy = 'coingecko_id';
        }
        
        // 2. Force-match anchors (BTC/ETH) by symbol if not matched
        if (!mapping && (coin.id === 'bitcoin' || coin.id === 'ethereum')) {
          const anchorSymbol = coin.id === 'bitcoin' ? 'BTC' : 'ETH';
          mapping = symbolMap.get(anchorSymbol) || displaySymbolMap.get(anchorSymbol) || aliasMap.get(anchorSymbol);
          if (mapping) {
            matchedBy = 'forced_anchor';
            console.log(`  🔒 Force-matched ${coin.id} -> ${mapping.symbol} (anchor guarantee)`);
          }
        }
        
        // 3. Try symbol match (normalized)
        if (!mapping) {
          const normalizedSymbol = coin.symbol.toUpperCase();
          mapping = symbolMap.get(normalizedSymbol) || displaySymbolMap.get(normalizedSymbol);
          if (mapping) {
            matchedBy = 'symbol';
          }
        }
        
        // 4. Try alias match
        if (!mapping) {
          const normalizedSymbol = coin.symbol.toUpperCase();
          mapping = aliasMap.get(normalizedSymbol);
          if (mapping) {
            matchedBy = 'alias';
          }
        }
        
        if (!mapping) {
          console.log(`  ⚠️ No mapping found for CoinGecko ID: ${coin.id} (${coin.symbol})`);
          return null;
        }

        if (matchedBy) matchStats[matchedBy]++;
        console.log(`  ✅ ${mapping.symbol}: $${coin.current_price} (${coin.price_change_percentage_24h?.toFixed(2)}%) [${matchedBy}]`);

        // Use polygon_ticker if available, fallback to symbol
        const tickerKey = mapping.polygon_ticker || mapping.symbol;
        
        return {
          ticker: tickerKey,
          display: mapping.display_name,
          price: coin.current_price,
          change24h: coin.price_change_percentage_24h || 0,
          updated_at: new Date().toISOString(),
          matchedBy
        };
      })
      .filter(r => r !== null);

    console.log(`\n✨ Matched ${candidateResults.length} coins before deduplication`);

    // Deduplicate by ticker, keeping best match based on precedence
    const dedupeMap = new Map<string, typeof candidateResults[0]>();
    for (const candidate of candidateResults) {
      const existing = dedupeMap.get(candidate.ticker);
      if (!existing) {
        dedupeMap.set(candidate.ticker, candidate);
      } else {
        const existingPrecedence = precedenceOrder[existing.matchedBy as MatchPrecedence] || 0;
        const candidatePrecedence = precedenceOrder[candidate.matchedBy as MatchPrecedence] || 0;
        if (candidatePrecedence > existingPrecedence) {
          dedupeMap.set(candidate.ticker, candidate);
        }
      }
    }

    const results = Array.from(dedupeMap.values()).map(({ ticker, display, price, change24h, updated_at }) => ({
      ticker,
      display,
      price,
      change24h,
      updated_at
    }));

    const duplicatesRemoved = candidateResults.length - results.length;
    console.log(`🔍 Deduplicated: ${results.length} unique tickers (removed ${duplicatesRemoved} duplicates)`);
    console.log(`📊 Match breakdown: ${JSON.stringify(matchStats)}`);

    // Upsert all results to live_prices with defensive retry
    if (results.length > 0) {
      console.log(`\n💾 Upserting ${results.length} prices to live_prices...`);
      
      try {
        const { error: upsertError } = await supabase
          .from('live_prices')
          .upsert(results, { onConflict: 'ticker' });

        if (upsertError) {
          throw new Error(`Failed to upsert prices: ${upsertError.message}`);
        }

        console.log(`✅ Successfully synced ${results.length} prices!`);
      } catch (error: any) {
        if (error.message?.includes('ON CONFLICT DO UPDATE')) {
          console.error(`⚠️ Upsert conflict detected, retrying with fresh dedupe...`);
          // Defensive: re-dedupe and retry once
          const uniqueResults = Array.from(new Map(results.map(r => [r.ticker, r])).values());
          const { error: retryError } = await supabase
            .from('live_prices')
            .upsert(uniqueResults, { onConflict: 'ticker' });
          
          if (retryError) {
            throw new Error(`Retry failed: ${retryError.message}`);
          }
          console.log(`✅ Retry successful: synced ${uniqueResults.length} prices!`);
        } else {
          throw error;
        }
      }
    }

    const response = {
      success: true,
      synced: results.length,
      total_from_coingecko: cgCoins.length,
      matched_before_dedupe: candidateResults.length,
      matched_after_dedupe: results.length,
      duplicates_removed: duplicatesRemoved,
      match_breakdown: matchStats,
      source: 'coingecko-bulk',
      message: `Synced ${results.length} prices from CoinGecko top ${cgCoins.length} by market cap`
    };

    console.log('\n📊 Final stats:', response);

    return new Response(
      JSON.stringify(response),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('❌ Error in manual-price-sync:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message,
        details: error.stack 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
