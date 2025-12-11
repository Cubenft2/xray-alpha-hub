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
  'MATIC': 'matic-network',
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
  'POPCAT': 'popcat',
  'AERO': 'aerodrome-finance',
  'VIRTUAL': 'virtual-protocol',
  'FARTCOIN': 'fartcoin',
  'AI16Z': 'ai16z',
  'AIXBT': 'aixbt',
  'BOME': 'book-of-meme',
  'MEW': 'cat-in-a-dogs-world',
  'ZRO': 'layerzero',
  'MOVE': 'movement',
  'BRETT': 'brett',
  'NOT': 'notcoin',
  'W': 'wormhole',
  'JASMY': 'jasmycoin',
  'MEME': 'memecoin',
  'WLD': 'worldcoin-wld',
  'STRK': 'starknet',
  'TIA': 'celestia',
  'ORDI': 'ordinals',
  'BEAM': 'beam-2',
  'SUPER': 'supercoin',
  'TURBO': 'turbo',
  'CORE': 'coredaoorg',
  'CFX': 'conflux-token',
  'OSMO': 'osmosis',
  'AKT': 'akash-network',
  'MINA': 'mina-protocol',
  'DEXE': 'dexe',
  'ACH': 'alchemy-pay',
  'RSR': 'reserve-rights-token',
  'LUNC': 'terra-luna',
  'LUNA': 'terra-luna-2',
  'CKB': 'nervos-network',
  'SAFE': 'safe',
  'ZK': 'zksync',
  'IO': 'io',
  'ETHFI': 'ether-fi',
  'ENA': 'ethena',
};

