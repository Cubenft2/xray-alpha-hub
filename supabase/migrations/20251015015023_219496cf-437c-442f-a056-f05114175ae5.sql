-- Add CLO (Yei Finance) crypto mapping
INSERT INTO ticker_mappings (
  symbol,
  display_name,
  tradingview_symbol,
  type,
  coingecko_id,
  tradingview_supported,
  is_active,
  aliases
) VALUES (
  'CLO',
  'Yei Finance',
  'BINANCE:CLOUSDT',
  'crypto',
  'callisto',
  true,
  true,
  ARRAY['CLOUSDT']
)
ON CONFLICT (symbol) 
DO UPDATE SET
  display_name = EXCLUDED.display_name,
  tradingview_symbol = EXCLUDED.tradingview_symbol,
  type = EXCLUDED.type,
  coingecko_id = EXCLUDED.coingecko_id,
  tradingview_supported = EXCLUDED.tradingview_supported,
  is_active = EXCLUDED.is_active,
  aliases = EXCLUDED.aliases,
  updated_at = now();