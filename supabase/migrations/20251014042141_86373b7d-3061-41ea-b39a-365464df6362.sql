-- Add Humanity (H) token to ticker_mappings
INSERT INTO ticker_mappings (
  symbol,
  display_name,
  tradingview_symbol,
  type,
  coingecko_id,
  dex_address,
  dex_chain,
  is_active,
  tradingview_supported
) VALUES (
  'H',
  'Humanity',
  'CRYPTO:HUSD',
  'crypto',
  'humanity',
  '0xcf5104d094e3864cfcbda43b82e1cefd26a016eb',
  'Ethereum',
  true,
  false
)
ON CONFLICT (symbol) 
DO UPDATE SET
  coingecko_id = EXCLUDED.coingecko_id,
  dex_address = EXCLUDED.dex_address,
  dex_chain = EXCLUDED.dex_chain,
  display_name = EXCLUDED.display_name;