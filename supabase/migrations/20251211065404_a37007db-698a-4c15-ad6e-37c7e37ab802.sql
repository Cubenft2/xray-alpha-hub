-- Add new columns to crypto_snapshot for LunarCrush data
ALTER TABLE crypto_snapshot 
ADD COLUMN IF NOT EXISTS percent_change_1h numeric,
ADD COLUMN IF NOT EXISTS percent_change_7d numeric,
ADD COLUMN IF NOT EXISTS galaxy_score numeric,
ADD COLUMN IF NOT EXISTS alt_rank integer,
ADD COLUMN IF NOT EXISTS sentiment numeric,
ADD COLUMN IF NOT EXISTS social_volume_24h integer,
ADD COLUMN IF NOT EXISTS social_dominance numeric,
ADD COLUMN IF NOT EXISTS interactions_24h integer,
ADD COLUMN IF NOT EXISTS categories jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS blockchains jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS lunarcrush_id text;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_crypto_snapshot_lunarcrush_id ON crypto_snapshot(lunarcrush_id);
CREATE INDEX IF NOT EXISTS idx_crypto_snapshot_galaxy_score ON crypto_snapshot(galaxy_score DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_crypto_snapshot_alt_rank ON crypto_snapshot(alt_rank ASC NULLS LAST);