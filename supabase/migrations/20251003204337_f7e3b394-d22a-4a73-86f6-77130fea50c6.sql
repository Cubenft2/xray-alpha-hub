-- Add APE (ApeCoin) to ticker_mappings
INSERT INTO public.ticker_mappings (
  symbol,
  display_name,
  type,
  tradingview_symbol,
  coingecko_id,
  polygon_ticker,
  aliases,
  price_supported,
  tradingview_supported,
  derivs_supported,
  social_supported,
  is_active
) VALUES (
  'APE',
  'ApeCoin',
  'crypto',
  'APEUSDT',
  'apecoin',
  'X:APEUSD',
  ARRAY['APEUSDT', 'APECOIN']::text[],
  true,
  true,
  true,
  true,
  true
)
ON CONFLICT (symbol) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  tradingview_symbol = EXCLUDED.tradingview_symbol,
  coingecko_id = EXCLUDED.coingecko_id,
  polygon_ticker = EXCLUDED.polygon_ticker,
  aliases = EXCLUDED.aliases,
  price_supported = EXCLUDED.price_supported,
  tradingview_supported = EXCLUDED.tradingview_supported,
  derivs_supported = EXCLUDED.derivs_supported,
  social_supported = EXCLUDED.social_supported,
  is_active = EXCLUDED.is_active,
  updated_at = now();