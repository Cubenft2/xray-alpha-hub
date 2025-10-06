-- ==========================================
-- Fix: Ensure RLS is enabled on site_settings table
-- ==========================================
-- The site_settings table contains internal system configuration that should
-- only be accessible by the service role. While deny policies exist, RLS must
-- be enabled on the table itself for those policies to take effect.

-- Enable Row Level Security on site_settings
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

-- Verify service role access policy exists (should already be in place)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'site_settings' 
    AND policyname = 'Service role full access to site_settings'
  ) THEN
    CREATE POLICY "Service role full access to site_settings" 
    ON public.site_settings 
    FOR ALL 
    TO service_role
    USING (true)
    WITH CHECK (true);
  END IF;
END $$;