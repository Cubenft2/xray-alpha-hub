-- Fix exchange_ticker_data table constraints to prevent data loss

-- 1. Allow nullable prices for incomplete data from APIs
ALTER TABLE public.exchange_ticker_data 
ALTER COLUMN price DROP NOT NULL;

-- 2. Add unique constraint for UPSERT operations
-- This prevents the "no unique or exclusion constraint matching the ON CONFLICT" errors
ALTER TABLE public.exchange_ticker_data 
ADD CONSTRAINT exchange_ticker_data_symbol_exchange_unique 
UNIQUE (asset_symbol, exchange, timestamp);

-- 3. Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_exchange_ticker_data_symbol_exchange_timestamp 
ON public.exchange_ticker_data (asset_symbol, exchange, timestamp DESC);