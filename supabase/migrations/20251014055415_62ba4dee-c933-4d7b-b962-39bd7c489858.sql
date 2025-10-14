-- Add SENA (Ethena Staked ENA) to ticker_mappings
INSERT INTO ticker_mappings (
  symbol,
  display_name,
  tradingview_symbol,
  type,
  coingecko_id,
  dex_platforms,
  tradingview_supported,
  is_active
) VALUES (
  'SENA',
  'Ethena Staked ENA',
  'ENAUSD',
  'crypto',
  'ethena-staked-ena',
  '{"ethereum": "0x8be3460a480c80728a8c4d7a5d5303c85ba7b3b9"}'::jsonb,
  false,
  true
)
ON CONFLICT (symbol) 
DO UPDATE SET
  coingecko_id = EXCLUDED.coingecko_id,
  dex_platforms = EXCLUDED.dex_platforms,
  display_name = EXCLUDED.display_name,
  tradingview_symbol = EXCLUDED.tradingview_symbol,
  tradingview_supported = EXCLUDED.tradingview_supported;