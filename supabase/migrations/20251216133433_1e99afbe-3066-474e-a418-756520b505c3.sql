
-- Insert ONLY truly missing crypto-related stocks into polygon_assets
INSERT INTO polygon_assets (asset_id, polygon_ticker, market, is_active)
VALUES
  ('ab824cef-5bb0-453c-be0e-cf3ff7f49688', 'MSTR', 'stocks', true),
  ('6636384b-fa9a-419b-ba3d-982f5458bba3', 'MARA', 'stocks', true),
  ('1e92a6cc-3e52-4b07-847d-4ae4be7a7785', 'RIOT', 'stocks', true),
  ('0adab295-ee43-40e1-8c6d-33095e203c6d', 'CLSK', 'stocks', true),
  ('55a3015d-e9b5-40a0-b615-24c0f8212803', 'HOOD', 'stocks', true),
  ('a7423e1a-612e-4417-8376-41c96d65708b', 'BITF', 'stocks', true),
  ('f7fb868f-d6ed-4d52-8c40-ba85ebfbd20e', 'HUT', 'stocks', true),
  ('8acddc14-5522-45a2-baef-ff1b777cf061', 'HIVE', 'stocks', true)
ON CONFLICT (polygon_ticker) DO UPDATE SET is_active = true;
