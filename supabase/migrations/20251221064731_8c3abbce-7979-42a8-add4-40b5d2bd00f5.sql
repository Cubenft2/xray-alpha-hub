-- Add unique constraint on asset_symbol for social_sentiment upserts
ALTER TABLE public.social_sentiment 
ADD CONSTRAINT social_sentiment_asset_symbol_key UNIQUE (asset_symbol);