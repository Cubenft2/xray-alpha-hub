-- Fix SPY ticker mapping with correct exchange and add Polygon fallback
UPDATE ticker_mappings
SET 
  tradingview_symbol = 'AMEX:SPY',
  polygon_ticker = 'SPY',
  primary_stock_provider = 'polygon'
WHERE symbol = 'SPY' AND type = 'stock';