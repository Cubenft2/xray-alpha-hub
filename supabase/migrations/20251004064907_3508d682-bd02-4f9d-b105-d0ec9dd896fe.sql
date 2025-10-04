-- Update HASH to use Coinbase exchange
UPDATE ticker_mappings 
SET tradingview_symbol = 'COINBASE:HASHUSD',
    updated_at = now()
WHERE symbol = 'HASH';