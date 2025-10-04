-- Add CORN and ADX ticker mappings for TradingView support

INSERT INTO ticker_mappings (
  symbol,
  display_name,
  display_symbol,
  type,
  tradingview_symbol,
  coingecko_id,
  tradingview_supported,
  price_supported,
  social_supported,
  derivs_supported,
  is_active
) VALUES 
(
  'CORN',
  'Corn',
  'CORN',
  'crypto',
  'BYBIT:CORNUSDT',
  'corn',
  true,
  true,
  false,
  false,
  true
),
(
  'ADX',
  'AdEx',
  'ADX',
  'crypto',
  'BINANCE:ADXUSDT',
  'adex',
  true,
  true,
  true,
  false,
  true
)
ON CONFLICT (symbol) DO UPDATE SET
  tradingview_symbol = EXCLUDED.tradingview_symbol,
  coingecko_id = EXCLUDED.coingecko_id,
  tradingview_supported = EXCLUDED.tradingview_supported,
  updated_at = now();

-- Remove from pending queue if they exist
DELETE FROM pending_ticker_mappings 
WHERE normalized_symbol IN ('CORN', 'ADX');