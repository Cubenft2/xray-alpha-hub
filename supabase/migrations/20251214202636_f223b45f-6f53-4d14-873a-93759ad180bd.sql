-- Create polygon_crypto_cards table for unified crypto ticker tracking
CREATE TABLE polygon_crypto_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Identity
  canonical_symbol TEXT UNIQUE NOT NULL,  -- "BTC", "ETH", etc.
  name TEXT,
  
  -- Polygon ticker linkage
  polygon_tickers TEXT[],      -- All known tickers: ["X:BTCUSD", "X:BTCEUR", "X:BTCGBP"]
  primary_ticker TEXT,         -- Best liquidity ticker (usually USD)
  
  -- Source flags
  in_reference BOOLEAN DEFAULT FALSE,    -- Exists in Polygon reference API
  in_snapshot BOOLEAN DEFAULT FALSE,     -- Has recent trading activity
  is_active BOOLEAN DEFAULT FALSE,       -- in_snapshot = actively trading
  
  -- Price data (from snapshot)
  price_usd NUMERIC,
  price_source_ticker TEXT,    -- Which ticker this price came from
  open_24h NUMERIC,
  high_24h NUMERIC,
  low_24h NUMERIC,
  close_24h NUMERIC,
  volume_24h NUMERIC,
  vwap_24h NUMERIC,
  change_24h_pct NUMERIC,
  bid_price NUMERIC,
  ask_price NUMERIC,
  spread_pct NUMERIC,
  
  -- Technical indicators (from Polygon)
  rsi_14 NUMERIC,
  macd NUMERIC,
  macd_signal NUMERIC,
  macd_histogram NUMERIC,
  sma_20 NUMERIC,
  sma_50 NUMERIC,
  sma_200 NUMERIC,
  ema_12 NUMERIC,
  ema_26 NUMERIC,
  
  -- Timestamps
  last_trade_at TIMESTAMPTZ,
  price_updated_at TIMESTAMPTZ,
  technicals_updated_at TIMESTAMPTZ,
  reference_synced_at TIMESTAMPTZ,
  
  -- Meta
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_poly_crypto_symbol ON polygon_crypto_cards(canonical_symbol);
CREATE INDEX idx_poly_crypto_active ON polygon_crypto_cards(is_active);
CREATE INDEX idx_poly_crypto_in_snapshot ON polygon_crypto_cards(in_snapshot);
CREATE INDEX idx_poly_crypto_primary_ticker ON polygon_crypto_cards(primary_ticker);
CREATE INDEX idx_poly_crypto_price_updated ON polygon_crypto_cards(price_updated_at DESC);

-- Enable RLS
ALTER TABLE polygon_crypto_cards ENABLE ROW LEVEL SECURITY;

-- Public read access
CREATE POLICY "Allow public read access to polygon_crypto_cards"
ON polygon_crypto_cards FOR SELECT
USING (true);

-- Service role full access
CREATE POLICY "Service role full access to polygon_crypto_cards"
ON polygon_crypto_cards FOR ALL
USING (true)
WITH CHECK (true);

-- Trigger for updated_at
CREATE TRIGGER update_polygon_crypto_cards_updated_at
BEFORE UPDATE ON polygon_crypto_cards
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();