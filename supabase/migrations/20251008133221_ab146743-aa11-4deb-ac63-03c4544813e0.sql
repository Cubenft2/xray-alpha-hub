-- Add DEFI ticker mapping to database
INSERT INTO ticker_mappings (
  symbol,
  display_name,
  type,
  coingecko_id,
  tradingview_symbol,
  polygon_ticker,
  aliases,
  is_active
) VALUES (
  'DEFI',
  'DeFi',
  'crypto',
  'de-fi',
  'BYBIT:DEFIUSDT',
  NULL,
  ARRAY['DE-FI']::text[],
  true
)
ON CONFLICT (symbol) 
DO UPDATE SET
  coingecko_id = 'de-fi',
  tradingview_symbol = 'BYBIT:DEFIUSDT',
  aliases = ARRAY['DE-FI']::text[],
  display_name = 'DeFi',
  type = 'crypto',
  is_active = true,
  updated_at = now();