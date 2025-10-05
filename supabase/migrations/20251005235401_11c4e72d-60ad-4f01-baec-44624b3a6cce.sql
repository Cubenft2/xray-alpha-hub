-- Enable realtime on live_prices table for full row updates
ALTER TABLE public.live_prices REPLICA IDENTITY FULL;

-- Add index on ticker for fast upserts
CREATE INDEX IF NOT EXISTS idx_live_prices_ticker ON public.live_prices(ticker);