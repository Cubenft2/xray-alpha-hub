-- Add IonQ (IONQ) to ticker_mappings
INSERT INTO public.ticker_mappings (
  symbol,
  display_name,
  type,
  tradingview_symbol,
  polygon_ticker,
  is_active,
  tradingview_supported,
  price_supported
) VALUES (
  'IONQ',
  'IonQ Inc.',
  'stock',
  'NYSE:IONQ',
  'IONQ',
  true,
  true,
  true
)
ON CONFLICT (symbol) DO NOTHING;