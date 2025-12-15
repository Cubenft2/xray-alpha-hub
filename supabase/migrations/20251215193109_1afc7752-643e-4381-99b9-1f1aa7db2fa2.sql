-- Add metadata_updated_at column to token_cards to track when description/socials were last fetched
ALTER TABLE public.token_cards 
ADD COLUMN IF NOT EXISTS metadata_updated_at timestamp with time zone;