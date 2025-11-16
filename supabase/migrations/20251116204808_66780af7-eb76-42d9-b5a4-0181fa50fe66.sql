-- Fix TRX (TRON) TradingView symbol
-- TradingView doesn't support COINBASE:TRXUSD
-- Change to KRAKEN:TRXUSD which is valid
UPDATE ticker_mappings
SET 
  tradingview_symbol = 'KRAKEN:TRXUSD',
  updated_at = now()
WHERE symbol = 'TRX';