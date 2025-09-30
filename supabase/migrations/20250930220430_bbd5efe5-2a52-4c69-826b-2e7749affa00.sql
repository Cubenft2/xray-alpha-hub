-- Update ATH to include TradingView symbol
UPDATE ticker_mappings 
SET tradingview_symbol = 'COINBASE:ATHUSD',
    tradingview_supported = true,
    updated_at = now()
WHERE symbol = 'ATH';

-- Add UXLINK mapping (aliases include UXPL so both resolve correctly)
INSERT INTO ticker_mappings (
  symbol, 
  display_symbol, 
  display_name, 
  type, 
  coingecko_id, 
  tradingview_symbol, 
  tradingview_supported,
  price_supported,
  is_active,
  aliases
) VALUES (
  'UXLINK',
  'UXLINK',
  'UXLINK (UXLINK)',
  'crypto',
  'uxlink',
  'CRYPTO:UXLINKUSD',
  true,
  true,
  true,
  ARRAY['UXPL']
)
ON CONFLICT (symbol) DO UPDATE SET
  tradingview_symbol = EXCLUDED.tradingview_symbol,
  tradingview_supported = EXCLUDED.tradingview_supported,
  aliases = EXCLUDED.aliases,
  updated_at = now();