import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Parse Polygon crypto ticker to canonical symbol and quote currency
function parsePolygonCryptoTicker(ticker: string): { canonical: string; quote: string } {
  const raw = ticker.replace('X:', '');
  const quotes = ['USDT', 'USDC', 'USD', 'EUR', 'GBP', 'AUD', 'JPY', 'BTC', 'ETH'];
  for (const quote of quotes) {
    if (raw.endsWith(quote)) {
      return { 
        canonical: raw.slice(0, -quote.length), 
        quote 
      };
    }
  }
  return { canonical: raw, quote: 'UNKNOWN' };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  console.log('[sync-polygon-crypto-reference] Starting reference sync...');

  try {
    const POLYGON_API_KEY = Deno.env.get('POLYGON_API_KEY');
    if (!POLYGON_API_KEY) {
      throw new Error('POLYGON_API_KEY not configured');
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Fetch all crypto reference tickers with pagination
    const allTickers: any[] = [];
    let nextUrl: string | null = `https://api.polygon.io/v3/reference/tickers?market=crypto&active=true&limit=1000&apiKey=${POLYGON_API_KEY}`;
    let pageCount = 0;

    while (nextUrl) {
      pageCount++;
      console.log(`[sync-polygon-crypto-reference] Fetching page ${pageCount}...`);
      
      const response = await fetch(nextUrl);
      if (!response.ok) {
        throw new Error(`Polygon API error: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (data.results && Array.isArray(data.results)) {
        allTickers.push(...data.results);
        console.log(`[sync-polygon-crypto-reference] Page ${pageCount}: ${data.results.length} tickers (total: ${allTickers.length})`);
      }
      
      // Check for next page
      nextUrl = data.next_url ? `${data.next_url}&apiKey=${POLYGON_API_KEY}` : null;
      
      // Rate limiting delay
      if (nextUrl) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }

    console.log(`[sync-polygon-crypto-reference] Fetched ${allTickers.length} total reference tickers`);

    // Group tickers by canonical symbol
    const symbolMap = new Map<string, {
      name: string | null;
      tickers: string[];
    }>();

    for (const ticker of allTickers) {
      const { canonical } = parsePolygonCryptoTicker(ticker.ticker);
      
      if (!canonical || canonical.length === 0) continue;
      
      if (!symbolMap.has(canonical)) {
        symbolMap.set(canonical, {
          name: ticker.name || ticker.base_currency_name || null,
          tickers: []
        });
      }
      
      symbolMap.get(canonical)!.tickers.push(ticker.ticker);
    }

    console.log(`[sync-polygon-crypto-reference] Grouped into ${symbolMap.size} canonical symbols`);

    // Prepare upsert records
    const records = Array.from(symbolMap.entries()).map(([canonical, data]) => {
      // Sort tickers to prefer USD pairs as primary
      const sortedTickers = data.tickers.sort((a, b) => {
        const { quote: quoteA } = parsePolygonCryptoTicker(a);
        const { quote: quoteB } = parsePolygonCryptoTicker(b);
        const priority = ['USD', 'USDT', 'USDC', 'EUR', 'GBP', 'BTC', 'ETH'];
        return priority.indexOf(quoteA) - priority.indexOf(quoteB);
      });

      return {
        canonical_symbol: canonical,
        name: data.name,
        polygon_tickers: sortedTickers,
        primary_ticker: sortedTickers[0] || null,
        in_reference: true,
        reference_synced_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
    });

    // Batch upsert in chunks of 500
    const batchSize = 500;
    let upsertedCount = 0;
    
    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);
      
      const { error } = await supabase
        .from('polygon_crypto_cards')
        .upsert(batch, { 
          onConflict: 'canonical_symbol',
          ignoreDuplicates: false 
        });
      
      if (error) {
        console.error(`[sync-polygon-crypto-reference] Batch upsert error:`, error);
        throw error;
      }
      
      upsertedCount += batch.length;
      console.log(`[sync-polygon-crypto-reference] Upserted ${upsertedCount}/${records.length} records`);
    }

    const duration = Date.now() - startTime;
    const result = {
      success: true,
      referenceTickers: allTickers.length,
      canonicalSymbols: symbolMap.size,
      upsertedRecords: upsertedCount,
      pages: pageCount,
      durationMs: duration
    };

    console.log(`[sync-polygon-crypto-reference] Complete:`, result);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[sync-polygon-crypto-reference] Error:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
