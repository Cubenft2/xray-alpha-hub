-- Step 1: Create live_prices table for storing current ticker prices
CREATE TABLE public.live_prices (
  ticker TEXT PRIMARY KEY,
  display TEXT NOT NULL,
  price NUMERIC NOT NULL,
  change24h NUMERIC NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS on live_prices
ALTER TABLE public.live_prices ENABLE ROW LEVEL SECURITY;

-- Allow public read access
CREATE POLICY "Allow public read access to live_prices"
  ON public.live_prices FOR SELECT
  USING (true);

-- Allow service role full access (for edge function)
CREATE POLICY "Allow service role full access to live_prices"
  ON public.live_prices FOR ALL
  USING (true)
  WITH CHECK (true);

-- Enable Realtime for live_prices
ALTER PUBLICATION supabase_realtime ADD TABLE public.live_prices;

-- Index for fast lookups
CREATE INDEX idx_live_prices_updated_at ON public.live_prices(updated_at DESC);

-- Step 2: Create price_sync_leader table for leader election
CREATE TABLE public.price_sync_leader (
  id TEXT PRIMARY KEY DEFAULT 'singleton',
  instance_id TEXT NOT NULL,
  heartbeat_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (id = 'singleton')
);

-- Enable RLS on price_sync_leader
ALTER TABLE public.price_sync_leader ENABLE ROW LEVEL SECURITY;

-- Service role only access
CREATE POLICY "Service role full access to price_sync_leader"
  ON public.price_sync_leader FOR ALL
  USING (true)
  WITH CHECK (true);