// Major tokens that need Polygon ticker mappings
const POLYGON_TICKER_ADDITIONS: Record<string, { name: string, type: string }> = {
  'TRX': { name: 'Tron', type: 'crypto' },
  'AAVE': { name: 'Aave', type: 'crypto' },
  'MKR': { name: 'Maker', type: 'crypto' },
  'INJ': { name: 'Injective', type: 'crypto' },
  'IMX': { name: 'Immutable X', type: 'crypto' },
  'SEI': { name: 'Sei', type: 'crypto' },
  'JUP': { name: 'Jupiter', type: 'crypto' },
  'PYTH': { name: 'Pyth Network', type: 'crypto' },
  'PENDLE': { name: 'Pendle', type: 'crypto' },
  'VIRTUAL': { name: 'Virtuals Protocol', type: 'crypto' },
  'FARTCOIN': { name: 'Fartcoin', type: 'crypto' },
  'MOVE': { name: 'Movement', type: 'crypto' },
  'TAO': { name: 'Bittensor', type: 'crypto' },
  'ONDO': { name: 'Ondo Finance', type: 'crypto' },
  'THETA': { name: 'Theta Network', type: 'crypto' },
  'FTM': { name: 'Fantom', type: 'crypto' },
  'ALGO': { name: 'Algorand', type: 'crypto' },
  'FLOW': { name: 'Flow', type: 'crypto' },
  'XTZ': { name: 'Tezos', type: 'crypto' },
  'EOS': { name: 'EOS', type: 'crypto' },
  'NEO': { name: 'Neo', type: 'crypto' },
  'IOTA': { name: 'IOTA', type: 'crypto' },
  'XMR': { name: 'Monero', type: 'crypto' },
  'ZEC': { name: 'Zcash', type: 'crypto' },
  'DASH': { name: 'Dash', type: 'crypto' },
  'EGLD': { name: 'MultiversX', type: 'crypto' },
  'KAVA': { name: 'Kava', type: 'crypto' },
  'ROSE': { name: 'Oasis Network', type: 'crypto' },
  'ZIL': { name: 'Zilliqa', type: 'crypto' },
  'QTUM': { name: 'Qtum', type: 'crypto' },
  'ICX': { name: 'ICON', type: 'crypto' },
  'ONE': { name: 'Harmony', type: 'crypto' },
  'CELO': { name: 'Celo', type: 'crypto' },
  'STRK': { name: 'Starknet', type: 'crypto' },
  'TIA': { name: 'Celestia', type: 'crypto' },
  'W': { name: 'Wormhole', type: 'crypto' },
  'WLD': { name: 'Worldcoin', type: 'crypto' },
  'NOT': { name: 'Notcoin', type: 'crypto' },
  'BRETT': { name: 'Brett', type: 'crypto' },
  'POPCAT': { name: 'Popcat', type: 'crypto' },
  'BOME': { name: 'Book of Meme', type: 'crypto' },
  'MEW': { name: 'cat in a dogs world', type: 'crypto' },
  'AI16Z': { name: 'ai16z', type: 'crypto' },
  'AIXBT': { name: 'aixbt by Virtuals', type: 'crypto' },
  'TURBO': { name: 'Turbo', type: 'crypto' },
  'CORE': { name: 'Core', type: 'crypto' },
  'CFX': { name: 'Conflux', type: 'crypto' },
  'OSMO': { name: 'Osmosis', type: 'crypto' },
  'AKT': { name: 'Akash Network', type: 'crypto' },
  'MINA': { name: 'Mina Protocol', type: 'crypto' },
  'CKB': { name: 'Nervos Network', type: 'crypto' },
  'ZK': { name: 'zkSync', type: 'crypto' },
  'ENA': { name: 'Ethena', type: 'crypto' },
  'ETHFI': { name: 'ether.fi', type: 'crypto' },
  'IO': { name: 'io.net', type: 'crypto' },
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('Starting CoinGecko ID mapping fixes and Polygon ticker additions...');
    
    const results = {
      coingecko: {
        updated: [] as string[],
        inserted: [] as string[],
        errors: [] as string[],
      },
      polygon: {
        assetsCreated: [] as string[],
        polygonMapped: [] as string[],
        coingeckoMapped: [] as string[],
        errors: [] as string[],
      }
    };

    // Phase 1: Fix CoinGecko ID mappings
    console.log('Phase 1: Fixing CoinGecko ID mappings...');
    for (const [symbol, correctCgId] of Object.entries(COINGECKO_ID_CORRECTIONS)) {
      try {
        const { data: asset, error: assetError } = await supabase
          .from('assets')
          .select('id, symbol, name')
          .eq('symbol', symbol)
          .eq('type', 'crypto')
          .maybeSingle();

        if (assetError) {
          results.coingecko.errors.push(`${symbol}: ${assetError.message}`);
          continue;
        }

        if (!asset) {
          continue; // Asset doesn't exist, will be handled in Phase 2
        }

        const { data: existingCg, error: cgError } = await supabase
          .from('coingecko_assets')
          .select('id, coingecko_id')
          .eq('asset_id', asset.id)
          .maybeSingle();

        if (cgError) {
          results.coingecko.errors.push(`${symbol}: ${cgError.message}`);
          continue;
        }

        if (existingCg) {
          if (existingCg.coingecko_id !== correctCgId) {
            const { error: updateError } = await supabase
              .from('coingecko_assets')
              .update({ 
                coingecko_id: correctCgId,
                last_synced: new Date().toISOString()
              })
              .eq('id', existingCg.id);

            if (updateError) {
              results.coingecko.errors.push(`${symbol}: ${updateError.message}`);
            } else {
              console.log(`Updated ${symbol}: ${existingCg.coingecko_id} → ${correctCgId}`);
              results.coingecko.updated.push(`${symbol}: ${existingCg.coingecko_id} → ${correctCgId}`);
            }
          }
        } else {
          const { error: insertError } = await supabase
            .from('coingecko_assets')
            .insert({
              asset_id: asset.id,
              coingecko_id: correctCgId,
              last_synced: new Date().toISOString()
            });

          if (insertError) {
            results.coingecko.errors.push(`${symbol}: ${insertError.message}`);
          } else {
            console.log(`Inserted ${symbol} with CoinGecko ID: ${correctCgId}`);
            results.coingecko.inserted.push(`${symbol}: ${correctCgId}`);
          }
        }
      } catch (err) {
        results.coingecko.errors.push(`${symbol}: ${err.message}`);
      }
    }

    // Phase 2: Add missing Polygon tickers for major tokens
    console.log('Phase 2: Adding missing Polygon tickers...');
    for (const [symbol, info] of Object.entries(POLYGON_TICKER_ADDITIONS)) {
      try {
        // Check if asset exists
        let { data: asset, error: assetError } = await supabase
          .from('assets')
          .select('id, symbol, name')
          .eq('symbol', symbol)
          .eq('type', 'crypto')
          .maybeSingle();

        if (assetError) {
          results.polygon.errors.push(`${symbol}: ${assetError.message}`);
          continue;
        }

        // Create asset if it doesn't exist
        if (!asset) {
          const { data: newAsset, error: createError } = await supabase
            .from('assets')
            .insert({
              symbol: symbol,
              name: info.name,
              type: info.type,
            })
            .select()
            .single();

          if (createError) {
            results.polygon.errors.push(`${symbol} asset create: ${createError.message}`);
            continue;
          }
          asset = newAsset;
          results.polygon.assetsCreated.push(symbol);
          console.log(`Created asset: ${symbol} (${info.name})`);
        }

        // Check if Polygon mapping exists
        const { data: existingPolygon, error: polygonError } = await supabase
          .from('polygon_assets')
          .select('id')
          .eq('asset_id', asset.id)
          .maybeSingle();

        if (polygonError) {
          results.polygon.errors.push(`${symbol} polygon check: ${polygonError.message}`);
          continue;
        }

        // Add Polygon mapping if missing
        if (!existingPolygon) {
          const polygonTicker = `X:${symbol}USD`;
          const { error: insertPolygonError } = await supabase
            .from('polygon_assets')
            .insert({
              asset_id: asset.id,
              polygon_ticker: polygonTicker,
              market: 'crypto',
              is_active: true,
            });

          if (insertPolygonError) {
            results.polygon.errors.push(`${symbol} polygon insert: ${insertPolygonError.message}`);
          } else {
            results.polygon.polygonMapped.push(`${symbol} → ${polygonTicker}`);
            console.log(`Added Polygon mapping: ${symbol} → ${polygonTicker}`);
          }
        }

        // Check if CoinGecko mapping exists for this asset
        const cgId = COINGECKO_ID_CORRECTIONS[symbol];
        if (cgId) {
          const { data: existingCg, error: cgCheckError } = await supabase
            .from('coingecko_assets')
            .select('id')
            .eq('asset_id', asset.id)
            .maybeSingle();

          if (!cgCheckError && !existingCg) {
            const { error: insertCgError } = await supabase
              .from('coingecko_assets')
              .insert({
                asset_id: asset.id,
                coingecko_id: cgId,
                last_synced: new Date().toISOString()
              });

            if (!insertCgError) {
              results.polygon.coingeckoMapped.push(`${symbol} → ${cgId}`);
              console.log(`Added CoinGecko mapping for new asset: ${symbol} → ${cgId}`);
            }
          }
        }
      } catch (err) {
        results.polygon.errors.push(`${symbol}: ${err.message}`);
      }
    }

    console.log('Migration complete:', results);

    return new Response(JSON.stringify({
      success: true,
      summary: {
        coingecko: {
          updated: results.coingecko.updated.length,
          inserted: results.coingecko.inserted.length,
          errors: results.coingecko.errors.length
        },
        polygon: {
          assetsCreated: results.polygon.assetsCreated.length,
          polygonMapped: results.polygon.polygonMapped.length,
          coingeckoMapped: results.polygon.coingeckoMapped.length,
          errors: results.polygon.errors.length
        }
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
