-- Fix SX Network to not use CEX TradingView symbol
UPDATE ticker_mappings
SET 
  tradingview_symbol = 'SXUSD',
  tradingview_supported = false,
  updated_at = now()
WHERE symbol = 'SX' AND coingecko_id = 'sx-network-2';

-- Add comment explaining why tradingview_supported is false
COMMENT ON COLUMN ticker_mappings.tradingview_supported IS 'Set to false when TradingView symbol is uncertain or requires manual verification. True only when symbol is validated and not defaulting to Binance/Bybit.';