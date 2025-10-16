-- Fix CAKE/AKE confusion - Remove CAKE from AKE's aliases
UPDATE ticker_mappings 
SET aliases = array_remove(aliases, 'CAKE'),
    updated_at = now()
WHERE symbol = 'AKE';

-- Ensure CAKE (PancakeSwap) is correctly configured
UPDATE ticker_mappings
SET 
  display_name = 'PancakeSwap (CAKE)',
  tradingview_symbol = 'BINANCE:CAKEUSDT',
  polygon_ticker = 'X:CAKEUSD',
  type = 'crypto',
  is_active = true,
  tradingview_supported = true,
  price_supported = true,
  updated_at = now()
WHERE symbol = 'CAKE';

-- Add missing crypto symbols that appear in briefs
INSERT INTO ticker_mappings (symbol, display_name, tradingview_symbol, type, is_active, tradingview_supported, price_supported)
VALUES 
  ('COAI', 'ChainOpera AI', 'MEXC:COAIUSDT', 'crypto', true, true, true),
  ('ATONE', 'AtomOne', 'GATEIO:ATONEUSDT', 'crypto', true, true, true),
  ('TRAC', 'OriginTrail', 'BINANCE:TRACUSDT', 'crypto', true, true, true)
ON CONFLICT (symbol) DO UPDATE SET
  tradingview_symbol = EXCLUDED.tradingview_symbol,
  type = EXCLUDED.type,
  is_active = EXCLUDED.is_active,
  tradingview_supported = EXCLUDED.tradingview_supported,
  price_supported = EXCLUDED.price_supported,
  updated_at = now();