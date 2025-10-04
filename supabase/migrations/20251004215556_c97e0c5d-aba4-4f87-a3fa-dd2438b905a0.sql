-- Add EVAA Protocol mapping to ticker_mappings
INSERT INTO public.ticker_mappings (
  symbol,
  display_name,
  tradingview_symbol,
  type,
  coingecko_id,
  is_active,
  tradingview_supported,
  price_supported
) VALUES (
  'EVAA',
  'EVAA Protocol',
  'MEXC:EVAAUSDT',
  'crypto',
  'evaa',
  true,
  true,
  true
)
ON CONFLICT (symbol) 
DO UPDATE SET
  tradingview_symbol = EXCLUDED.tradingview_symbol,
  display_name = EXCLUDED.display_name,
  coingecko_id = EXCLUDED.coingecko_id,
  updated_at = now();