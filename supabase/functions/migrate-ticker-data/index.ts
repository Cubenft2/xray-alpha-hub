import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const results: Record<string, number | string> = {};

    // Step 1: Create assets from ticker_mappings
    console.log('Step 1: Migrating assets...');
    
    // Fetch ALL ticker_mappings in batches (Supabase has 1000 row limit per query)
    const tickerMappings: any[] = [];
    let offset = 0;
    const batchSize = 1000;
    
    while (true) {
      const { data, error: fetchError } = await supabase
        .from('ticker_mappings')
        .select('symbol, display_name, type, created_at, polygon_ticker, coingecko_id, tradingview_symbol, tradingview_supported, dex_address, dex_chain')
        .eq('is_active', true)
        .range(offset, offset + batchSize - 1);
      
      if (fetchError) throw new Error(`Failed to fetch ticker_mappings: ${fetchError.message}`);
      if (!data || data.length === 0) break;
      
      tickerMappings.push(...data);
      console.log(`Fetched ${tickerMappings.length} ticker_mappings so far...`);
      
      if (data.length < batchSize) break;
      offset += batchSize;
    }
    
    console.log(`Total ticker_mappings fetched: ${tickerMappings.length}`);

    // Deduplicate by symbol + type
    const uniqueAssets = new Map<string, any>();
    for (const t of tickerMappings || []) {
      const key = `${t.symbol}:${t.type}`;
      if (!uniqueAssets.has(key)) {
        uniqueAssets.set(key, {
          symbol: t.symbol,
          name: t.display_name || t.symbol,
          type: t.type,
          created_at: t.created_at || new Date().toISOString()
        });
      }
    }

    const assetsToInsert = Array.from(uniqueAssets.values());
    console.log(`Inserting ${assetsToInsert.length} unique assets...`);

    // Insert in batches of 500
    let assetsInserted = 0;
    for (let i = 0; i < assetsToInsert.length; i += 500) {
      const batch = assetsToInsert.slice(i, i + 500);
      const { error: insertError } = await supabase
        .from('assets')
        .upsert(batch, { onConflict: 'symbol,type', ignoreDuplicates: true });
      
      if (insertError) {
        console.error(`Batch ${i / 500} error:`, insertError.message);
      } else {
        assetsInserted += batch.length;
      }
    }
    results.assets_inserted = assetsInserted;

    // Fetch all assets to get their IDs (paginated)
    const allAssets: any[] = [];
    offset = 0;
    
    while (true) {
      const { data, error: assetsError } = await supabase
        .from('assets')
        .select('id, symbol, type')
        .range(offset, offset + batchSize - 1);
      
      if (assetsError) throw new Error(`Failed to fetch assets: ${assetsError.message}`);
      if (!data || data.length === 0) break;
      
      allAssets.push(...data);
      if (data.length < batchSize) break;
      offset += batchSize;
    }
    
    console.log(`Total assets fetched: ${allAssets.length}`);

    // Create lookup map
    const assetLookup = new Map<string, string>();
    for (const a of allAssets || []) {
      assetLookup.set(`${a.symbol}:${a.type}`, a.id);
    }

    // Step 2: Populate polygon_assets
    console.log('Step 2: Migrating polygon_assets...');
    const polygonRecords: any[] = [];
    for (const t of tickerMappings || []) {
      if (!t.polygon_ticker) continue;
      
      // Validate polygon ticker format
      const isCryptoValid = t.type === 'crypto' && /^X:[A-Z0-9]{2,10}USD$/.test(t.polygon_ticker);
      const isStockValid = t.type === 'stock' && /^[A-Z]{1,5}$/.test(t.polygon_ticker);
      
      if (!isCryptoValid && !isStockValid) continue;
      
      const assetId = assetLookup.get(`${t.symbol}:${t.type}`);
      if (assetId) {
        polygonRecords.push({
          asset_id: assetId,
          polygon_ticker: t.polygon_ticker,
          market: t.type === 'crypto' ? 'crypto' : 'stocks',
          is_active: true
        });
      }
    }

    let polygonInserted = 0;
    for (let i = 0; i < polygonRecords.length; i += 500) {
      const batch = polygonRecords.slice(i, i + 500);
      const { error } = await supabase
        .from('polygon_assets')
        .upsert(batch, { onConflict: 'asset_id', ignoreDuplicates: true });
      if (!error) polygonInserted += batch.length;
    }
    results.polygon_assets_inserted = polygonInserted;

    // Step 3: Populate coingecko_assets
    console.log('Step 3: Migrating coingecko_assets...');
    const coingeckoRecords: any[] = [];
    for (const t of tickerMappings || []) {
      if (!t.coingecko_id) continue;
      const assetId = assetLookup.get(`${t.symbol}:${t.type}`);
      if (assetId) {
        coingeckoRecords.push({
          asset_id: assetId,
          coingecko_id: t.coingecko_id
        });
      }
    }

    let coingeckoInserted = 0;
    for (let i = 0; i < coingeckoRecords.length; i += 500) {
      const batch = coingeckoRecords.slice(i, i + 500);
      const { error } = await supabase
        .from('coingecko_assets')
        .upsert(batch, { onConflict: 'asset_id', ignoreDuplicates: true });
      if (!error) coingeckoInserted += batch.length;
    }
    results.coingecko_assets_inserted = coingeckoInserted;

    // Step 4: Populate tradingview_assets
    console.log('Step 4: Migrating tradingview_assets...');
    const tradingviewRecords: any[] = [];
    for (const t of tickerMappings || []) {
      if (!t.tradingview_symbol) continue;
      const assetId = assetLookup.get(`${t.symbol}:${t.type}`);
      if (assetId) {
        tradingviewRecords.push({
          asset_id: assetId,
          tradingview_symbol: t.tradingview_symbol,
          is_supported: t.tradingview_supported ?? true
        });
      }
    }

    let tradingviewInserted = 0;
    for (let i = 0; i < tradingviewRecords.length; i += 500) {
      const batch = tradingviewRecords.slice(i, i + 500);
      const { error } = await supabase
        .from('tradingview_assets')
        .upsert(batch, { onConflict: 'asset_id', ignoreDuplicates: true });
      if (!error) tradingviewInserted += batch.length;
    }
    results.tradingview_assets_inserted = tradingviewInserted;

    // Step 5: Populate token_contracts
    console.log('Step 5: Migrating token_contracts...');
    const contractRecords: any[] = [];
    for (const t of tickerMappings || []) {
      if (!t.dex_address || !t.dex_chain) continue;
      const assetId = assetLookup.get(`${t.symbol}:${t.type}`);
      if (assetId) {
        contractRecords.push({
          asset_id: assetId,
          chain: t.dex_chain,
          contract_address: t.dex_address,
          is_primary: true
        });
      }
    }

    let contractsInserted = 0;
    console.log(`Preparing to insert ${contractRecords.length} token contracts...`);
    
    for (let i = 0; i < contractRecords.length; i += 500) {
      const batch = contractRecords.slice(i, i + 500);
      const { error } = await supabase
        .from('token_contracts')
        .upsert(batch, { onConflict: 'chain,contract_address', ignoreDuplicates: true });
      if (error) {
        console.error(`Token contracts batch ${i / 500} error:`, error.message);
      } else {
        contractsInserted += batch.length;
      }
    }
    results.token_contracts_inserted = contractsInserted;

    console.log('Migration complete!', results);

    return new Response(JSON.stringify({
      success: true,
      message: 'Data migration completed successfully',
      results
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Migration error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
