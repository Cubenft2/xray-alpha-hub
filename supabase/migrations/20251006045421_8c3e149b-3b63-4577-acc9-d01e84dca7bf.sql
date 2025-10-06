-- First, add unique constraint on symbol if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'ticker_mappings_symbol_key'
  ) THEN
    ALTER TABLE ticker_mappings ADD CONSTRAINT ticker_mappings_symbol_key UNIQUE (symbol);
  END IF;
END $$;

-- Now insert stock ticker mappings with proper conflict handling
INSERT INTO ticker_mappings (
  symbol,
  display_symbol,
  display_name,
  type,
  polygon_ticker,
  tradingview_symbol,
  is_active,
  price_supported,
  tradingview_supported
) VALUES
  ('NX', 'NX', 'Quanex Building Products', 'stock', 'NX', 'NYSE:NX', true, true, true),
  ('PUBM', 'PUBM', 'PubMatic', 'stock', 'PUBM', 'NASDAQ:PUBM', true, true, true),
  ('AMZN', 'AMZN', 'Amazon', 'stock', 'AMZN', 'NASDAQ:AMZN', true, true, true),
  ('GOOG', 'GOOG', 'Google', 'stock', 'GOOG', 'NASDAQ:GOOG', true, true, true),
  ('NVDA', 'NVDA', 'NVIDIA', 'stock', 'NVDA', 'NASDAQ:NVDA', true, true, true)
ON CONFLICT (symbol) 
DO UPDATE SET
  display_name = EXCLUDED.display_name,
  polygon_ticker = EXCLUDED.polygon_ticker,
  tradingview_symbol = EXCLUDED.tradingview_symbol,
  type = EXCLUDED.type,
  price_supported = EXCLUDED.price_supported,
  tradingview_supported = EXCLUDED.tradingview_supported,
  is_active = EXCLUDED.is_active,
  updated_at = now();