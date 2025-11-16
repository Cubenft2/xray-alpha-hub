-- Fix GIGA (Gigachad) TradingView symbol
-- Change from OKX:GIGAUSDT to COINBASE:GIGAUSD
-- Follows priority rules: Coinbase > OKX, USD > USDT

UPDATE ticker_mappings
SET 
  tradingview_symbol = 'COINBASE:GIGAUSD',
  updated_at = now()
WHERE symbol = 'GIGA';