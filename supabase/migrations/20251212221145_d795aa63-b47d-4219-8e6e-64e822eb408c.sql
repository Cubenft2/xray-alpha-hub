-- Create crypto_details cache table for CoinGecko fundamentals
CREATE TABLE IF NOT EXISTS public.crypto_details (
  symbol TEXT PRIMARY KEY,
  coingecko_id TEXT,
  name TEXT,
  description TEXT,
  categories TEXT[] DEFAULT '{}',
  links JSONB DEFAULT '{}'::jsonb,
  image JSONB DEFAULT '{}'::jsonb,
  market JSONB DEFAULT '{}'::jsonb,
  supply JSONB DEFAULT '{}'::jsonb,
  developer JSONB DEFAULT '{}'::jsonb,
  community JSONB DEFAULT '{}'::jsonb,
  source TEXT DEFAULT 'coingecko',
  updated_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ DEFAULT (now() + interval '24 hours')
);

-- Indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_crypto_details_coingecko_id ON public.crypto_details(coingecko_id);
CREATE INDEX IF NOT EXISTS idx_crypto_details_expires ON public.crypto_details(expires_at);

-- Enable RLS
ALTER TABLE public.crypto_details ENABLE ROW LEVEL SECURITY;

-- Public read access
CREATE POLICY "Allow public read crypto_details"
ON public.crypto_details FOR SELECT
USING (true);

-- Service role write access
CREATE POLICY "Service role write crypto_details"
ON public.crypto_details FOR ALL
USING (true);