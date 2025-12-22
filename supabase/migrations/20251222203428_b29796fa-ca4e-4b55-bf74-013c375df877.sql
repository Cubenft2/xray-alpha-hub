-- Mark MATIC as deprecated (token migrated to POL in September 2024)
-- CoinGecko no longer provides price data for matic-network
UPDATE token_cards 
SET 
  is_active = false,
  tier_reason = 'deprecated_migrated_to_POL'
WHERE canonical_symbol = 'MATIC';

-- Add a comment explaining the deprecation
COMMENT ON TABLE polygon_crypto_cards IS 'DEPRECATED: This table is no longer used. All Polygon crypto data now flows through sync-token-cards-polygon → token_cards table. Kept for historical reference only.';