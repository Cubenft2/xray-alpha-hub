-- Fix ATH to be crypto type and ensure all tokens have correct configuration

-- Update ATH to be crypto (currently might be missing type or wrong type)
UPDATE ticker_mappings 
SET type = 'crypto',
    tradingview_symbol = 'CRYPTO:ATHUSDT'
WHERE symbol = 'ATH';

-- Verify XPL is crypto (should already be fixed from previous migration)
UPDATE ticker_mappings 
SET type = 'crypto',
    tradingview_symbol = 'CRYPTO:XPLUSD'
WHERE symbol IN ('XPL', 'PLASMA')
  AND type != 'crypto';

-- Clear cache for these symbols to force fresh data fetch
DELETE FROM cache_kv 
WHERE k LIKE '%quotes%' 
  AND (k LIKE '%KAITO%' OR k LIKE '%0G%' OR k LIKE '%SUPER%' OR k LIKE '%ATH%' OR k LIKE '%XPL%');