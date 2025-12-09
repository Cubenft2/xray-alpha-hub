-- Clean invalid polygon_ticker values (emojis, $-prefix, spaces, lowercase, stock tickers, USDT suffix)
-- This removes ~499 invalid mappings, leaving ~1,847 valid ones
UPDATE ticker_mappings 
SET polygon_ticker = NULL 
WHERE type = 'crypto' 
  AND polygon_ticker IS NOT NULL 
  AND polygon_ticker !~ '^X:[A-Z0-9]+USD$';