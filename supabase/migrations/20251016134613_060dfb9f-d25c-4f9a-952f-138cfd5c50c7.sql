-- Fix ticker mappings for MU (Micron Technology - NASDAQ stock)
INSERT INTO ticker_mappings (
  symbol, 
  display_name, 
  tradingview_symbol, 
  type, 
  polygon_ticker,
  is_active, 
  tradingview_supported, 
  price_supported
)
VALUES (
  'MU', 
  'Micron Technology', 
  'NASDAQ:MU', 
  'stock',
  'MU',
  true, 
  true, 
  true
)
ON CONFLICT (symbol) DO UPDATE SET
  tradingview_symbol = 'NASDAQ:MU',
  type = 'stock',
  polygon_ticker = 'MU',
  display_name = 'Micron Technology',
  updated_at = now();

-- Fix BAT to use KRAKEN with USD (not USDT)
UPDATE ticker_mappings
SET 
  tradingview_symbol = 'KRAKEN:BATUSD',
  polygon_ticker = 'X:BATUSD',
  coingecko_id = 'basic-attention-token',
  display_name = 'Basic Attention Token',
  updated_at = now()
WHERE symbol = 'BAT';

-- Fix ALPHA to use KRAKEN with USD (not USDT)  
UPDATE ticker_mappings
SET 
  tradingview_symbol = 'KRAKEN:ALPHAUSD',
  polygon_ticker = 'X:ALPHAUSD',
  coingecko_id = 'alpha-finance',
  display_name = 'Alpha Finance',
  updated_at = now()
WHERE symbol = 'ALPHA';