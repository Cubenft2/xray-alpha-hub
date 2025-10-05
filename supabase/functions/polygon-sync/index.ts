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
      
      // Batch insert crypto tickers
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

        const { error: cryptoError } = await supabase
          .from('poly_tickers')
          .upsert(cryptoRecords, { onConflict: 'ticker' });
        
        if (cryptoError) {
          console.error('Error syncing crypto tickers:', cryptoError);
        } else {
          totalSynced += cryptoTickers.length;
          console.log(`✅ Synced ${cryptoTickers.length} crypto tickers`);
        }
      }
    } else {
      console.warn(`⚠️ Crypto API returned ${cryptoResponse.status}`);
    }

    // Sync Stock tickers
    console.log('📡 Fetching Polygon stock tickers...');
    const stockUrl = `https://api.polygon.io/v3/reference/tickers?market=stocks&active=true&limit=1000&apiKey=${polygonApiKey}`;
    const stockResponse = await fetch(stockUrl);
    
    if (stockResponse.ok) {
      const stockData = await stockResponse.json();
      const stockTickers = stockData.results || [];
      
      // Batch insert stock tickers
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

        const { error: stockError } = await supabase
          .from('poly_tickers')
          .upsert(stockRecords, { onConflict: 'ticker' });
        
        if (stockError) {
          console.error('Error syncing stock tickers:', stockError);
        } else {
          totalSynced += stockTickers.length;
          console.log(`✅ Synced ${stockTickers.length} stock tickers`);
        }
      }
    } else {
      console.warn(`⚠️ Stock API returned ${stockResponse.status}`);
    }

    // Sync FX pairs
    console.log('📡 Fetching Polygon FX pairs...');
    const fxUrl = `https://api.polygon.io/v3/reference/tickers?market=fx&active=true&limit=1000&apiKey=${polygonApiKey}`;
    const fxResponse = await fetch(fxUrl);
    
    if (fxResponse.ok) {
      const fxData = await fxResponse.json();
      const fxTickers = fxData.results || [];
      
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
          const { error: fxPairError } = await supabase
            .from('poly_fx_pairs')
            .upsert(fxPairRecords, { onConflict: 'ticker' });
          
          if (fxPairError) {
            console.error('Error syncing FX pairs:', fxPairError);
          } else {
            totalFx = fxPairRecords.length;
          }
        }
        
        // Batch insert FX tickers
        const { error: fxTickerError } = await supabase
          .from('poly_tickers')
          .upsert(fxTickerRecords, { onConflict: 'ticker' });
        
        if (fxTickerError) {
          console.error('Error syncing FX tickers:', fxTickerError);
        } else {
          totalSynced += fxTickerRecords.length;
          console.log(`✅ Synced ${fxTickerRecords.length} FX pairs`);
        }
      }
    } else {
      console.warn(`⚠️ FX API returned ${fxResponse.status}`);
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