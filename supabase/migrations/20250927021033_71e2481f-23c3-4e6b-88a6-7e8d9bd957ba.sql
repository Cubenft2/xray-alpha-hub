-- Allow the service role to insert market briefs
CREATE POLICY "Allow service role to insert briefs" ON public.market_briefs
FOR INSERT TO service_role
WITH CHECK (true);