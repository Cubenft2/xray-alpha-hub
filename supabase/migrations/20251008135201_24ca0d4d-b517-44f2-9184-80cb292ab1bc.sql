-- Update SX to be SX Network (crypto)
UPDATE ticker_mappings
SET 
  display_name = 'SX Network',
  type = 'crypto',
  coingecko_id = 'sx-network-2',
  tradingview_symbol = 'BYBIT:SXUSDT',
  polygon_ticker = NULL,
  aliases = ARRAY['SXNETWORK', 'SX NETWORK'],
  updated_at = now()
WHERE symbol = 'SX';

-- Add FRSX for Foresight Autonomous Holdings stock
INSERT INTO ticker_mappings (
  symbol,
  display_name,
  type,
  tradingview_symbol,
  polygon_ticker,
  aliases,
  is_active,
  tradingview_supported,
  price_supported
) VALUES (
  'FRSX',
  'Foresight Autonomous Holdings Ltd.',
  'stock',
  'NASDAQ:FRSX',
  'FRSX',
  ARRAY['FORESIGHT'],
  true,
  true,
  true
)
ON CONFLICT (symbol) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  type = EXCLUDED.type,
  tradingview_symbol = EXCLUDED.tradingview_symbol,
  polygon_ticker = EXCLUDED.polygon_ticker,
  aliases = EXCLUDED.aliases,
  updated_at = now();

-- Add Verizon (VZ) stock
INSERT INTO ticker_mappings (
  symbol,
  display_name,
  type,
  tradingview_symbol,
  polygon_ticker,
  aliases,
  is_active,
  tradingview_supported,
  price_supported
) VALUES (
  'VZ',
  'Verizon Communications Inc.',
  'stock',
  'NYSE:VZ',
  'VZ',
  ARRAY['VERIZON'],
  true,
  true,
  true
)
ON CONFLICT (symbol) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  type = EXCLUDED.type,
  tradingview_symbol = EXCLUDED.tradingview_symbol,
  polygon_ticker = EXCLUDED.polygon_ticker,
  aliases = EXCLUDED.aliases,
  updated_at = now();