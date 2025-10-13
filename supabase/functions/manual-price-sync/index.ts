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

    console.log('🚀 Starting manual price sync...');

    // Fetch top cryptos with either polygon_ticker or coingecko_id
    const { data: cryptos, error: fetchError } = await supabase
      .from('ticker_mappings')
      .select('symbol, display_name, polygon_ticker, coingecko_id')
      .eq('type', 'crypto')
      .eq('is_active', true)
      .or('polygon_ticker.not.is.null,coingecko_id.not.is.null')
      .limit(100);

    if (fetchError) {
      throw new Error(`Failed to fetch cryptos: ${fetchError.message}`);
    }

    console.log(`📊 Found ${cryptos?.length || 0} cryptos to sync`);

    const results: any[] = [];
    const stats = {
      polygon: 0,
      coingecko: 0,
      exchange: 0,
      failed: 0
    };

    // Process in batches to avoid rate limits
    const BATCH_SIZE = 10;
    const batches = [];
    for (let i = 0; i < cryptos.length; i += BATCH_SIZE) {
      batches.push(cryptos.slice(i, i + BATCH_SIZE));
    }

    for (let batchIdx = 0; batchIdx < batches.length; batchIdx++) {
      const batch = batches[batchIdx];
      console.log(`\n📦 Processing batch ${batchIdx + 1}/${batches.length}...`);

      const batchPromises = batch.map(async (crypto) => {
        let price = null;
        let change24h = null;
        let source = 'none';

        // Try Polygon.io first
        if (crypto.polygon_ticker && polygonKey) {
          try {
            const polygonUrl = `https://api.polygon.io/v2/aggs/ticker/${crypto.polygon_ticker}/prev?apiKey=${polygonKey}`;
            const polygonRes = await fetch(polygonUrl);
            
            if (polygonRes.ok) {
              const polygonData = await polygonRes.json();
              if (polygonData.results?.[0]) {
                const bar = polygonData.results[0];
                price = bar.c;
                change24h = bar.c && bar.o ? ((bar.c - bar.o) / bar.o) * 100 : null;
                source = 'polygon';
                console.log(`  ✅ ${crypto.symbol}: $${price} (Polygon)`);
              }
            }
          } catch (error) {
            console.log(`  ⚠️ ${crypto.symbol}: Polygon failed - ${error.message}`);
          }
        }

        // Fallback to CoinGecko
        if (!price && crypto.coingecko_id && coingeckoKey) {
          try {
            const cgUrl = `https://api.coingecko.com/api/v3/simple/price?ids=${crypto.coingecko_id}&vs_currencies=usd&include_24hr_change=true`;
            const cgRes = await fetch(cgUrl, {
              headers: { 'x-cg-demo-api-key': coingeckoKey }
            });

            if (cgRes.ok) {
              const cgData = await cgRes.json();
              if (cgData[crypto.coingecko_id]?.usd) {
                price = cgData[crypto.coingecko_id].usd;
                change24h = cgData[crypto.coingecko_id].usd_24h_change || null;
                source = 'coingecko';
                console.log(`  ✅ ${crypto.symbol}: $${price} (CoinGecko)`);
              }
            }
          } catch (error) {
            console.log(`  ⚠️ ${crypto.symbol}: CoinGecko failed - ${error.message}`);
          }
        }

        // Last resort: exchange_ticker_data
        if (!price) {
          try {
            const { data: exchangeData } = await supabase
              .from('exchange_ticker_data')
              .select('price, change_24h')
              .eq('asset_symbol', crypto.symbol)
              .order('last_updated', { ascending: false })
              .limit(1)
              .single();

            if (exchangeData?.price) {
              price = exchangeData.price;
              change24h = exchangeData.change_24h;
              source = 'exchange';
              console.log(`  ✅ ${crypto.symbol}: $${price} (Exchange cache)`);
            }
          } catch (error) {
            // Silent fail for exchange fallback
          }
        }

        if (price) {
          stats[source]++;
          return {
            ticker: crypto.symbol,
            display: crypto.display_name,
            price: parseFloat(price.toString()),
            change24h: change24h ? parseFloat(change24h.toString()) : 0,
            updated_at: new Date().toISOString()
          };
        } else {
          stats.failed++;
          console.log(`  ❌ ${crypto.symbol}: No price found`);
          return null;
        }
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults.filter(r => r !== null));

      // Rate limit pause between batches
      if (batchIdx < batches.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    // Upsert all results to live_prices
    if (results.length > 0) {
      console.log(`\n💾 Upserting ${results.length} prices to live_prices...`);
      
      const { error: upsertError } = await supabase
        .from('live_prices')
        .upsert(results, { onConflict: 'ticker' });

      if (upsertError) {
        throw new Error(`Failed to upsert prices: ${upsertError.message}`);
      }

      console.log(`✅ Successfully synced ${results.length} prices!`);
    }

    const response = {
      success: true,
      synced: results.length,
      failed: stats.failed,
      total: cryptos.length,
      sources: {
        polygon: stats.polygon,
        coingecko: stats.coingecko,
        exchange: stats.exchange
      },
      message: `Synced ${results.length} of ${cryptos.length} prices`
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
