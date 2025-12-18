-- Add exchange mapping columns to token_cards
ALTER TABLE token_cards ADD COLUMN IF NOT EXISTS exchanges jsonb DEFAULT '[]';
ALTER TABLE token_cards ADD COLUMN IF NOT EXISTS best_exchange text;
ALTER TABLE token_cards ADD COLUMN IF NOT EXISTS tradingview_symbol text;

-- Clean up invalid polygon_tickers that don't actually exist in Polygon
-- Set polygon_supported = false and polygon_ticker = NULL for tokens not in poly_tickers
UPDATE token_cards tc
SET polygon_ticker = NULL,
    polygon_supported = false
WHERE polygon_ticker IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM poly_tickers pt 
    WHERE pt.ticker = tc.polygon_ticker
    AND pt.market = 'crypto'
    AND pt.active = true
  );

-- Create index for faster exchange lookups
CREATE INDEX IF NOT EXISTS idx_token_cards_best_exchange ON token_cards(best_exchange);
CREATE INDEX IF NOT EXISTS idx_token_cards_tradingview_symbol ON token_cards(tradingview_symbol);