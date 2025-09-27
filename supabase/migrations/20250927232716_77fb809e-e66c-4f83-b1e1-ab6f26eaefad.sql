-- Drop the market_briefs table and related policies
DROP POLICY IF EXISTS "Allow service role to insert briefs" ON public.market_briefs;
DROP TABLE IF EXISTS public.market_briefs CASCADE;