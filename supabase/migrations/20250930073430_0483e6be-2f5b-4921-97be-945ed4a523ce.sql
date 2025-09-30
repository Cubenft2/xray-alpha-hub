-- Add missing ticker mappings for symbols appearing in briefs
-- All symbols should use their display_symbol as the canonical reference

-- SOL (Solana)
INSERT INTO ticker_mappings (
  symbol, display_symbol, display_name, type,
  coingecko_id, tradingview_symbol,
  price_supported, tradingview_supported, derivs_supported, social_supported,
  aliases
) VALUES (
  'SOL', 'SOL', 'Solana', 'crypto',
  'solana', 'BINANCE:SOLUSDT',
  true, true, false, true,
  ARRAY['SOLUSDT', 'SOL-USD', 'SOLUSD']
) ON CONFLICT (symbol) DO UPDATE SET
  display_symbol = EXCLUDED.display_symbol,
  coingecko_id = EXCLUDED.coingecko_id,
  tradingview_symbol = EXCLUDED.tradingview_symbol,
  aliases = EXCLUDED.aliases,
  updated_at = now();

-- HYPE (Hyperliquid)
INSERT INTO ticker_mappings (
  symbol, display_symbol, display_name, type,
  coingecko_id, tradingview_symbol,
  price_supported, tradingview_supported, derivs_supported, social_supported,
  aliases
) VALUES (
  'HYPE', 'HYPE', 'Hyperliquid', 'crypto',
  'hyperliquid', 'BINANCE:HYPEUSDT',
  true, true, false, true,
  ARRAY['HYPEUSDT', 'HYPE-USD', 'HYPEUSD']
) ON CONFLICT (symbol) DO UPDATE SET
  display_symbol = EXCLUDED.display_symbol,
  coingecko_id = EXCLUDED.coingecko_id,
  tradingview_symbol = EXCLUDED.tradingview_symbol,
  aliases = EXCLUDED.aliases,
  updated_at = now();

-- WETH (Wrapped Ethereum)
INSERT INTO ticker_mappings (
  symbol, display_symbol, display_name, type,
  coingecko_id, tradingview_symbol,
  price_supported, tradingview_supported, derivs_supported, social_supported,
  aliases
) VALUES (
  'WETH', 'WETH', 'Wrapped Ethereum', 'crypto',
  'weth', 'BINANCE:WETHUSDT',
  true, true, false, true,
  ARRAY['WETHUSDT', 'WETH-USD', 'WETHUSD']
) ON CONFLICT (symbol) DO UPDATE SET
  display_symbol = EXCLUDED.display_symbol,
  coingecko_id = EXCLUDED.coingecko_id,
  tradingview_symbol = EXCLUDED.tradingview_symbol,
  aliases = EXCLUDED.aliases,
  updated_at = now();

-- WEETH (Wrapped eETH)
INSERT INTO ticker_mappings (
  symbol, display_symbol, display_name, type,
  coingecko_id, tradingview_symbol,
  price_supported, tradingview_supported, derivs_supported, social_supported,
  aliases
) VALUES (
  'WEETH', 'WEETH', 'Wrapped eETH', 'crypto',
  'wrapped-eeth', 'BINANCE:WEETHUSDT',
  true, true, false, true,
  ARRAY['WEETHUSDT', 'WEETH-USD', 'WEETHUSD']
) ON CONFLICT (symbol) DO UPDATE SET
  display_symbol = EXCLUDED.display_symbol,
  coingecko_id = EXCLUDED.coingecko_id,
  tradingview_symbol = EXCLUDED.tradingview_symbol,
  aliases = EXCLUDED.aliases,
  updated_at = now();

-- WBETH (Wrapped Beacon ETH)
INSERT INTO ticker_mappings (
  symbol, display_symbol, display_name, type,
  coingecko_id, tradingview_symbol,
  price_supported, tradingview_supported, derivs_supported, social_supported,
  aliases
) VALUES (
  'WBETH', 'WBETH', 'Wrapped Beacon ETH', 'crypto',
  'wrapped-beacon-eth', 'BINANCE:WBETHUSDT',
  true, true, false, true,
  ARRAY['WBETHUSDT', 'WBETH-USD', 'WBETHUSD']
) ON CONFLICT (symbol) DO UPDATE SET
  display_symbol = EXCLUDED.display_symbol,
  coingecko_id = EXCLUDED.coingecko_id,
  tradingview_symbol = EXCLUDED.tradingview_symbol,
  aliases = EXCLUDED.aliases,
  updated_at = now();

-- FIGR_HELOC (Figure Heloc) - has CoinGecko ID but no TradingView chart
INSERT INTO ticker_mappings (
  symbol, display_symbol, display_name, type,
  coingecko_id, tradingview_symbol,
  price_supported, tradingview_supported, derivs_supported, social_supported,
  aliases
) VALUES (
  'FIGR_HELOC', 'FIGR_HELOC', 'Figure Heloc', 'crypto',
  'figr_heloc', 'CRYPTO:FIGRUSDT',
  true, false, false, false,
  ARRAY['FIGR', 'FIGRHELOC']
) ON CONFLICT (symbol) DO UPDATE SET
  display_symbol = EXCLUDED.display_symbol,
  coingecko_id = EXCLUDED.coingecko_id,
  tradingview_symbol = EXCLUDED.tradingview_symbol,
  tradingview_supported = EXCLUDED.tradingview_supported,
  aliases = EXCLUDED.aliases,
  updated_at = now();