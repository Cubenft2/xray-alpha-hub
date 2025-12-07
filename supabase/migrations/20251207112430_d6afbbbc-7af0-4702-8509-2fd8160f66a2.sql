-- Create company_details table for caching Polygon.io company information
CREATE TABLE public.company_details (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticker TEXT UNIQUE NOT NULL,
  name TEXT,
  description TEXT,
  sector TEXT,
  industry TEXT,
  market_cap BIGINT,
  employees INTEGER,
  headquarters JSONB DEFAULT '{}'::jsonb,
  website TEXT,
  logo_url TEXT,
  icon_url TEXT,
  list_date DATE,
  cik TEXT,
  sic_code TEXT,
  sic_description TEXT,
  last_financials JSONB DEFAULT '[]'::jsonb,
  dividends JSONB DEFAULT '[]'::jsonb,
  splits JSONB DEFAULT '[]'::jsonb,
  related_companies JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  fetched_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '24 hours',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for fast ticker lookups
CREATE INDEX idx_company_details_ticker ON public.company_details(ticker);

-- Create index for cache expiration cleanup
CREATE INDEX idx_company_details_expires_at ON public.company_details(expires_at);

-- Enable RLS
ALTER TABLE public.company_details ENABLE ROW LEVEL SECURITY;

-- Allow public read access (cached data is not sensitive)
CREATE POLICY "Allow public read access to company_details"
ON public.company_details
FOR SELECT
USING (true);

-- Allow service role full access for edge functions
CREATE POLICY "Service role full access to company_details"
ON public.company_details
FOR ALL
USING (true)
WITH CHECK (true);

-- Add trigger for updated_at
CREATE TRIGGER update_company_details_updated_at
BEFORE UPDATE ON public.company_details
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();