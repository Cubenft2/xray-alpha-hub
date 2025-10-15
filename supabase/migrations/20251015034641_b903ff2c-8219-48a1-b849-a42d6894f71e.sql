-- Update CLO (YEI Finance) with correct TradingView symbol and DEX platforms
UPDATE ticker_mappings
SET 
  display_name = 'YEI Finance',
  coingecko_id = 'yei-finance',
  tradingview_symbol = 'BINANCE:CLOUSDT',
  preferred_exchange = 'binance',
  dex_platforms = jsonb_build_object(
    'binance-smart-chain', '0x81d3a238b02827f62b9f390f947d36d4a5bf89d2',
    'sei', '0x81d3a238b02827f62b9f390f947d36d4a5bf89d2'
  ),
  dex_address = '0x81d3a238b02827f62b9f390f947d36d4a5bf89d2',
  dex_chain = 'binance-smart-chain',
  aliases = ARRAY['CLOUSDT', 'CLOUSD', 'CLO', 'YEI'],
  tradingview_supported = true,
  type = 'crypto',
  updated_at = now()
WHERE symbol = 'CLO';

-- Update EDU (Open Campus) with DEX platforms and ensure correct CoinGecko ID
UPDATE ticker_mappings
SET 
  dex_platforms = jsonb_build_object(
    'ethereum', '0x26aad156ba8efa501b32b42ffcdc8413f90e9c99',
    'binance-smart-chain', '0xbdeae1ca48894a1759a8374d63925f21f2ee2639',
    'arbitrum-one', '0xf8173a39c56a554837c4c7f104153a005d284d11'
  ),
  dex_address = '0x26aad156ba8efa501b32b42ffcdc8413f90e9c99',
  dex_chain = 'ethereum',
  aliases = ARRAY['EDUUSDT', 'EDUUSD', 'EDU'],
  coingecko_id = 'edu-coin',
  tradingview_symbol = 'BINANCE:EDUUSDT',
  preferred_exchange = 'binance',
  type = 'crypto',
  updated_at = now()
WHERE symbol = 'EDU';