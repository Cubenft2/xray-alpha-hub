-- Add enrichment tracking columns to cg_master
ALTER TABLE cg_master 
ADD COLUMN IF NOT EXISTS enriched_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS enrichment_status TEXT DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS enrichment_error TEXT;

-- Create index for faster queries on enrichment status
CREATE INDEX IF NOT EXISTS idx_cg_master_enrichment_status ON cg_master(enrichment_status);
CREATE INDEX IF NOT EXISTS idx_cg_master_enriched_at ON cg_master(enriched_at);

-- Add comment explaining enrichment status values
COMMENT ON COLUMN cg_master.enrichment_status IS 'Status values: pending (not yet enriched), enriched (successfully enriched), no_platforms (coin has no platforms like BTC), error (failed to enrich)';