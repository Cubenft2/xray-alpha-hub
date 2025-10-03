-- Add AIC (AI Companions) to ticker_mappings
INSERT INTO public.ticker_mappings (
  symbol,
  display_name,
  type,
  tradingview_symbol,
  coingecko_id,
  aliases,
  price_supported,
  tradingview_supported,
  derivs_supported,
  social_supported,
  is_active
) VALUES (
  'AIC',
  'AI Companions',
  'crypto',
  'AICUSDT',
  'ai-companions',
  ARRAY['AICUSDT', 'AI COMPANIONS']::text[],
  true,
  true,
  false,
  true,
  true
)
ON CONFLICT (symbol) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  tradingview_symbol = EXCLUDED.tradingview_symbol,
  coingecko_id = EXCLUDED.coingecko_id,
  aliases = EXCLUDED.aliases,
  price_supported = EXCLUDED.price_supported,
  tradingview_supported = EXCLUDED.tradingview_supported,
  derivs_supported = EXCLUDED.derivs_supported,
  social_supported = EXCLUDED.social_supported,
  is_active = EXCLUDED.is_active,
  updated_at = now();

-- Add APEPE (Ape and Pepe) to ticker_mappings
INSERT INTO public.ticker_mappings (
  symbol,
  display_name,
  type,
  tradingview_symbol,
  coingecko_id,
  aliases,
  price_supported,
  tradingview_supported,
  derivs_supported,
  social_supported,
  is_active
) VALUES (
  'APEPE',
  'Ape and Pepe',
  'crypto',
  'APEPEUSD',
  'ape-and-pepe',
  ARRAY['APEPEUSD']::text[],
  true,
  true,
  false,
  false,
  true
)
ON CONFLICT (symbol) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  tradingview_symbol = EXCLUDED.tradingview_symbol,
  coingecko_id = EXCLUDED.coingecko_id,
  aliases = EXCLUDED.aliases,
  price_supported = EXCLUDED.price_supported,
  tradingview_supported = EXCLUDED.tradingview_supported,
  derivs_supported = EXCLUDED.derivs_supported,
  social_supported = EXCLUDED.social_supported,
  is_active = EXCLUDED.is_active,
  updated_at = now();