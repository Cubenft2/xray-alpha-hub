-- Insert missing ticker mappings (use INSERT ON CONFLICT to handle if they exist)
INSERT INTO public.ticker_mappings (
  symbol,
  display_name,
  type,
  coingecko_id,
  aliases,
  tradingview_symbol,
  tradingview_supported,
  price_supported,
  derivs_supported,
  social_supported,
  is_active
) VALUES
  ('ATH', 'Aethir (ATH)', 'crypto', 'aethir', ARRAY['ATH', 'AETHIR', 'Aethir'], 'BINANCE:ATHUSDT', true, true, false, false, true),
  ('KAITO', 'Kaito (KAITO)', 'crypto', 'kaito-ai', ARRAY['KAITO', 'Kaito'], 'CRYPTO:KAITOUSD', false, true, false, false, true),
  ('SUPER', 'SuperVerse (SUPER)', 'crypto', 'superverse', ARRAY['SUPER', 'SuperVerse', 'SUPERVERSE'], 'BINANCE:SUPERUSDT', true, true, false, false, true),
  ('0G', '0G (0G)', 'crypto', '0g-chain', ARRAY['0G', '0g'], 'CRYPTO:0GUSD', false, true, false, false, true),
  ('WEETH', 'Wrapped eETH (WEETH)', 'crypto', 'wrapped-eeth', ARRAY['WEETH', 'weETH', 'Wrapped eETH'], 'BINANCE:WEETHUSDT', false, true, false, false, true),
  ('WETH', 'Wrapped ETH (WETH)', 'crypto', 'wETH', ARRAY['WETH', 'Wrapped ETH'], 'BINANCE:WETHUSDT', false, true, false, false, true),
  ('WBETH', 'Wrapped Beacon ETH (WBETH)', 'crypto', 'wrapped-beacon-eth', ARRAY['WBETH', 'wBETH', 'Wrapped Beacon ETH'], 'BINANCE:WBETHUSDT', true, true, false, false, true),
  ('XPL', 'Plasma (XPL)', 'crypto', 'plus-coin', ARRAY['XPL', 'PLASMA', 'Plasma'], 'BINANCE:XPLUSDT', true, true, false, false, true)
ON CONFLICT (symbol) DO UPDATE SET
  coingecko_id = EXCLUDED.coingecko_id,
  aliases = EXCLUDED.aliases,
  tradingview_symbol = EXCLUDED.tradingview_symbol,
  tradingview_supported = EXCLUDED.tradingview_supported,
  price_supported = EXCLUDED.price_supported,
  display_name = EXCLUDED.display_name,
  updated_at = now();