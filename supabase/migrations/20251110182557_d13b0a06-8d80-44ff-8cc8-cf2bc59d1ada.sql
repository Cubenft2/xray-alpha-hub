-- Fix ASTER token mapping (data correction)
-- ASTER was incorrectly mapped to Astar Network (ASTR)
-- Updating to correct Aster token on Binance

UPDATE ticker_mappings
SET 
  tradingview_symbol = 'BINANCE:ASTERUSDT',
  display_name = 'Aster (ASTER)',
  coingecko_id = 'aster-2',
  updated_at = now()
WHERE symbol = 'ASTER' AND coingecko_id = 'astar';