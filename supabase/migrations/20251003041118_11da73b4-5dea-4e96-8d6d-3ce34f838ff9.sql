-- Phase 2 Security: Restrict public visibility of missing_symbols
-- 1) Remove any public read policy if present
DROP POLICY IF EXISTS "Allow public read access to missing symbols" ON public.missing_symbols;

-- 2) Explicit deny policies for anon and authenticated roles
CREATE POLICY "Deny public access to missing_symbols"
ON public.missing_symbols
FOR ALL
TO anon
USING (false)
WITH CHECK (false);

CREATE POLICY "Deny authenticated access to missing_symbols"
ON public.missing_symbols
FOR ALL
TO authenticated
USING (false)
WITH CHECK (false);

-- Note: existing service role full access policy remains, enabling edge functions to query this table.