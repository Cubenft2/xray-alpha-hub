-- Fix CLO (Yei Finance) ticker mapping to use correct exchange
-- CLO is not listed on Binance, but is available on MEXC

UPDATE ticker_mappings
SET 
  tradingview_symbol = 'MEXC:CLOUSDT',
  display_name = 'Yei Finance (CLO)',
  preferred_exchange = 'mexc',
  exchange = 'mexc',
  updated_at = now()
WHERE symbol = 'CLO' 
  AND coingecko_id = 'yei-finance';