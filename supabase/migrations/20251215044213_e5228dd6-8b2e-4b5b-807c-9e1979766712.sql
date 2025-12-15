-- Add polygon_supported boolean column to token_cards
ALTER TABLE token_cards ADD COLUMN IF NOT EXISTS polygon_supported boolean DEFAULT false;

-- Populate based on actual Polygon coverage (tokens that received Polygon price updates)
UPDATE token_cards 
SET polygon_supported = true 
WHERE price_updated_at IS NOT NULL 
  AND price_updated_at > NOW() - INTERVAL '1 hour';

-- Create index for filtering
CREATE INDEX IF NOT EXISTS idx_token_cards_polygon_supported ON token_cards(polygon_supported);