-- Fix Security Warning 1: Add explicit DENY policies for cache_kv
-- This makes it crystal clear that only service role can access cache data

CREATE POLICY "Deny public access to cache_kv"
ON public.cache_kv
FOR ALL
TO anon
USING (false)
WITH CHECK (false);

CREATE POLICY "Deny authenticated access to cache_kv"
ON public.cache_kv
FOR ALL
TO authenticated
USING (false)
WITH CHECK (false);

-- Fix Security Warning 2: Move extensions out of public schema
-- Create a dedicated schema for extensions
CREATE SCHEMA IF NOT EXISTS extensions;

-- Move pg_stat_statements if it exists in public
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_extension 
    WHERE extname = 'pg_stat_statements' 
    AND extnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
  ) THEN
    ALTER EXTENSION pg_stat_statements SET SCHEMA extensions;
  END IF;
END $$;

-- Grant usage on extensions schema
GRANT USAGE ON SCHEMA extensions TO postgres, anon, authenticated, service_role;