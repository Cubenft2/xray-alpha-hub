-- Add multi-chain address support to ticker_mappings
ALTER TABLE ticker_mappings 
ADD COLUMN IF NOT EXISTS dex_platforms JSONB DEFAULT '{}';

-- Create index for efficient querying
CREATE INDEX IF NOT EXISTS idx_ticker_mappings_dex_platforms ON ticker_mappings USING gin(dex_platforms);

-- Migrate existing single-chain data to new format
UPDATE ticker_mappings
SET dex_platforms = jsonb_build_object(
  LOWER(REPLACE(dex_chain, ' ', '-')), 
  dex_address
)
WHERE dex_address IS NOT NULL 
  AND dex_chain IS NOT NULL 
  AND dex_platforms = '{}';

-- Add Humanity (H) token with multi-chain addresses
INSERT INTO ticker_mappings (
  symbol,
  display_name,
  tradingview_symbol,
  type,
  coingecko_id,
  dex_platforms,
  is_active,
  tradingview_supported
) VALUES (
  'H',
  'Humanity',
  'CRYPTO:HUSD',
  'crypto',
  'humanity',
  '{"ethereum": "0xcf5104d094e3864cfcbda43b82e1cefd26a016eb", "binance-smart-chain": "0x44f161ae29361e332dea039dfa2f404e0bc5b5cc"}'::jsonb,
  true,
  false
)
ON CONFLICT (symbol) 
DO UPDATE SET
  coingecko_id = EXCLUDED.coingecko_id,
  dex_platforms = EXCLUDED.dex_platforms,
  display_name = EXCLUDED.display_name;