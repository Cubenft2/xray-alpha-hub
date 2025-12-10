-- Insert missing polygon_assets mappings for BTC, SOL, ADA
INSERT INTO polygon_assets (asset_id, polygon_ticker, market, is_active)
VALUES 
  ('58a5306a-7fd6-4fe1-b2a3-c8c392b86dba', 'X:BTCUSD', 'crypto', true),
  ('be6b1b3f-15b7-435f-a3e2-93cd18d678be', 'X:SOLUSD', 'crypto', true),
  ('1bf9e18d-035b-43ef-a1bc-3fc550abe770', 'X:ADAUSD', 'crypto', true)
ON CONFLICT (asset_id) DO NOTHING;