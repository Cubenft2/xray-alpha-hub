-- Remove public read access to market_brief_audits table
-- This table contains internal audit information that should not be exposed to the public
DROP POLICY IF EXISTS "Allow public read access to market_brief_audits" ON public.market_brief_audits;

-- The "Service role full access to market_brief_audits" policy will remain,
-- ensuring edge functions can still write audit data