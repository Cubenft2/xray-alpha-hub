-- Add new columns to live_prices for Massive API data
ALTER TABLE live_prices 
  ADD COLUMN IF NOT EXISTS is_delayed boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS day_open numeric,
  ADD COLUMN IF NOT EXISTS day_high numeric,
  ADD COLUMN IF NOT EXISTS day_low numeric,
  ADD COLUMN IF NOT EXISTS volume numeric,
  ADD COLUMN IF NOT EXISTS last_trade_ts timestamptz;

-- Add display_symbol, market, provider, active columns to assets table
ALTER TABLE assets 
  ADD COLUMN IF NOT EXISTS display_symbol text,
  ADD COLUMN IF NOT EXISTS market text,
  ADD COLUMN IF NOT EXISTS provider text DEFAULT 'massive',
  ADD COLUMN IF NOT EXISTS active boolean DEFAULT true;

-- Backfill display_symbol from symbol
UPDATE assets SET display_symbol = symbol WHERE display_symbol IS NULL;

-- Backfill market from type
UPDATE assets SET market = CASE 
  WHEN type = 'crypto' THEN 'crypto'
  WHEN type = 'stock' THEN 'stocks'
  ELSE type
END WHERE market IS NULL;

-- Create index for faster market-data lookups
CREATE INDEX IF NOT EXISTS idx_assets_symbol_type ON assets(symbol, type);
CREATE INDEX IF NOT EXISTS idx_live_prices_ticker_updated ON live_prices(ticker, updated_at DESC);

-- Add comment explaining Massive API integration
COMMENT ON COLUMN live_prices.is_delayed IS 'True for stocks (Starter plan has 15-min delay)';
COMMENT ON COLUMN live_prices.source IS 'Data provider: massive, lunarcrush, coingecko';
COMMENT ON COLUMN assets.provider IS 'Primary data provider for this asset';
COMMENT ON COLUMN assets.market IS 'Market category: crypto, stocks, forex';