-- Create table for real LunarCrush AI summaries (top 25 tokens)
CREATE TABLE public.lunarcrush_ai_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  canonical_symbol TEXT NOT NULL UNIQUE,
  name TEXT,
  
  -- AI-generated content (parsed from markdown)
  headline TEXT,
  about TEXT,
  insights JSONB DEFAULT '[]'::jsonb,
  price_analysis TEXT,
  
  -- Sentiment analysis
  sentiment_pct NUMERIC,
  supportive_themes JSONB DEFAULT '[]'::jsonb,
  critical_themes JSONB DEFAULT '[]'::jsonb,
  
  -- Social metrics from the response
  galaxy_score NUMERIC,
  alt_rank INTEGER,
  engagements_24h BIGINT,
  mentions_24h BIGINT,
  social_dominance_pct NUMERIC,
  creators_24h INTEGER,
  
  -- Top content
  top_creators JSONB DEFAULT '[]'::jsonb,
  top_news JSONB DEFAULT '[]'::jsonb,
  top_posts JSONB DEFAULT '[]'::jsonb,
  
  -- Raw storage for debugging
  raw_markdown TEXT,
  
  -- Timestamps
  fetched_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create index on symbol for fast lookups
CREATE INDEX idx_lunarcrush_ai_summaries_symbol ON public.lunarcrush_ai_summaries(canonical_symbol);

-- Create index on fetched_at for freshness queries
CREATE INDEX idx_lunarcrush_ai_summaries_fetched ON public.lunarcrush_ai_summaries(fetched_at DESC);

-- Enable RLS
ALTER TABLE public.lunarcrush_ai_summaries ENABLE ROW LEVEL SECURITY;

-- Public read access
CREATE POLICY "Allow public read access to lunarcrush_ai_summaries"
  ON public.lunarcrush_ai_summaries
  FOR SELECT
  USING (true);

-- Service role full access
CREATE POLICY "Service role full access to lunarcrush_ai_summaries"
  ON public.lunarcrush_ai_summaries
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Add trigger for updated_at
CREATE TRIGGER update_lunarcrush_ai_summaries_updated_at
  BEFORE UPDATE ON public.lunarcrush_ai_summaries
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();