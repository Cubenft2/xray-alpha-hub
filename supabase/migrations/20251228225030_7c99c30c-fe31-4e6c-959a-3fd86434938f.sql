-- Add AI summary columns to token_cards
ALTER TABLE public.token_cards
ADD COLUMN IF NOT EXISTS ai_summary text,
ADD COLUMN IF NOT EXISTS ai_summary_updated_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS ai_token_cost integer;

-- Create LunarCrush AI usage tracking table
CREATE TABLE IF NOT EXISTS public.lunarcrush_ai_usage (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  date date NOT NULL DEFAULT CURRENT_DATE,
  tokens_used integer NOT NULL DEFAULT 0,
  calls_made integer NOT NULL DEFAULT 0,
  source text NOT NULL DEFAULT 'sync',
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE(date, source)
);

-- Enable RLS
ALTER TABLE public.lunarcrush_ai_usage ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Allow public read access to lunarcrush_ai_usage"
ON public.lunarcrush_ai_usage FOR SELECT
USING (true);

CREATE POLICY "Service role full access to lunarcrush_ai_usage"
ON public.lunarcrush_ai_usage FOR ALL
USING (true)
WITH CHECK (true);

-- Index for efficient date lookups
CREATE INDEX IF NOT EXISTS idx_lunarcrush_ai_usage_date ON public.lunarcrush_ai_usage(date);

-- Index for AI summary freshness queries
CREATE INDEX IF NOT EXISTS idx_token_cards_ai_summary_updated ON public.token_cards(ai_summary_updated_at);