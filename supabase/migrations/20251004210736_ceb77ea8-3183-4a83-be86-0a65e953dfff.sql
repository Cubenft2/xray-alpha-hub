-- Fix security issue: Remove public access to site_settings table
-- This table contains application configuration that should not be publicly exposed

-- Drop the existing public read policy
DROP POLICY IF EXISTS "Allow public read access to site_settings" ON public.site_settings;

-- Add explicit deny policies for public and authenticated users
CREATE POLICY "Deny public access to site_settings"
ON public.site_settings
AS RESTRICTIVE
FOR ALL
TO anon
USING (false)
WITH CHECK (false);

CREATE POLICY "Deny authenticated access to site_settings"
ON public.site_settings
AS RESTRICTIVE
FOR ALL
TO authenticated
USING (false)
WITH CHECK (false);

-- Service role policy already exists and allows full access for backend operations
-- No changes needed to "Service role full access to site_settings" policy