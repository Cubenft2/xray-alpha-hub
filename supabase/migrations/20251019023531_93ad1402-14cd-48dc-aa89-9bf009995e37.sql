-- Add word_count column to market_briefs table
ALTER TABLE market_briefs ADD COLUMN IF NOT EXISTS word_count INTEGER;

COMMENT ON COLUMN market_briefs.word_count IS 'Total word count of the generated brief content';