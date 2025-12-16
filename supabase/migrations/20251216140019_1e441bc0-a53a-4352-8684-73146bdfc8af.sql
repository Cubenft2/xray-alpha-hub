
-- Fix stock master cards issues (handling foreign key constraints)

-- 1. Add missing big tech to polygon_assets
INSERT INTO polygon_assets (asset_id, polygon_ticker, market, is_active)
SELECT id, symbol, 'stocks', true
FROM assets
WHERE symbol IN ('AAPL', 'MSFT', 'TSLA', 'META')
AND id NOT IN (SELECT asset_id FROM polygon_assets WHERE polygon_ticker IN ('AAPL', 'MSFT', 'TSLA', 'META'))
ON CONFLICT (asset_id) DO NOTHING;

-- 2. Fix GOOGL polygon_assets to point to correct asset (not OOGL)
UPDATE polygon_assets 
SET asset_id = (SELECT id FROM assets WHERE symbol = 'GOOGL' LIMIT 1)
WHERE polygon_ticker = 'GOOGL';

-- 3. Update live_prices referencing OIN to reference correct COIN asset
UPDATE live_prices 
SET asset_id = (SELECT id FROM assets WHERE symbol = 'COIN' AND name = 'Coinbase (COIN)')
WHERE asset_id = (SELECT id FROM assets WHERE symbol = 'OIN');

-- 4. Update live_prices referencing OOGL to reference correct GOOGL asset
UPDATE live_prices 
SET asset_id = (SELECT id FROM assets WHERE symbol = 'GOOGL')
WHERE asset_id = (SELECT id FROM assets WHERE symbol = 'OOGL');

-- 5. Delete polygon_assets entries referencing the typos
DELETE FROM polygon_assets WHERE asset_id = (SELECT id FROM assets WHERE symbol = 'OIN');
DELETE FROM polygon_assets WHERE asset_id = (SELECT id FROM assets WHERE symbol = 'OOGL');

-- 6. Delete coingecko_assets entries referencing the typos
DELETE FROM coingecko_assets WHERE asset_id = (SELECT id FROM assets WHERE symbol = 'OIN');
DELETE FROM coingecko_assets WHERE asset_id = (SELECT id FROM assets WHERE symbol = 'OOGL');

-- 7. Delete lunarcrush_assets entries referencing the typos
DELETE FROM lunarcrush_assets WHERE asset_id = (SELECT id FROM assets WHERE symbol = 'OIN');
DELETE FROM lunarcrush_assets WHERE asset_id = (SELECT id FROM assets WHERE symbol = 'OOGL');

-- 8. Now delete duplicate/typo entries from assets table
DELETE FROM assets WHERE symbol = 'OIN';
DELETE FROM assets WHERE symbol = 'OOGL';
