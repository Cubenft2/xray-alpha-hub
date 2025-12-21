-- Drop duplicate unique constraints on exchange_ticker_data
-- Keep only exchange_ticker_data_asset_symbol_exchange_key
ALTER TABLE public.exchange_ticker_data DROP CONSTRAINT IF EXISTS exchange_ticker_data_unique;
ALTER TABLE public.exchange_ticker_data DROP CONSTRAINT IF EXISTS exchange_ticker_data_symbol_exchange_unique;