-- Fix BAS (BNB Attestation Service) to use KUCOIN with USDT (valid exchange)
UPDATE ticker_mappings
SET 
  tradingview_symbol = 'KUCOIN:BASUSDT',
  polygon_ticker = 'X:BASUSDT',
  display_name = 'BNB Attestation Service',
  updated_at = now()
WHERE symbol = 'BAS';