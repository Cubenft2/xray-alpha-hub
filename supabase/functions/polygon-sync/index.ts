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
    const polygonApiKey = Deno.env.get('POLYGON_API_KEY');

    if (!polygonApiKey) {
      throw new Error('POLYGON_API_KEY not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    console.log('🚀 Starting Polygon.io reference data sync...');

    let totalSynced = 0;
    let totalFx = 0;

    // Sync Crypto tickers
    console.log('📡 Fetching Polygon crypto tickers...');
    const cryptoUrl = `https://api.polygon.io/v3/reference/tickers?market=crypto&active=true&limit=1000&apiKey=${polygonApiKey}`;
    const cryptoResponse = await fetch(cryptoUrl);
    
    if (cryptoResponse.ok) {
      const cryptoData = await cryptoResponse.json();
      const cryptoTickers = cryptoData.results || [];
      
      for (const ticker of cryptoTickers) {
        await supabase.from('poly_tickers').upsert({
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
        }, { onConflict: 'ticker' });
      }
      
      totalSynced += cryptoTickers.length;
      console.log(`✅ Synced ${cryptoTickers.length} crypto tickers`);
    }

    // Sync Stock tickers
    console.log('📡 Fetching Polygon stock tickers...');
    const stockUrl = `https://api.polygon.io/v3/reference/tickers?market=stocks&active=true&limit=1000&apiKey=${polygonApiKey}`;
    const stockResponse = await fetch(stockUrl);
    
    if (stockResponse.ok) {
      const stockData = await stockResponse.json();
      const stockTickers = stockData.results || [];
      
      for (const ticker of stockTickers) {
        await supabase.from('poly_tickers').upsert({
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
        }, { onConflict: 'ticker' });
      }
      
      totalSynced += stockTickers.length;
      console.log(`✅ Synced ${stockTickers.length} stock tickers`);
    }

    // Sync FX pairs
    console.log('📡 Fetching Polygon FX pairs...');
    const fxUrl = `https://api.polygon.io/v3/reference/tickers?market=fx&active=true&limit=1000&apiKey=${polygonApiKey}`;
    const fxResponse = await fetch(fxUrl);
    
    if (fxResponse.ok) {
      const fxData = await fxResponse.json();
      const fxTickers = fxData.results || [];
      
      for (const ticker of fxTickers) {
        // Parse FX pair (format: C:EURUSD)
        const pairMatch = ticker.ticker.match(/C:([A-Z]{3})([A-Z]{3})/);
        if (pairMatch) {
          await supabase.from('poly_fx_pairs').upsert({
            ticker: ticker.ticker,
            base_currency: pairMatch[1],
            quote_currency: pairMatch[2],
            name: ticker.name,
            active: ticker.active,
            synced_at: new Date().toISOString(),
          }, { onConflict: 'ticker' });
          
          totalFx++;
        }
        
        // Also add to poly_tickers
        await supabase.from('poly_tickers').upsert({
          ticker: ticker.ticker,
          name: ticker.name,
          market: 'fx',
          locale: ticker.locale,
          type: ticker.type,
          currency_name: ticker.currency_name,
          active: ticker.active,
          synced_at: new Date().toISOString(),
        }, { onConflict: 'ticker' });
        
        totalSynced++;
      }
      
      console.log(`✅ Synced ${fxTickers.length} FX pairs`);
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