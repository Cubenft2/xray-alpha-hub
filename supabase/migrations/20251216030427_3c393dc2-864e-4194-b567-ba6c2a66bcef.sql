-- Add source tracking columns to token_cards
ALTER TABLE public.token_cards ADD COLUMN IF NOT EXISTS price_source text;
ALTER TABLE public.token_cards ADD COLUMN IF NOT EXISTS technicals_source text;
ALTER TABLE public.token_cards ADD COLUMN IF NOT EXISTS social_source text;

-- Add comments for documentation
COMMENT ON COLUMN public.token_cards.price_source IS 'Source of price data: polygon (1-min), lunarcrush (2-min)';
COMMENT ON COLUMN public.token_cards.technicals_source IS 'Source of technical indicators: polygon (3-min), coingecko (4-hr)';
COMMENT ON COLUMN public.token_cards.social_source IS 'Source of social data: lunarcrush (always)';