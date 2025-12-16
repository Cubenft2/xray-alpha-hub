-- Add missing LunarCrush bulk API fields to token_cards

-- Price/Market fields
ALTER TABLE token_cards ADD COLUMN IF NOT EXISTS change_30d_pct NUMERIC;
ALTER TABLE token_cards ADD COLUMN IF NOT EXISTS volatility NUMERIC;
ALTER TABLE token_cards ADD COLUMN IF NOT EXISTS market_dominance NUMERIC;
ALTER TABLE token_cards ADD COLUMN IF NOT EXISTS circulating_supply NUMERIC;
ALTER TABLE token_cards ADD COLUMN IF NOT EXISTS max_supply NUMERIC;

-- Social rank tracking fields
ALTER TABLE token_cards ADD COLUMN IF NOT EXISTS alt_rank_previous INTEGER;
ALTER TABLE token_cards ADD COLUMN IF NOT EXISTS alt_rank_change INTEGER;
ALTER TABLE token_cards ADD COLUMN IF NOT EXISTS galaxy_score_previous INTEGER;
ALTER TABLE token_cards ADD COLUMN IF NOT EXISTS galaxy_score_change INTEGER;

-- Add comments for documentation
COMMENT ON COLUMN token_cards.change_30d_pct IS 'Price change over 30 days from LunarCrush';
COMMENT ON COLUMN token_cards.volatility IS 'Price volatility metric from LunarCrush';
COMMENT ON COLUMN token_cards.market_dominance IS 'Market dominance percentage from LunarCrush';
COMMENT ON COLUMN token_cards.circulating_supply IS 'Circulating supply from LunarCrush';
COMMENT ON COLUMN token_cards.max_supply IS 'Maximum supply from LunarCrush';
COMMENT ON COLUMN token_cards.alt_rank_previous IS 'Previous AltRank value for change calculation';
COMMENT ON COLUMN token_cards.alt_rank_change IS 'Change in AltRank (positive = improved)';
COMMENT ON COLUMN token_cards.galaxy_score_previous IS 'Previous Galaxy Score value';
COMMENT ON COLUMN token_cards.galaxy_score_change IS 'Change in Galaxy Score';