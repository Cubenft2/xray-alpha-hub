-- Create audit table for market brief generations
CREATE TABLE IF NOT EXISTS public.market_brief_audits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brief_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  provider_status JSONB NOT NULL DEFAULT '{}'::jsonb,
  missing_symbols TEXT[] NOT NULL DEFAULT '{}',
  notes TEXT
);

-- Index for lookups by brief
CREATE INDEX IF NOT EXISTS idx_market_brief_audits_brief_id ON public.market_brief_audits (brief_id);

-- Enable RLS
ALTER TABLE public.market_brief_audits ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Allow public read access to market_brief_audits"
ON public.market_brief_audits
FOR SELECT
USING (true);

CREATE POLICY "Service role full access to market_brief_audits"
ON public.market_brief_audits
FOR ALL
USING (true)
WITH CHECK (true);
