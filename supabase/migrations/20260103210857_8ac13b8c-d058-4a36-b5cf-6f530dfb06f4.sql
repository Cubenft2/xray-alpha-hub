-- =============================================
-- Phase 1: Database Foundation for Futures & COT
-- =============================================

-- 1. Create futures_cards table
CREATE TABLE public.futures_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol TEXT NOT NULL UNIQUE,
  name TEXT,
  exchange TEXT,
  underlying TEXT,
  contract_size NUMERIC,
  
  -- Pricing
  price NUMERIC,
  open_24h NUMERIC,
  high_24h NUMERIC,
  low_24h NUMERIC,
  change_24h NUMERIC,
  change_24h_pct NUMERIC,
  volume INTEGER,
  open_interest INTEGER,
  
  -- Historical tracking
  ath_price NUMERIC,
  ath_date TIMESTAMPTZ,
  ytd_change_pct NUMERIC,
  
  -- Technicals
  rsi_14 NUMERIC,
  sma_20 NUMERIC,
  sma_50 NUMERIC,
  sma_200 NUMERIC,
  technical_signal TEXT,
  
  -- Timestamps
  price_updated_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS for futures_cards
ALTER TABLE public.futures_cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to futures_cards" 
ON public.futures_cards FOR SELECT USING (true);

CREATE POLICY "Service role full access to futures_cards" 
ON public.futures_cards FOR ALL USING (true) WITH CHECK (true);

-- Indexes for futures_cards
CREATE INDEX idx_futures_cards_symbol ON public.futures_cards(symbol);
CREATE INDEX idx_futures_cards_underlying ON public.futures_cards(underlying);

-- 2. Create cot_reports table for CFTC data
CREATE TABLE public.cot_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  commodity TEXT NOT NULL,
  report_date DATE NOT NULL,
  as_of_date DATE NOT NULL,
  
  -- Swap Dealers ("Banks")
  swap_long INTEGER,
  swap_short INTEGER,
  swap_net INTEGER,
  swap_spreading INTEGER,
  
  -- Producer/Merchant/Processor/User
  producer_long INTEGER,
  producer_short INTEGER,
  producer_net INTEGER,
  
  -- Managed Money (Speculators)
  managed_long INTEGER,
  managed_short INTEGER,
  managed_net INTEGER,
  managed_spreading INTEGER,
  
  -- Other Reportables
  other_long INTEGER,
  other_short INTEGER,
  other_net INTEGER,
  other_spreading INTEGER,
  
  -- Non-Reportables
  nonreportable_long INTEGER,
  nonreportable_short INTEGER,
  nonreportable_net INTEGER,
  
  -- Totals
  open_interest INTEGER,
  
  -- Week-over-week changes
  swap_net_change INTEGER,
  managed_net_change INTEGER,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(commodity, report_date)
);

-- RLS for cot_reports
ALTER TABLE public.cot_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to cot_reports" 
ON public.cot_reports FOR SELECT USING (true);

CREATE POLICY "Service role full access to cot_reports" 
ON public.cot_reports FOR ALL USING (true) WITH CHECK (true);

-- Indexes for cot_reports
CREATE INDEX idx_cot_reports_commodity ON public.cot_reports(commodity);
CREATE INDEX idx_cot_reports_date ON public.cot_reports(report_date DESC);

-- 3. Extend forex_cards for ATH/ATL tracking
ALTER TABLE public.forex_cards
ADD COLUMN IF NOT EXISTS ath_price NUMERIC,
ADD COLUMN IF NOT EXISTS ath_date TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS atl_price NUMERIC,
ADD COLUMN IF NOT EXISTS atl_date TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS ytd_open NUMERIC,
ADD COLUMN IF NOT EXISTS ytd_change_pct NUMERIC;

-- 4. Seed initial futures data
INSERT INTO public.futures_cards (symbol, name, exchange, underlying, contract_size, is_active)
VALUES 
  ('GC1!', 'Gold Futures (Front Month)', 'COMEX', 'XAU', 100, true),
  ('SI1!', 'Silver Futures (Front Month)', 'COMEX', 'XAG', 5000, true),
  ('GC2!', 'Gold Futures (2nd Month)', 'COMEX', 'XAU', 100, true),
  ('SI2!', 'Silver Futures (2nd Month)', 'COMEX', 'XAG', 5000, true)
ON CONFLICT (symbol) DO NOTHING;

-- 5. Trigger for updated_at on futures_cards
CREATE TRIGGER update_futures_cards_updated_at
BEFORE UPDATE ON public.futures_cards
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();