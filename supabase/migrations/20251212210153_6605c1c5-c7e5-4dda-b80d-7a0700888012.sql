-- Create derivatives_cache table for caching CoinGlass funding rates
CREATE TABLE IF NOT EXISTS public.derivatives_cache (
  symbol text PRIMARY KEY,
  funding_rate numeric,
  open_interest numeric,
  liquidations_24h jsonb DEFAULT '{}'::jsonb,
  source text DEFAULT 'coinglass',
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.derivatives_cache ENABLE ROW LEVEL SECURITY;

-- Public can read, service role can write
CREATE POLICY "Allow public read derivatives_cache" ON public.derivatives_cache FOR SELECT USING (true);
CREATE POLICY "Service role write derivatives_cache" ON public.derivatives_cache FOR ALL USING (true);

-- Create news_cache table for caching Tavily news searches
CREATE TABLE IF NOT EXISTS public.news_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol text NOT NULL,
  title text NOT NULL,
  source text,
  url text,
  published_at timestamptz,
  summary text,
  created_at timestamptz DEFAULT now()
);

-- Index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_news_cache_symbol_time ON public.news_cache(symbol, created_at DESC);

-- Enable RLS
ALTER TABLE public.news_cache ENABLE ROW LEVEL SECURITY;

-- Public can read, service role can write
CREATE POLICY "Allow public read news_cache" ON public.news_cache FOR SELECT USING (true);
CREATE POLICY "Service role write news_cache" ON public.news_cache FOR ALL USING (true);