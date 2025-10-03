-- Security Fix: Restrict access to internal workflow data

-- 1. Remove public read access to pending_ticker_mappings
DROP POLICY IF EXISTS "Allow public read access to pending_ticker_mappings" ON public.pending_ticker_mappings;

-- 2. Add explicit deny policies for pending_ticker_mappings
CREATE POLICY "Deny public access to pending_ticker_mappings"
ON public.pending_ticker_mappings
FOR ALL
TO anon
USING (false)
WITH CHECK (false);

CREATE POLICY "Deny authenticated access to pending_ticker_mappings"
ON public.pending_ticker_mappings
FOR ALL
TO authenticated
USING (false)
WITH CHECK (false);

-- 3. Add explicit deny policies for market_brief_audits
CREATE POLICY "Deny public access to market_brief_audits"
ON public.market_brief_audits
FOR ALL
TO anon
USING (false)
WITH CHECK (false);

CREATE POLICY "Deny authenticated access to market_brief_audits"
ON public.market_brief_audits
FOR ALL
TO authenticated
USING (false)
WITH CHECK (false);