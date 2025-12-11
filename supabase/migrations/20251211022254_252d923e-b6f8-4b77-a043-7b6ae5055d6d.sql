-- Step 1: Clean crypto_snapshot - delete all stock records (non X: prefix)
DELETE FROM crypto_snapshot WHERE ticker NOT LIKE 'X:%';

-- Step 2: Create stock_snapshot table for stock-only data
CREATE TABLE IF NOT EXISTS public.stock_snapshot (
  symbol TEXT PRIMARY KEY,
  ticker TEXT NOT NULL,
  name TEXT NOT NULL,
  price NUMERIC NOT NULL DEFAULT 0,
  open_price NUMERIC DEFAULT 0,
  high_24h NUMERIC DEFAULT 0,
  low_24h NUMERIC DEFAULT 0,
  prev_close NUMERIC DEFAULT 0,
  change_24h NUMERIC DEFAULT 0,
  change_percent NUMERIC DEFAULT 0,
  volume_24h NUMERIC DEFAULT 0,
  vwap NUMERIC DEFAULT 0,
  market_cap NUMERIC,
  sector TEXT,
  industry TEXT,
  logo_url TEXT,
  asset_id UUID,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Step 3: Enable RLS on stock_snapshot
ALTER TABLE public.stock_snapshot ENABLE ROW LEVEL SECURITY;

-- Step 4: Create RLS policies for stock_snapshot
CREATE POLICY "Allow public read access to stock_snapshot"
ON public.stock_snapshot
FOR SELECT
USING (true);

CREATE POLICY "Service role full access to stock_snapshot"
ON public.stock_snapshot
FOR ALL
USING (true)
WITH CHECK (true);

-- Step 5: Create index for performance
CREATE INDEX IF NOT EXISTS idx_stock_snapshot_volume ON public.stock_snapshot(volume_24h DESC);
CREATE INDEX IF NOT EXISTS idx_stock_snapshot_sector ON public.stock_snapshot(sector);

-- Step 6: Initial population from live_prices (stocks only - non X: tickers)
INSERT INTO public.stock_snapshot (symbol, ticker, name, price, change_24h, change_percent, updated_at)
SELECT 
  ticker as symbol,
  ticker,
  display as name,
  price,
  change24h as change_24h,
  CASE WHEN price > 0 THEN (change24h / price) * 100 ELSE 0 END as change_percent,
  updated_at
FROM live_prices
WHERE ticker NOT LIKE 'X:%'
  AND ticker NOT LIKE 'C:%'
  AND ticker ~ '^[A-Z]{1,5}$'
ON CONFLICT (symbol) DO UPDATE SET
  price = EXCLUDED.price,
  change_24h = EXCLUDED.change_24h,
  change_percent = EXCLUDED.change_percent,
  updated_at = EXCLUDED.updated_at;