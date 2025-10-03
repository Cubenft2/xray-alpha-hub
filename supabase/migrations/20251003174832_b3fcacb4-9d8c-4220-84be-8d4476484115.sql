-- Add stoic_quote_author column to market_briefs table
ALTER TABLE public.market_briefs 
  ADD COLUMN stoic_quote_author TEXT;