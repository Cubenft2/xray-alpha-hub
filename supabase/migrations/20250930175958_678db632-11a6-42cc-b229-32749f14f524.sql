-- Add correct CoinGecko IDs and aliases for problematic tokens
UPDATE public.ticker_mappings 
SET 
  coingecko_id = 'kaito-ai',
  aliases = ARRAY['KAITO', 'Kaito'],
  price_supported = true,
  tradingview_supported = false
WHERE symbol = 'KAITO';

UPDATE public.ticker_mappings 
SET 
  coingecko_id = 'superverse',
  aliases = ARRAY['SUPER', 'SuperVerse', 'SUPERVERSE'],
  price_supported = true,
  tradingview_supported = true
WHERE symbol = 'SUPER';

UPDATE public.ticker_mappings 
SET 
  coingecko_id = '0g-chain',
  aliases = ARRAY['0G', '0g'],
  price_supported = true,
  tradingview_supported = false
WHERE symbol = '0G';

UPDATE public.ticker_mappings 
SET 
  coingecko_id = 'wrapped-eeth',
  aliases = ARRAY['WEETH', 'weETH', 'Wrapped eETH'],
  price_supported = true,
  tradingview_supported = false
WHERE symbol = 'WEETH';

UPDATE public.ticker_mappings 
SET 
  coingecko_id = 'weth',
  aliases = ARRAY['WETH', 'Wrapped ETH'],
  price_supported = true,
  tradingview_supported = false
WHERE symbol = 'WETH';

UPDATE public.ticker_mappings 
SET 
  coingecko_id = 'wrapped-beacon-eth',
  aliases = ARRAY['WBETH', 'wBETH', 'Wrapped Beacon ETH'],
  price_supported = true,
  tradingview_supported = true
WHERE symbol = 'WBETH';

-- Ensure ATH has correct mapping
UPDATE public.ticker_mappings 
SET 
  coingecko_id = 'aethir',
  aliases = ARRAY['ATH', 'AETHIR', 'Aethir'],
  tradingview_symbol = 'BINANCE:ATHUSDT',
  price_supported = true,
  tradingview_supported = true
WHERE symbol = 'ATH';

-- Ensure XPL has correct mapping
UPDATE public.ticker_mappings 
SET 
  coingecko_id = 'plus-coin',
  aliases = ARRAY['XPL', 'PLASMA', 'Plasma'],
  tradingview_symbol = 'BINANCE:XPLUSDT',
  price_supported = true,
  tradingview_supported = true
WHERE symbol = 'XPL';