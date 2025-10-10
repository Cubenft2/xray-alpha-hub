-- Phase 1: Create exchange ticker data table
CREATE TABLE IF NOT EXISTS public.exchange_ticker_data (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  asset_symbol TEXT NOT NULL,
  exchange TEXT NOT NULL,
  price NUMERIC NOT NULL,
  volume_24h NUMERIC NOT NULL DEFAULT 0,
  change_24h NUMERIC NOT NULL DEFAULT 0,
  high_24h NUMERIC,
  low_24h NUMERIC,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_updated TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(asset_symbol, exchange)
);

-- Enable RLS
ALTER TABLE public.exchange_ticker_data ENABLE ROW LEVEL SECURITY;

-- Allow public read access
CREATE POLICY "Allow public read access to exchange_ticker_data"
ON public.exchange_ticker_data
FOR SELECT
USING (true);

-- Allow service role full access
CREATE POLICY "Allow service role full access to exchange_ticker_data"
ON public.exchange_ticker_data
FOR ALL
USING (true)
WITH CHECK (true);

-- Indexes for performance
CREATE INDEX idx_exchange_ticker_symbol ON public.exchange_ticker_data(asset_symbol);
CREATE INDEX idx_exchange_ticker_exchange ON public.exchange_ticker_data(exchange);
CREATE INDEX idx_exchange_ticker_updated ON public.exchange_ticker_data(last_updated DESC);

-- Phase 5: Add missing CoinGecko IDs
UPDATE public.ticker_mappings SET coingecko_id = 'mantle' WHERE symbol = 'MNT' AND coingecko_id IS NULL;
UPDATE public.ticker_mappings SET coingecko_id = 'walrus-protocol' WHERE symbol = 'WAL' AND coingecko_id IS NULL;

-- Add auto-update trigger for updated_at
CREATE TRIGGER update_exchange_ticker_data_updated_at
BEFORE UPDATE ON public.exchange_ticker_data
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();