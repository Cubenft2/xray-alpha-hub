
-- Fix incorrect symbol mappings based on actual database data

-- 1. Fix ATONE (AtomOne) - correct TradingView symbol
UPDATE ticker_mappings
SET 
  display_name = 'AtomOne',
  tradingview_symbol = 'ATONEUSD',
  coingecko_id = 'atomone',
  type = 'crypto',
  is_active = true,
  tradingview_supported = true,
  price_supported = true,
  updated_at = now()
WHERE symbol = 'ATONE';

-- 2. Add BLESS - Kraken with USD pair
INSERT INTO ticker_mappings (symbol, display_name, tradingview_symbol, coingecko_id, type, is_active, tradingview_supported, price_supported)
VALUES ('BLESS', 'Bless', 'KRAKEN:BLESSUSD', 'bless-2', 'crypto', true, true, true)
ON CONFLICT (symbol) DO UPDATE SET
  tradingview_symbol = 'KRAKEN:BLESSUSD',
  coingecko_id = 'bless-2',
  type = 'crypto',
  tradingview_supported = true,
  price_supported = true,
  updated_at = now();

-- 3. Add AKI - TradingView AKIUSD
INSERT INTO ticker_mappings (symbol, display_name, tradingview_symbol, type, is_active, tradingview_supported, price_supported)
VALUES ('AKI', 'AKI', 'AKIUSD', 'crypto', true, true, true)
ON CONFLICT (symbol) DO UPDATE SET
  tradingview_symbol = 'AKIUSD',
  type = 'crypto',
  tradingview_supported = true,
  price_supported = true,
  updated_at = now();

-- 4. Fix TRAC (OriginTrail) - use correct Polygon data
UPDATE ticker_mappings
SET 
  display_name = 'OriginTrail',
  tradingview_symbol = 'TRACUSD',
  polygon_ticker = 'X:TRACUSD',
  coingecko_id = 'origintrail',
  type = 'crypto',
  is_active = true,
  tradingview_supported = true,
  price_supported = true,
  updated_at = now()
WHERE symbol = 'TRAC';

-- 5. Remove incorrect RAC entry if it exists
DELETE FROM ticker_mappings WHERE symbol = 'RAC';
