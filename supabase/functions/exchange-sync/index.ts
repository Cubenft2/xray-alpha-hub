import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface BinanceSymbol {
  symbol: string;
  baseAsset: string;
  quoteAsset: string;
  status: string;
}

interface CoinbaseProduct {
  id: string;
  base_currency: string;
  quote_currency: string;
  status: string;
}

interface BybitSymbol {
  symbol: string;
  baseCoin: string;
  quoteCoin: string;
  status: string;
}

interface MEXCSymbol {
  symbol: string;
  baseAsset: string;
  quoteAsset: string;
  status: string;
}

interface GateIOPair {
  id: string;
  base: string;
  quote: string;
  trade_status: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('Starting exchange sync...');

    const results = {
      binance: { synced: 0, active: 0 },
      coinbase: { synced: 0, active: 0 },
      bybit: { synced: 0, active: 0 },
      mexc: { synced: 0, active: 0 },
      gateio: { synced: 0, active: 0 },
    };

    // Sync Binance
    try {
      const startTime = Date.now();
      console.log('🔄 Fetching Binance data...');
      const binanceResponse = await fetch('https://api.binance.com/api/v3/exchangeInfo');
      console.log(`📊 Binance API responded: ${binanceResponse.status} ${binanceResponse.statusText} (${Date.now() - startTime}ms)`);
      
      if (binanceResponse.ok) {
        const binanceData = await binanceResponse.json();
        const symbols: BinanceSymbol[] = binanceData.symbols || [];
        console.log(`✅ Binance: Found ${symbols.length} symbols`);
        
        const binanceRecords = symbols.map(s => ({
          exchange: 'binance',
          symbol: s.symbol,
          base_asset: s.baseAsset,
          quote_asset: s.quoteAsset,
          is_active: s.status === 'TRADING',
          synced_at: new Date().toISOString(),
        }));

        // Batch upsert
        const batchSize = 500;
        let successfulBatches = 0;
        for (let i = 0; i < binanceRecords.length; i += batchSize) {
          const batch = binanceRecords.slice(i, i + batchSize);
          const { error } = await supabase
            .from('exchange_pairs')
            .upsert(batch, { 
              onConflict: 'exchange,symbol',
              ignoreDuplicates: false 
            });
          
          if (error) {
            console.error(`❌ Error upserting Binance batch ${i}-${i+batchSize}:`, {
              message: error.message,
              details: error.details,
              hint: error.hint,
              code: error.code
            });
          } else {
            successfulBatches++;
          }
        }

        results.binance.synced = binanceRecords.length;
        results.binance.active = binanceRecords.filter(r => r.is_active).length;
        console.log(`✅ Binance complete: ${results.binance.synced} pairs, ${results.binance.active} active, ${successfulBatches} batches (${Date.now() - startTime}ms)`);
      } else {
        console.error(`❌ Binance API error: ${binanceResponse.status} ${binanceResponse.statusText}`);
        const errorText = await binanceResponse.text();
        console.error('Response body:', errorText);
      }
    } catch (error) {
      console.error('❌ Error syncing Binance:', {
        message: error.message,
        stack: error.stack,
        name: error.name
      });
    }

    // Sync Coinbase (optional)
    try {
      const coinbaseResponse = await fetch('https://api.exchange.coinbase.com/products');
      if (coinbaseResponse.ok) {
        const products: CoinbaseProduct[] = await coinbaseResponse.json();
        
        const coinbaseRecords = products.map(p => ({
          exchange: 'coinbase',
          symbol: p.id,
          base_asset: p.base_currency,
          quote_asset: p.quote_currency,
          is_active: p.status === 'online',
          synced_at: new Date().toISOString(),
        }));

        // Batch upsert
        const batchSize = 500;
        for (let i = 0; i < coinbaseRecords.length; i += batchSize) {
          const batch = coinbaseRecords.slice(i, i + batchSize);
          const { error } = await supabase
            .from('exchange_pairs')
            .upsert(batch, { 
              onConflict: 'exchange,symbol',
              ignoreDuplicates: false 
            });
          
          if (error) {
            console.error('Error upserting Coinbase batch:', error);
          }
        }

        results.coinbase.synced = coinbaseRecords.length;
        results.coinbase.active = coinbaseRecords.filter(r => r.is_active).length;
        console.log(`Coinbase: ${results.coinbase.synced} pairs, ${results.coinbase.active} active`);
      }
    } catch (error) {
      console.error('Error syncing Coinbase:', error);
    }

