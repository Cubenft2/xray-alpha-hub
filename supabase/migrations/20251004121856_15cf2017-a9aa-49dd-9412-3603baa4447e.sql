-- Fix ADX and CORN TradingView symbols to use correct crypto exchanges

UPDATE ticker_mappings
SET tradingview_symbol = 'MEXC:ADXUSDT',
    updated_at = now()
WHERE symbol = 'ADX';

UPDATE ticker_mappings
SET tradingview_symbol = 'MEXC:CORNUSDT',
    updated_at = now()
WHERE symbol = 'CORN';