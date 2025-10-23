import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CoinGeckoListItem {
  id: string;
  symbol: string;
  name: string;
  platforms?: Record<string, string>;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify admin authentication
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid authentication' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

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

    console.log(`Admin user ${user.email} authenticated for coingecko-sync`);
    
    const coingeckoApiKey = Deno.env.get('COINGECKO_API_KEY');

    console.log('Starting CoinGecko sync...');

    // Fetch coins list from CoinGecko with platform data
    const cgUrl = coingeckoApiKey 
      ? `https://pro-api.coingecko.com/api/v3/coins/list?include_platform=true&x_cg_pro_api_key=${coingeckoApiKey}`
      : 'https://api.coingecko.com/api/v3/coins/list?include_platform=true';

    const response = await fetch(cgUrl);
    
    if (!response.ok) {
      throw new Error(`CoinGecko API error: ${response.status} ${response.statusText}`);
    }

    const coins: CoinGeckoListItem[] = await response.json();
    console.log(`Fetched ${coins.length} coins from CoinGecko`);

    // Batch upsert into cg_master
    const batchSize = 500;
    let processed = 0;
    let inserted = 0;
    let updated = 0;

    for (let i = 0; i < coins.length; i += batchSize) {
      const batch = coins.slice(i, i + batchSize);
      
      const records = batch.map(coin => ({
        cg_id: coin.id,
        symbol: coin.symbol.toUpperCase(),
        name: coin.name,
        platforms: coin.platforms || {},
        synced_at: new Date().toISOString(),
      }));

      // Upsert batch
      const { error } = await supabase
        .from('cg_master')
        .upsert(records, { 
          onConflict: 'cg_id',
          ignoreDuplicates: false 
        });

      if (error) {
        console.error(`Error upserting batch ${i}-${i + batch.length}:`, error);
      } else {
        processed += batch.length;
        console.log(`Processed ${processed}/${coins.length} coins`);
      }
    }

    // Count total records
    const { count: totalCount } = await supabase
      .from('cg_master')
      .select('*', { count: 'exact', head: true });

    console.log(`Sync complete. Total coins in cg_master: ${totalCount}`);

    return new Response(
      JSON.stringify({
        success: true,
        synced: coins.length,
        totalInDb: totalCount,
        timestamp: new Date().toISOString(),
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Error in coingecko-sync:', error);
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
