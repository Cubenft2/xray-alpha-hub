-- Update MERL ticker mapping to use OKX exchange
UPDATE ticker_mappings 
SET tradingview_symbol = 'OKX:MERLUSDT'
WHERE symbol = 'MERL';