-- Add Canton Network (CC) ticker mapping
-- Canton Network is a new token listed on KuCoin (Nov 10, 2025)
-- This fixes the incorrect NYSE:CC (Chemours Company) link in briefs

INSERT INTO ticker_mappings (
  symbol,
  display_name,
  type,
  tradingview_symbol,
  coingecko_id,
  is_active,
  price_supported,
  tradingview_supported
) VALUES (
  'CC',
  'Canton Network (CC)',
  'crypto',
  'KUCOIN:CCUSDT',
  'canton-network',
  true,
  true,
  true
)
ON CONFLICT (symbol) 
DO UPDATE SET
  display_name = EXCLUDED.display_name,
  tradingview_symbol = EXCLUDED.tradingview_symbol,
  coingecko_id = EXCLUDED.coingecko_id,
  type = EXCLUDED.type,
  updated_at = now();