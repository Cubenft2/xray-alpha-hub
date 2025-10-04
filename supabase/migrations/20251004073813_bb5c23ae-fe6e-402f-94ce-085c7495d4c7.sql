-- Update AIC ticker mapping to use fallback instead of TradingView
UPDATE ticker_mappings
SET tradingview_supported = false
WHERE symbol = 'AIC' AND type = 'crypto';