    // Sync Bybit
    try {
      const startTime = Date.now();
      console.log('🔄 Fetching Bybit data...');
      const bybitResponse = await fetch('https://api.bybit.com/v5/market/instruments-info?category=spot');
      console.log(`📊 Bybit API responded: ${bybitResponse.status} ${bybitResponse.statusText} (${Date.now() - startTime}ms)`);
      
      if (bybitResponse.ok) {
        const bybitData = await bybitResponse.json();
        const symbols: BybitSymbol[] = bybitData?.result?.list || [];
        console.log(`✅ Bybit: Found ${symbols.length} symbols`);
        
        const bybitRecords = symbols.map(s => ({
          exchange: 'bybit',
          symbol: s.symbol,
          base_asset: s.baseCoin,
          quote_asset: s.quoteCoin,
          is_active: s.status === 'Trading',
          synced_at: new Date().toISOString(),
        }));

        const batchSize = 500;
        let successfulBatches = 0;
        for (let i = 0; i < bybitRecords.length; i += batchSize) {
          const batch = bybitRecords.slice(i, i + batchSize);
          const { error } = await supabase
            .from('exchange_pairs')
            .upsert(batch, { 
              onConflict: 'exchange,symbol',
              ignoreDuplicates: false 
            });
          
          if (error) {
            console.error(`❌ Error upserting Bybit batch ${i}-${i+batchSize}:`, {
              message: error.message,
              details: error.details,
              hint: error.hint,
              code: error.code
            });
          } else {
            successfulBatches++;
          }
        }

        results.bybit.synced = bybitRecords.length;
        results.bybit.active = bybitRecords.filter(r => r.is_active).length;
        console.log(`✅ Bybit complete: ${results.bybit.synced} pairs, ${results.bybit.active} active, ${successfulBatches} batches (${Date.now() - startTime}ms)`);
      } else {
        console.error(`❌ Bybit API error: ${bybitResponse.status} ${bybitResponse.statusText}`);
        const errorText = await bybitResponse.text();
        console.error('Response body:', errorText);
      }
    } catch (error) {
      console.error('❌ Error syncing Bybit:', {
        message: error.message,
        stack: error.stack,
        name: error.name
      });
    }

    // Sync MEXC
    try {
      const mexcResponse = await fetch('https://api.mexc.com/api/v3/exchangeInfo');
      if (mexcResponse.ok) {
        const mexcData = await mexcResponse.json();
        const symbols: MEXCSymbol[] = mexcData?.symbols || [];
        
        const mexcRecords = symbols.map(s => ({
          exchange: 'mexc',
          symbol: s.symbol,
          base_asset: s.baseAsset,
          quote_asset: s.quoteAsset,
          is_active: s.status === 'ENABLED',
          synced_at: new Date().toISOString(),
        }));

        const batchSize = 500;
        for (let i = 0; i < mexcRecords.length; i += batchSize) {
          const batch = mexcRecords.slice(i, i + batchSize);
          const { error } = await supabase
            .from('exchange_pairs')
            .upsert(batch, { 
              onConflict: 'exchange,symbol',
              ignoreDuplicates: false 
            });
          
          if (error) {
            console.error('Error upserting MEXC batch:', error);
          }
        }

        results.mexc.synced = mexcRecords.length;
        results.mexc.active = mexcRecords.filter(r => r.is_active).length;
        console.log(`MEXC: ${results.mexc.synced} pairs, ${results.mexc.active} active`);
      }
    } catch (error) {
      console.error('Error syncing MEXC:', error);
    }

    // Sync Gate.io
    try {
      const gateioResponse = await fetch('https://api.gateio.ws/api/v4/spot/currency_pairs');
      if (gateioResponse.ok) {
        const pairs: GateIOPair[] = await gateioResponse.json();
        
        const gateioRecords = pairs.map(p => ({
          exchange: 'gateio',
          symbol: p.id,
          base_asset: p.base,
          quote_asset: p.quote,
          is_active: p.trade_status === 'tradable',
          synced_at: new Date().toISOString(),
        }));

        const batchSize = 500;
        for (let i = 0; i < gateioRecords.length; i += batchSize) {
          const batch = gateioRecords.slice(i, i + batchSize);
          const { error } = await supabase
            .from('exchange_pairs')
            .upsert(batch, { 
              onConflict: 'exchange,symbol',
              ignoreDuplicates: false 
            });
          
          if (error) {
            console.error('Error upserting Gate.io batch:', error);
          }
        }

        results.gateio.synced = gateioRecords.length;
        results.gateio.active = gateioRecords.filter(r => r.is_active).length;
        console.log(`Gate.io: ${results.gateio.synced} pairs, ${results.gateio.active} active`);
      }
    } catch (error) {
      console.error('Error syncing Gate.io:', error);
    }

    return new Response(
      JSON.stringify({
        success: true,
        results,
        timestamp: new Date().toISOString(),
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Error in exchange-sync:', error);
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
