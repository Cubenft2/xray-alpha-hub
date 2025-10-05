-- Phase 1: Critical Security Fixes
-- Protecting user_roles and earnings_calendar tables

-- 1. Add explicit deny policy for user_roles to prevent public (anon) access
-- This prevents unauthenticated users from viewing any user roles
CREATE POLICY "Deny public access to user_roles"
ON public.user_roles
FOR ALL
TO anon
USING (false)
WITH CHECK (false);

-- 2. Restrict earnings_calendar to authenticated users only
-- Drop the existing overly permissive public read policy
DROP POLICY IF EXISTS "Allow public read access to earnings calendar" ON public.earnings_calendar;

-- Create new policy requiring authentication to view earnings data
-- This protects proprietary business intelligence (importance_score, social_sentiment, etc.)
CREATE POLICY "Allow authenticated read access to earnings calendar"
ON public.earnings_calendar
FOR SELECT
TO authenticated
USING (true);

-- Add comment explaining the security change
COMMENT ON POLICY "Allow authenticated read access to earnings calendar" ON public.earnings_calendar IS 
'Restricts access to proprietary earnings intelligence. Public access removed to protect business data including importance scores and social sentiment analysis.';