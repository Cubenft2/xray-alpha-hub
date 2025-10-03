-- Create Polygon reference data tables
CREATE TABLE IF NOT EXISTS public.poly_tickers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticker TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  market TEXT NOT NULL, -- crypto, stocks, fx, indices, options
  locale TEXT, -- us, global
  primary_exchange TEXT,
  type TEXT, -- CS (Common Stock), CRYPTO, FX
  currency_name TEXT,
  base_currency_symbol TEXT,
  base_currency_name TEXT,
  active BOOLEAN DEFAULT true,
  delisted_utc TIMESTAMP WITH TIME ZONE,
  last_updated_utc TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  synced_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  CONSTRAINT poly_tickers_ticker_unique UNIQUE (ticker)
);

CREATE INDEX IF NOT EXISTS idx_poly_tickers_market ON public.poly_tickers(market) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_poly_tickers_type ON public.poly_tickers(type) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_poly_tickers_ticker_search ON public.poly_tickers USING gin(to_tsvector('english', ticker || ' ' || name));

-- Create Polygon FX pairs table
CREATE TABLE IF NOT EXISTS public.poly_fx_pairs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticker TEXT NOT NULL UNIQUE,
  base_currency TEXT NOT NULL,
  quote_currency TEXT NOT NULL,
  name TEXT NOT NULL,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  synced_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_poly_fx_pairs_currencies ON public.poly_fx_pairs(base_currency, quote_currency) WHERE active = true;

-- Enable RLS on Polygon tables
ALTER TABLE public.poly_tickers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poly_fx_pairs ENABLE ROW LEVEL SECURITY;

-- Public read access
CREATE POLICY "Allow public read access to poly_tickers"
  ON public.poly_tickers FOR SELECT
  USING (true);

CREATE POLICY "Allow public read access to poly_fx_pairs"
  ON public.poly_fx_pairs FOR SELECT
  USING (true);

-- Service role full access
CREATE POLICY "Service role full access to poly_tickers"
  ON public.poly_tickers FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role full access to poly_fx_pairs"
  ON public.poly_fx_pairs FOR ALL
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE public.poly_tickers IS 'Polygon.io reference data for all supported tickers (crypto, stocks, FX, etc.)';
COMMENT ON TABLE public.poly_fx_pairs IS 'Polygon.io FX currency pairs for forex data';