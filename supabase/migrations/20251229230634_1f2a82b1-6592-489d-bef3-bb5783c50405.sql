-- Add LunarCrush-specific news columns to token_cards
-- Following multi-source exclusive zone principle

ALTER TABLE token_cards
ADD COLUMN IF NOT EXISTS lc_top_news jsonb DEFAULT NULL,
ADD COLUMN IF NOT EXISTS lc_news_updated_at timestamptz DEFAULT NULL,
ADD COLUMN IF NOT EXISTS news_source text DEFAULT NULL;

COMMENT ON COLUMN token_cards.lc_top_news IS 'LunarCrush social news/posts with engagement metrics';
COMMENT ON COLUMN token_cards.top_news IS 'Polygon news articles (free API)';
COMMENT ON COLUMN token_cards.news_source IS 'Primary news source: polygon or lunarcrush';