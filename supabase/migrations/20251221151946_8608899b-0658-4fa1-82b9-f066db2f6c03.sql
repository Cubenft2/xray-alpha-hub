-- Add coingecko_fdv column for Fully Diluted Valuation
ALTER TABLE public.token_cards 
ADD COLUMN IF NOT EXISTS coingecko_fdv numeric;