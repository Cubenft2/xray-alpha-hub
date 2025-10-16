-- Update CAKE symbol to have AKE as an alias instead of separate entry
-- This fixes the issue where AKE (Akedo) was being confused with CAKE (PancakeSwap)

UPDATE ticker_mappings 
SET aliases = CASE 
  WHEN 'CAKE' = ANY(COALESCE(aliases, ARRAY[]::text[])) THEN aliases
  ELSE array_append(COALESCE(aliases, ARRAY[]::text[]), 'CAKE')
END,
updated_at = now()
WHERE symbol = 'AKE' AND display_name = 'Akedo';

-- Ensure CAKE (PancakeSwap) is the primary entry
UPDATE ticker_mappings
SET 
  display_name = 'PancakeSwap (CAKE)',
  tradingview_symbol = 'BINANCE:CAKEUSDT',
  polygon_ticker = 'X:CAKEUSD',
  type = 'crypto',
  updated_at = now()
WHERE symbol = 'CAKE';