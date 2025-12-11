import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Correct CoinGecko IDs for major tokens
const COINGECKO_ID_CORRECTIONS: Record<string, string> = {
  'BTC': 'bitcoin',
  'ETH': 'ethereum',
  'USDT': 'tether',
  'XRP': 'ripple',
  'BNB': 'binancecoin',
  'SOL': 'solana',
  'USDC': 'usd-coin',
  'DOGE': 'dogecoin',
  'ADA': 'cardano',
  'TRX': 'tron',
  'AVAX': 'avalanche-2',
  'SHIB': 'shiba-inu',
  'TON': 'the-open-network',
  'LINK': 'chainlink',
  'DOT': 'polkadot',
  'BCH': 'bitcoin-cash',
  'XLM': 'stellar',
  'SUI': 'sui',
  'HBAR': 'hedera-hashgraph',
  'UNI': 'uniswap',
  'LTC': 'litecoin',
  'PEPE': 'pepe',
  'NEAR': 'near',
  'APT': 'aptos',
  'DAI': 'dai',
  'ICP': 'internet-computer',
  'AAVE': 'aave',
  'CRO': 'crypto-com-chain',
  'RNDR': 'render-token',
  'FET': 'fetch-ai',
  'POL': 'matic-network',
  'ETC': 'ethereum-classic',
  'VET': 'vechain',
  'ARB': 'arbitrum',
  'KAS': 'kaspa',
  'OM': 'mantra-dao',
  'FIL': 'filecoin',
  'MNT': 'mantle',
  'ATOM': 'cosmos',
  'STX': 'blockstack',
  'TAO': 'bittensor',
  'OKB': 'okb',
  'THETA': 'theta-token',
  'IMX': 'immutable-x',
  'INJ': 'injective-protocol',
  'WIF': 'dogwifcoin',
  'FTM': 'fantom',
  'OP': 'optimism',
  'GRT': 'the-graph',
  'ALGO': 'algorand',
  'SEI': 'sei-network',
  'ONDO': 'ondo-finance',
  'BONK': 'bonk',
  'FLOKI': 'floki',
  'JUP': 'jupiter-exchange-solana',
  'PYTH': 'pyth-network',
  'MKR': 'maker',
  'LDO': 'lido-dao',
  'SAND': 'the-sandbox',
  'MANA': 'decentraland',
  'AXS': 'axie-infinity',
  'GALA': 'gala',
  'ENS': 'ethereum-name-service',
  'FLOW': 'flow',
  'XTZ': 'tezos',
  'EOS': 'eos',
  'NEO': 'neo',
  'IOTA': 'iota',
  'XMR': 'monero',
  'ZEC': 'zcash',
  'DASH': 'dash',
  'COMP': 'compound-governance-token',
  'SNX': 'havven',
  'CRV': 'curve-dao-token',
  'CAKE': 'pancakeswap-token',
  'SUSHI': 'sushi',
  '1INCH': '1inch',
  'YFI': 'yearn-finance',
  'BAT': 'basic-attention-token',
  'ENJ': 'enjincoin',
  'CHZ': 'chiliz',
  'EGLD': 'elrond-erd-2',
  'KAVA': 'kava',
  'ROSE': 'oasis-network',
  'ZIL': 'zilliqa',
  'QTUM': 'qtum',
  'ICX': 'icon',
  'ONE': 'harmony',
  'ZRX': '0x',
  'ANKR': 'ankr',
  'SKL': 'skale',
  'CELO': 'celo',
  'GMT': 'stepn',
  'APE': 'apecoin',
  'MASK': 'mask-network',
  'DYDX': 'dydx',
  'GMX': 'gmx',
  'BLUR': 'blur',
  'MAGIC': 'magic',
  'RDNT': 'radiant-capital',
  'PENDLE': 'pendle',
  'SSV': 'ssv-network',
  'RPL': 'rocket-pool',
  'FXS': 'frax-share',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('Starting CoinGecko ID mapping fixes...');
    
    const results = {
      updated: [] as string[],
      inserted: [] as string[],
      errors: [] as string[],
    };

    for (const [symbol, correctCgId] of Object.entries(COINGECKO_ID_CORRECTIONS)) {
      try {
        // Find the asset by symbol
        const { data: asset, error: assetError } = await supabase
          .from('assets')
          .select('id, symbol, name')
          .eq('symbol', symbol)
          .eq('type', 'crypto')
          .maybeSingle();

        if (assetError) {
          console.error(`Error finding asset ${symbol}:`, assetError);
          results.errors.push(`${symbol}: ${assetError.message}`);
          continue;
        }

        if (!asset) {
          console.log(`Asset ${symbol} not found in assets table, skipping`);
          continue;
        }

        // Check if coingecko_assets entry exists
        const { data: existingCg, error: cgError } = await supabase
          .from('coingecko_assets')
          .select('id, coingecko_id')
          .eq('asset_id', asset.id)
          .maybeSingle();

        if (cgError) {
          console.error(`Error checking coingecko_assets for ${symbol}:`, cgError);
          results.errors.push(`${symbol}: ${cgError.message}`);
          continue;
        }

        if (existingCg) {
          // Update if different
          if (existingCg.coingecko_id !== correctCgId) {
            const { error: updateError } = await supabase
              .from('coingecko_assets')
              .update({ 
                coingecko_id: correctCgId,
                last_synced: new Date().toISOString()
              })
              .eq('id', existingCg.id);

            if (updateError) {
              console.error(`Error updating ${symbol}:`, updateError);
              results.errors.push(`${symbol}: ${updateError.message}`);
            } else {
              console.log(`Updated ${symbol}: ${existingCg.coingecko_id} → ${correctCgId}`);
              results.updated.push(`${symbol}: ${existingCg.coingecko_id} → ${correctCgId}`);
            }
          } else {
            console.log(`${symbol} already has correct ID: ${correctCgId}`);
          }
        } else {
          // Insert new entry
          const { error: insertError } = await supabase
            .from('coingecko_assets')
            .insert({
              asset_id: asset.id,
              coingecko_id: correctCgId,
              last_synced: new Date().toISOString()
            });

          if (insertError) {
            console.error(`Error inserting ${symbol}:`, insertError);
            results.errors.push(`${symbol}: ${insertError.message}`);
          } else {
            console.log(`Inserted ${symbol} with CoinGecko ID: ${correctCgId}`);
            results.inserted.push(`${symbol}: ${correctCgId}`);
          }
        }
      } catch (err) {
        console.error(`Unexpected error for ${symbol}:`, err);
        results.errors.push(`${symbol}: ${err.message}`);
      }
    }

    console.log('Migration complete:', results);

    return new Response(JSON.stringify({
      success: true,
      summary: {
        updated: results.updated.length,
        inserted: results.inserted.length,
        errors: results.errors.length
      },
      details: results
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Migration failed:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
