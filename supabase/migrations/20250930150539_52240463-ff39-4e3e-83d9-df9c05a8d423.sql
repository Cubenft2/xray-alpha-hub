-- Add missing ticker mappings for tokens that are showing as "missing" in quotes response

INSERT INTO ticker_mappings (symbol, display_name, type, coingecko_id, polygon_ticker, preferred_exchange, tradingview_symbol, price_supported, tradingview_supported, derivs_supported, social_supported)
VALUES 
  ('STRK', 'Starknet (STRK)', 'crypto', 'starknet', NULL, 'BINANCE', 'BINANCE:STRKUSDT', true, true, false, true),
  ('STARKNET', 'Starknet (STRK)', 'crypto', 'starknet', NULL, 'BINANCE', 'BINANCE:STRKUSDT', true, true, false, true),
  ('0G', '0G (0G)', 'crypto', '0g-ai-access-token', NULL, NULL, '0GUSD', true, true, false, false),
  ('SUPER', 'SuperVerse (SUPER)', 'crypto', 'superverse', NULL, NULL, 'BINANCE:SUPERUSDT', true, true, false, false),
  ('XPL', 'Plasma (XPL)', 'crypto', 'plasma-finance', NULL, NULL, 'XPLUSD', true, true, false, false),
  ('PLASMA', 'Plasma (XPL)', 'crypto', 'plasma-finance', NULL, NULL, 'XPLUSD', true, true, false, false)
ON CONFLICT (symbol) DO UPDATE SET
  coingecko_id = EXCLUDED.coingecko_id,
  preferred_exchange = EXCLUDED.preferred_exchange,
  tradingview_symbol = EXCLUDED.tradingview_symbol,
  price_supported = EXCLUDED.price_supported,
  tradingview_supported = EXCLUDED.tradingview_supported,
  derivs_supported = EXCLUDED.derivs_supported,
  social_supported = EXCLUDED.social_supported;