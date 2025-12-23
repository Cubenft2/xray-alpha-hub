-- Add in_polygon column to track tokens available in Polygon WebSocket stream
ALTER TABLE token_cards ADD COLUMN IF NOT EXISTS in_polygon BOOLEAN DEFAULT FALSE;

-- Create index for filtering
CREATE INDEX IF NOT EXISTS idx_token_cards_in_polygon ON token_cards(in_polygon) WHERE in_polygon = TRUE;