
-- Add COIN to polygon_assets
INSERT INTO polygon_assets (asset_id, polygon_ticker, market, is_active)
SELECT id, 'COIN', 'stocks', true
FROM assets
WHERE symbol = 'COIN' AND name = 'Coinbase (COIN)'
ON CONFLICT (asset_id) DO NOTHING;
