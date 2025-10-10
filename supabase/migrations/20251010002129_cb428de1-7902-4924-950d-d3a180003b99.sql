-- Update TradingView symbols for 2Z and CHEEMS to match TradingView's expected format
UPDATE ticker_mappings 
SET tradingview_symbol = 'CHEEMSCUSD'
WHERE symbol = 'CHEEMS';

UPDATE ticker_mappings 
SET tradingview_symbol = 'BINANCE:2ZUSDT'
WHERE symbol = '2Z';