import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

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
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check admin authentication
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid authentication' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Verify admin role
    const { data: roleData, error: roleError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle();

    if (roleError || !roleData) {
      return new Response(JSON.stringify({ error: 'Forbidden - Admin access required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const polygonApiKey = Deno.env.get('POLYGON_API_KEY');

    if (!polygonApiKey) {
      throw new Error('POLYGON_API_KEY not configured');
    }

    console.log('🚀 Starting Polygon.io reference data sync with pagination...');

    let totalSynced = 0;
    let totalFx = 0;

    // Helper function to fetch all pages
    async function fetchAllPages(baseUrl: string, market: string): Promise<any[]> {
      const allResults: any[] = [];
      let nextUrl: string | null = `${baseUrl}&limit=1000`;
      
      while (nextUrl) {
        console.log(`📡 Fetching ${market} page...`);
        const response = await fetch(nextUrl);
        
        if (!response.ok) {
          console.warn(`⚠️ ${market} API returned ${response.status}`);
          break;
        }
        
        const data = await response.json();
        
        if (data.results && data.results.length > 0) {
          allResults.push(...data.results);
          console.log(`   Fetched ${data.results.length} ${market} tickers (total: ${allResults.length})`);
        }
        
        // Check for next page
        nextUrl = data.next_url ? `${data.next_url}&apiKey=${polygonApiKey}` : null;
        
        // Rate limiting: wait 200ms between requests
        if (nextUrl) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }
      
      return allResults;
    }

    // Sync Crypto tickers with pagination
    console.log('📊 Syncing crypto tickers...');
    const cryptoTickers = await fetchAllPages(
      `https://api.polygon.io/v3/reference/tickers?market=crypto&active=true&apiKey=${polygonApiKey}`,
      'crypto'
    );
    
    if (cryptoTickers.length > 0) {
      const cryptoRecords = cryptoTickers.map(ticker => ({
        ticker: ticker.ticker,
        name: ticker.name,
        market: 'crypto',
        locale: ticker.locale,
        primary_exchange: ticker.primary_exchange,
        type: ticker.type,
        currency_name: ticker.currency_name,
        base_currency_symbol: ticker.base_currency_symbol,
        base_currency_name: ticker.base_currency_name,
        active: ticker.active,
        delisted_utc: ticker.delisted_utc,
        last_updated_utc: ticker.last_updated_utc,
        synced_at: new Date().toISOString(),
      }));

      // Batch upsert in chunks of 1000
      const chunkSize = 1000;
      for (let i = 0; i < cryptoRecords.length; i += chunkSize) {
        const chunk = cryptoRecords.slice(i, i + chunkSize);
        const { error: cryptoError } = await supabase
          .from('poly_tickers')
          .upsert(chunk, { onConflict: 'ticker' });
        
        if (cryptoError) {
          console.error('Error syncing crypto batch:', cryptoError);
        }
      }
      
      totalSynced += cryptoTickers.length;
      console.log(`✅ Synced ${cryptoTickers.length} crypto tickers`);
    }

    // Sync Stock tickers with pagination
    console.log('📊 Syncing stock tickers...');
    const stockTickers = await fetchAllPages(
      `https://api.polygon.io/v3/reference/tickers?market=stocks&active=true&apiKey=${polygonApiKey}`,
      'stocks'
    );
    
    if (stockTickers.length > 0) {
      const stockRecords = stockTickers.map(ticker => ({
        ticker: ticker.ticker,
        name: ticker.name,
        market: 'stocks',
        locale: ticker.locale,
        primary_exchange: ticker.primary_exchange,
        type: ticker.type,
        currency_name: ticker.currency_name,
        active: ticker.active,
        delisted_utc: ticker.delisted_utc,
        last_updated_utc: ticker.last_updated_utc,
        synced_at: new Date().toISOString(),
      }));

      // Batch upsert in chunks of 1000
      const chunkSize = 1000;
      for (let i = 0; i < stockRecords.length; i += chunkSize) {
        const chunk = stockRecords.slice(i, i + chunkSize);
        const { error: stockError } = await supabase
          .from('poly_tickers')
          .upsert(chunk, { onConflict: 'ticker' });
        
        if (stockError) {
          console.error('Error syncing stock batch:', stockError);
        }
      }
      
      totalSynced += stockTickers.length;
      console.log(`✅ Synced ${stockTickers.length} stock tickers`);
    }

    // Sync FX pairs with pagination
    console.log('📊 Syncing FX pairs...');
    const fxTickers = await fetchAllPages(
      `https://api.polygon.io/v3/reference/tickers?market=fx&active=true&apiKey=${polygonApiKey}`,
      'fx'
    );
    
    if (fxTickers.length > 0) {
      const fxPairRecords = [];
      const fxTickerRecords = [];
      
      for (const ticker of fxTickers) {
        // Parse FX pair (format: C:EURUSD)
        const pairMatch = ticker.ticker.match(/C:([A-Z]{3})([A-Z]{3})/);
        if (pairMatch) {
          fxPairRecords.push({
            ticker: ticker.ticker,
            base_currency: pairMatch[1],
            quote_currency: pairMatch[2],
            name: ticker.name,
            active: ticker.active,
            synced_at: new Date().toISOString(),
          });
        }
        
        fxTickerRecords.push({
          ticker: ticker.ticker,
          name: ticker.name,
          market: 'fx',
          locale: ticker.locale,
          type: ticker.type,
          currency_name: ticker.currency_name,
          active: ticker.active,
          synced_at: new Date().toISOString(),
        });
      }
      
      // Batch insert FX pairs
      if (fxPairRecords.length > 0) {
        const chunkSize = 1000;
        for (let i = 0; i < fxPairRecords.length; i += chunkSize) {
          const chunk = fxPairRecords.slice(i, i + chunkSize);
          const { error: fxPairError } = await supabase
            .from('poly_fx_pairs')
            .upsert(chunk, { onConflict: 'ticker' });
          
          if (fxPairError) {
            console.error('Error syncing FX pair batch:', fxPairError);
          }
        }
        totalFx = fxPairRecords.length;
      }
      
      // Batch insert FX tickers
      const chunkSize = 1000;
      for (let i = 0; i < fxTickerRecords.length; i += chunkSize) {
        const chunk = fxTickerRecords.slice(i, i + chunkSize);
        const { error: fxTickerError } = await supabase
          .from('poly_tickers')
          .upsert(chunk, { onConflict: 'ticker' });
        
        if (fxTickerError) {
          console.error('Error syncing FX ticker batch:', fxTickerError);
        }
      }
      
      totalSynced += fxTickerRecords.length;
      console.log(`✅ Synced ${fxTickerRecords.length} FX tickers and ${fxPairRecords.length} FX pairs`);
    }

    console.log(`✅ Polygon sync complete: ${totalSynced} total tickers, ${totalFx} FX pairs`);

    return new Response(
      JSON.stringify({
        success: true,
        synced: totalSynced,
        fx_pairs: totalFx,
        timestamp: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('❌ Polygon sync error:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        details: error.toString(),
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});