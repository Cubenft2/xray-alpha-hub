-- Add missing columns to stock_cards for complete Polygon data flow
ALTER TABLE stock_cards ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE stock_cards ADD COLUMN IF NOT EXISTS employees INTEGER;
ALTER TABLE stock_cards ADD COLUMN IF NOT EXISTS website TEXT;
ALTER TABLE stock_cards ADD COLUMN IF NOT EXISTS headquarters JSONB DEFAULT '{}';
ALTER TABLE stock_cards ADD COLUMN IF NOT EXISTS financials JSONB DEFAULT '[]';
ALTER TABLE stock_cards ADD COLUMN IF NOT EXISTS dividends JSONB DEFAULT '[]';
ALTER TABLE stock_cards ADD COLUMN IF NOT EXISTS splits JSONB DEFAULT '[]';
ALTER TABLE stock_cards ADD COLUMN IF NOT EXISTS related_companies JSONB DEFAULT '[]';
ALTER TABLE stock_cards ADD COLUMN IF NOT EXISTS cik TEXT;
ALTER TABLE stock_cards ADD COLUMN IF NOT EXISTS sic_code TEXT;
ALTER TABLE stock_cards ADD COLUMN IF NOT EXISTS sic_description TEXT;
ALTER TABLE stock_cards ADD COLUMN IF NOT EXISTS list_date DATE;
ALTER TABLE stock_cards ADD COLUMN IF NOT EXISTS icon_url TEXT;