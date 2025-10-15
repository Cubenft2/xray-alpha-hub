-- Create price cache table for reliable fallback data
CREATE TABLE IF NOT EXISTS public.price_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol text NOT NULL,
  price numeric NOT NULL,
  source text NOT NULL,
  cached_at timestamp with time zone NOT NULL DEFAULT now(),
  expires_at timestamp with time zone NOT NULL DEFAULT (now() + interval '1 hour'),
  metadata jsonb DEFAULT '{}'::jsonb,
  CONSTRAINT unique_symbol_cache UNIQUE(symbol)
);

-- Enable RLS
ALTER TABLE public.price_cache ENABLE ROW LEVEL SECURITY;

-- Allow public read access to non-expired cache
CREATE POLICY "Allow public read access to valid price_cache"
ON public.price_cache FOR SELECT
USING (expires_at > now());

-- Allow service role full access
CREATE POLICY "Service role full access to price_cache"
ON public.price_cache FOR ALL
USING (true)
WITH CHECK (true);

-- Create index for faster lookups
CREATE INDEX idx_price_cache_symbol ON public.price_cache(symbol);
CREATE INDEX idx_price_cache_expires_at ON public.price_cache(expires_at);

-- Add function to cleanup expired cache entries
CREATE OR REPLACE FUNCTION public.cleanup_expired_price_cache()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.price_cache WHERE expires_at < now();
END;
$$;