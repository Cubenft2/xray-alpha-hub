-- Update OKB to use OKX exchange
UPDATE ticker_mappings 
SET tradingview_symbol = 'OKX:OKBUSDT',
    updated_at = now()
WHERE symbol = 'OKB';