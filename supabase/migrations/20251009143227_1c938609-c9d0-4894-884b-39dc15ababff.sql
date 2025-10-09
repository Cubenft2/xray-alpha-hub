-- Remove conflicting SX pending mapping (SX is crypto, not FRSX stock)
DELETE FROM pending_ticker_mappings 
WHERE id = '54093fc1-53a1-482d-9998-e5a6fdb6ad68';

-- Add QTWO as NYSE stock
INSERT INTO ticker_mappings (
  symbol,
  display_name,
  type,
  tradingview_symbol,
  polygon_ticker,
  price_supported,
  tradingview_supported,
  is_active
) VALUES (
  'QTWO',
  'Q2 Holdings Inc',
  'stock',
  'NYSE:QTWO',
  'QTWO',
  true,
  true,
  true
)
ON CONFLICT (symbol) DO NOTHING;