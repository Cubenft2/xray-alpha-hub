-- Add KAITO mapping and fix XPL tradingview symbol for crypto display

-- Add KAITO token mapping
INSERT INTO ticker_mappings (symbol, display_name, type, coingecko_id, polygon_ticker, preferred_exchange, tradingview_symbol, price_supported, tradingview_supported, derivs_supported, social_supported)
VALUES 
  ('KAITO', 'Kaito (KAITO)', 'crypto', 'kaito', NULL, NULL, 'CRYPTO:KAITOUSD', true, true, false, true)
ON CONFLICT (symbol) DO UPDATE SET
  coingecko_id = EXCLUDED.coingecko_id,
  display_name = EXCLUDED.display_name,
  type = EXCLUDED.type,
  preferred_exchange = EXCLUDED.preferred_exchange,
  tradingview_symbol = EXCLUDED.tradingview_symbol,
  price_supported = EXCLUDED.price_supported,
  tradingview_supported = EXCLUDED.tradingview_supported,
  derivs_supported = EXCLUDED.derivs_supported,
  social_supported = EXCLUDED.social_supported;

-- Fix XPL to use crypto-appropriate TradingView symbol instead of stock format
UPDATE ticker_mappings 
SET tradingview_symbol = 'CRYPTO:XPLUSD',
    type = 'crypto'
WHERE symbol IN ('XPL', 'PLASMA');