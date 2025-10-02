-- Update SNX to use Bybit exchange for TradingView
UPDATE ticker_mappings 
SET 
  tradingview_symbol = 'BYBIT:SNXUSDT',
  preferred_exchange = 'bybit',
  updated_at = now()
WHERE symbol = 'SNX';