-- Ensure BORG and XAN are correctly mapped as crypto
-- Remove existing conflicting mappings
DELETE FROM public.ticker_mappings WHERE symbol IN ('BORG','XAN');

-- Insert BORG (SwissBorg rebrand) mapping
INSERT INTO public.ticker_mappings (
  symbol, display_name, type, tradingview_symbol, tradingview_supported, price_supported, social_supported,
  coingecko_id, dex_chain, dex_address, aliases, is_active
) VALUES (
  'BORG', 'BORG', 'crypto', 'BORGUSD', false, true, true,
  'swissborg', 'ethereum', '0x64d0f55Cd8C7133a9D7102b13987235F486F2224', ARRAY['SWISSBORG','CHSB','BORG'], true
);

-- Insert XAN (Anoma) mapping
INSERT INTO public.ticker_mappings (
  symbol, display_name, type, tradingview_symbol, tradingview_supported, price_supported, social_supported,
  coingecko_id, aliases, is_active
) VALUES (
  'XAN', 'Anoma (XAN)', 'crypto', 'XANUSD', false, true, true,
  'anoma', ARRAY['ANOMA','XAN'], true
);
