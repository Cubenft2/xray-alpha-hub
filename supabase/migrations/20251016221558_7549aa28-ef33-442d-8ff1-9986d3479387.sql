-- Fix ticker_mappings: Align tradingview_symbol with preferred_exchange
-- Make database the single source of truth, remove need for hardcoded overrides

-- BAS: Use Gate.io (preferred_exchange is already gateio)
UPDATE ticker_mappings
SET 
  tradingview_symbol = 'GATEIO:BASUSDT',
  polygon_ticker = 'X:BASUSDT',
  updated_at = now()
WHERE symbol = 'BAS';

-- BAT: Use Coinbase (preferred_exchange is already coinbase)
UPDATE ticker_mappings
SET 
  tradingview_symbol = 'COINBASE:BATUSD',
  polygon_ticker = 'X:BATUSD',
  updated_at = now()
WHERE symbol = 'BAT';

-- PAXG: Update preferred_exchange to match existing tradingview_symbol
UPDATE ticker_mappings
SET 
  preferred_exchange = 'coinbase',
  updated_at = now()
WHERE symbol = 'PAXG';