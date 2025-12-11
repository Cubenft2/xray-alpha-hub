-- Create crypto_snapshot table for scalable screener data
CREATE TABLE public.crypto_snapshot (
  symbol TEXT PRIMARY KEY,
  ticker TEXT NOT NULL,
  name TEXT NOT NULL,
  logo_url TEXT,
  coingecko_id TEXT,
  price NUMERIC NOT NULL DEFAULT 0,
  change_24h NUMERIC DEFAULT 0,
  change_percent NUMERIC DEFAULT 0,
  volume_24h NUMERIC DEFAULT 0,
  vwap NUMERIC DEFAULT 0,
  high_24h NUMERIC DEFAULT 0,
  low_24h NUMERIC DEFAULT 0,
  open_24h NUMERIC DEFAULT 0,
  market_cap NUMERIC,
  market_cap_rank INTEGER,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for sorting by market cap rank
CREATE INDEX idx_crypto_snapshot_market_cap_rank ON public.crypto_snapshot(market_cap_rank NULLS LAST);

-- Enable RLS
ALTER TABLE public.crypto_snapshot ENABLE ROW LEVEL SECURITY;

-- Allow public read access
CREATE POLICY "Allow public read access to crypto_snapshot"
ON public.crypto_snapshot
FOR SELECT
USING (true);

-- Service role full access
CREATE POLICY "Service role full access to crypto_snapshot"
ON public.crypto_snapshot
FOR ALL
USING (true)
WITH CHECK (true);

-- Enable realtime for the table
ALTER PUBLICATION supabase_realtime ADD TABLE public.crypto_snapshot;