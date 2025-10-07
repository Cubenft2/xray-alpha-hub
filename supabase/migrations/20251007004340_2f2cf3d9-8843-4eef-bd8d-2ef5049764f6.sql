-- Add Blend Labs (BLND) stock mapping
INSERT INTO ticker_mappings (
  symbol,
  display_name,
  tradingview_symbol,
  type,
  tradingview_supported,
  is_active,
  coingecko_id,
  polygon_ticker
) VALUES (
  'BLND',
  'Blend Labs (BLND)',
  'NYSE:BLND',
  'stock',
  true,
  true,
  null,
  'BLND'
)
ON CONFLICT (symbol) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  tradingview_symbol = EXCLUDED.tradingview_symbol,
  type = EXCLUDED.type,
  tradingview_supported = EXCLUDED.tradingview_supported,
  is_active = EXCLUDED.is_active,
  polygon_ticker = EXCLUDED.polygon_ticker;