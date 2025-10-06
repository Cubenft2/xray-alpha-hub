-- Fix MNT mapping: Should be Mantle (Layer 2), not Mundoteam
UPDATE ticker_mappings 
SET 
  display_name = 'Mantle',
  tradingview_symbol = 'MEXC:MNTUSDT',
  preferred_exchange = 'MEXC',
  coingecko_id = 'mantle',
  updated_at = now()
WHERE symbol = 'MNT' AND display_name = 'Mundoteam';

-- Also ensure we have MNTUSDT as an alias
UPDATE ticker_mappings
SET aliases = ARRAY['MNTUSDT', 'MANTLE']
WHERE symbol = 'MNT';