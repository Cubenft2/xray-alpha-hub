-- ==========================================
-- Fix: Restrict earnings_calendar access to service role only
-- ==========================================
-- This table contains proprietary business intelligence (importance scores,
-- social sentiment analysis, crypto categorization) and should NOT be
-- accessible to authenticated users who could scrape this data.
-- Only backend edge functions (using service role) need access.

-- Drop the overly permissive authenticated read policy
DROP POLICY IF EXISTS "Allow authenticated read access to earnings calendar" ON public.earnings_calendar;

-- Confirm service role access is maintained (should already exist)
-- This policy allows edge functions to read/write earnings data
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'earnings_calendar' 
    AND policyname = 'Allow service role full access to earnings_calendar'
  ) THEN
    CREATE POLICY "Allow service role full access to earnings_calendar" 
    ON public.earnings_calendar 
    FOR ALL 
    TO service_role
    USING (true)
    WITH CHECK (true);
  END IF;
END $$;