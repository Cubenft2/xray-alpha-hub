-- Update ticker_mappings with coingecko_id from cg_master table
-- Match by normalized symbol comparison

UPDATE ticker_mappings tm
SET coingecko_id = cg.cg_id,
    updated_at = now()
FROM cg_master cg
WHERE tm.coingecko_id IS NULL
  AND tm.type = 'crypto'
  AND (
    -- Direct symbol match
    UPPER(TRIM(tm.symbol)) = UPPER(TRIM(cg.symbol))
    -- Or match display name to CoinGecko name
    OR LOWER(TRIM(tm.display_name)) = LOWER(TRIM(cg.name))
    -- Or match against CoinGecko ID (e.g., BTC -> bitcoin)
    OR UPPER(TRIM(tm.symbol)) = UPPER(TRIM(cg.cg_id))
  );

-- Log how many were updated
DO $$
DECLARE
  updated_count INTEGER;
BEGIN
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Updated % ticker mappings with CoinGecko IDs', updated_count;
END $$;