-- Add 52-week high/low columns to stock_cards
ALTER TABLE stock_cards ADD COLUMN IF NOT EXISTS high_52w NUMERIC;
ALTER TABLE stock_cards ADD COLUMN IF NOT EXISTS low_52w NUMERIC;
ALTER TABLE stock_cards ADD COLUMN IF NOT EXISTS high_52w_date DATE;
ALTER TABLE stock_cards ADD COLUMN IF NOT EXISTS low_52w_date DATE;

-- Create index for efficient 52-week queries
CREATE INDEX IF NOT EXISTS idx_stock_cards_52w ON stock_cards (high_52w, low_52w) WHERE high_52w IS NOT NULL;