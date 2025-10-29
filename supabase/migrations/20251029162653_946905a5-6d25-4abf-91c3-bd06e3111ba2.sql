-- Fix BABY token mapping to correct Babylon token on OKX
UPDATE ticker_mappings
SET 
  display_name = 'Babylon',
  tradingview_symbol = 'OKX:BABYUSDT',
  coingecko_id = 'babylon',
  exchange = 'OKX',
  preferred_exchange = 'OKX',
  updated_at = now()
WHERE symbol = 'BABY';

-- Add comment for tracking
COMMENT ON COLUMN ticker_mappings.tradingview_symbol IS 'TradingView symbol format: EXCHANGE:PAIRUSDT (e.g., OKX:BABYUSDT, BINANCE:BTCUSDT)';