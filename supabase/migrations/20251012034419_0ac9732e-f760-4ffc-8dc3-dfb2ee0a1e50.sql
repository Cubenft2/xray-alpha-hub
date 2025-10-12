-- Fix TRAC TradingView symbol
UPDATE ticker_mappings 
SET 
  tradingview_symbol = 'TRACUSD',
  updated_at = now()
WHERE symbol = 'TRAC';