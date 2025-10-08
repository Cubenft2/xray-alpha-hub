-- Create social_sentiment_cache table for LunarCrush AI Agent data
CREATE TABLE public.social_sentiment_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  data JSONB NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast querying of latest active data
CREATE INDEX idx_social_sentiment_cache_active 
ON public.social_sentiment_cache(is_active, received_at DESC) 
WHERE is_active = true;

-- Enable RLS
ALTER TABLE public.social_sentiment_cache ENABLE ROW LEVEL SECURITY;

-- Allow public read access to active data
CREATE POLICY "Allow public read access to active social_sentiment_cache"
ON public.social_sentiment_cache FOR SELECT
USING (is_active = true);

-- Allow service role full access
CREATE POLICY "Allow service role full access to social_sentiment_cache"
ON public.social_sentiment_cache FOR ALL
USING (true)
WITH CHECK (true);