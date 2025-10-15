-- Fix crypto mappings for OM, EDU, CLO to correct TradingView symbols
-- Ensures watchlist and mini charts resolve to crypto, not stocks

-- Upsert OM (MANTRA)
INSERT INTO public.ticker_mappings (
  symbol,
  display_name,
  tradingview_symbol,
  type,
  preferred_exchange,
  tradingview_supported,
  is_active,
  aliases
) VALUES (
  'OM',
  'MANTRA',
  'BINANCE:OMUSDT',
  'crypto',
  'binance',
  true,
  true,
  ARRAY['OM','OMUSDT','OMUSD']
)
ON CONFLICT (symbol)
DO UPDATE SET
  display_name = EXCLUDED.display_name,
  tradingview_symbol = EXCLUDED.tradingview_symbol,
  type = EXCLUDED.type,
  preferred_exchange = EXCLUDED.preferred_exchange,
  tradingview_supported = EXCLUDED.tradingview_supported,
  is_active = EXCLUDED.is_active,
  aliases = EXCLUDED.aliases,
  updated_at = now();

-- Upsert EDU (Open Campus)
INSERT INTO public.ticker_mappings (
  symbol,
  display_name,
  tradingview_symbol,
  type,
  preferred_exchange,
  tradingview_supported,
  is_active,
  aliases
) VALUES (
  'EDU',
  'Open Campus',
  'BINANCE:EDUSDT',
  'crypto',
  'binance',
  true,
  true,
  ARRAY['EDU','EDUUSDT','EDUUSD']
)
ON CONFLICT (symbol)
DO UPDATE SET
  display_name = EXCLUDED.display_name,
  tradingview_symbol = EXCLUDED.tradingview_symbol,
  type = EXCLUDED.type,
  preferred_exchange = EXCLUDED.preferred_exchange,
  tradingview_supported = EXCLUDED.tradingview_supported,
  is_active = EXCLUDED.is_active,
  aliases = EXCLUDED.aliases,
  updated_at = now();

-- Upsert CLO (Callisto Network)
INSERT INTO public.ticker_mappings (
  symbol,
  display_name,
  tradingview_symbol,
  type,
  preferred_exchange,
  tradingview_supported,
  is_active,
  aliases
) VALUES (
  'CLO',
  'Callisto Network',
  'BINANCE:CLOUSDT',
  'crypto',
  'binance',
  true,
  true,
  ARRAY['CLO','CLOUSDT','CLOUSD']
)
ON CONFLICT (symbol)
DO UPDATE SET
  display_name = EXCLUDED.display_name,
  tradingview_symbol = EXCLUDED.tradingview_symbol,
  type = EXCLUDED.type,
  preferred_exchange = EXCLUDED.preferred_exchange,
  tradingview_supported = EXCLUDED.tradingview_supported,
  is_active = EXCLUDED.is_active,
  aliases = EXCLUDED.aliases,
  updated_at = now();