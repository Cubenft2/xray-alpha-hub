-- Create cache table for API responses
CREATE TABLE public.cache_kv (
  k TEXT PRIMARY KEY,
  v JSONB NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.cache_kv ENABLE ROW LEVEL SECURITY;

-- Create policy for service role full access
CREATE POLICY "Service role full access to cache_kv" 
ON public.cache_kv 
FOR ALL 
USING (true)
WITH CHECK (true);

-- Create function to clean up expired cache entries
CREATE OR REPLACE FUNCTION public.cleanup_expired_cache()
RETURNS void AS $$
BEGIN
  DELETE FROM public.cache_kv WHERE expires_at < now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;