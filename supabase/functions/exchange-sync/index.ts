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
    };

    // Sync Binance
    try {
      const binanceResponse = await fetch('https://api.binance.com/api/v3/exchangeInfo');
      if (binanceResponse.ok) {
        const binanceData = await binanceResponse.json();
        const symbols: BinanceSymbol[] = binanceData.symbols || [];
        
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
        for (let i = 0; i < binanceRecords.length; i += batchSize) {
          const batch = binanceRecords.slice(i, i + batchSize);
          const { error } = await supabase
            .from('exchange_pairs')
            .upsert(batch, { 
              onConflict: 'exchange,symbol',
              ignoreDuplicates: false 
            });
          
          if (error) {
            console.error('Error upserting Binance batch:', error);
          }
        }

        results.binance.synced = binanceRecords.length;
        results.binance.active = binanceRecords.filter(r => r.is_active).length;
        console.log(`Binance: ${results.binance.synced} pairs, ${results.binance.active} active`);
      }
    } catch (error) {
      console.error('Error syncing Binance:', error);
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
