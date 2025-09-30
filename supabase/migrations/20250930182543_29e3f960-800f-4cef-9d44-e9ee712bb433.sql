-- Create cg_master table for CoinGecko coin list sync
CREATE TABLE IF NOT EXISTS public.cg_master (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cg_id text NOT NULL UNIQUE,
  symbol text NOT NULL,
  name text NOT NULL,
  platforms jsonb DEFAULT '{}'::jsonb,
  synced_at timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now()
);

-- Create index for fast symbol lookups
CREATE INDEX IF NOT EXISTS idx_cg_master_symbol ON public.cg_master(symbol);
CREATE INDEX IF NOT EXISTS idx_cg_master_name ON public.cg_master(name);
CREATE INDEX IF NOT EXISTS idx_cg_master_synced_at ON public.cg_master(synced_at);

-- Create exchange_pairs table for exchange universe
CREATE TABLE IF NOT EXISTS public.exchange_pairs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exchange text NOT NULL,
  symbol text NOT NULL,
  base_asset text NOT NULL,
  quote_asset text NOT NULL,
  is_active boolean DEFAULT true,
  synced_at timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE(exchange, symbol)
);

-- Create index for fast exchange lookups
CREATE INDEX IF NOT EXISTS idx_exchange_pairs_symbol ON public.exchange_pairs(exchange, symbol);
CREATE INDEX IF NOT EXISTS idx_exchange_pairs_base ON public.exchange_pairs(base_asset);

-- Create pending_ticker_mappings table for admin queue
CREATE TABLE IF NOT EXISTS public.pending_ticker_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol text NOT NULL,
  normalized_symbol text NOT NULL,
  display_name text,
  coingecko_id text,
  tradingview_symbol text,
  polygon_ticker text,
  aliases text[],
  confidence_score numeric(3,2) DEFAULT 0.00,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  context jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  reviewed_by text,
  reviewed_at timestamp with time zone
);

-- Create index for pending mappings
CREATE INDEX IF NOT EXISTS idx_pending_ticker_symbol ON public.pending_ticker_mappings(normalized_symbol);
CREATE INDEX IF NOT EXISTS idx_pending_ticker_status ON public.pending_ticker_mappings(status);

-- Enable RLS on new tables
ALTER TABLE public.cg_master ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exchange_pairs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pending_ticker_mappings ENABLE ROW LEVEL SECURITY;

-- RLS policies for cg_master (public read, service role write)
CREATE POLICY "Allow public read access to cg_master"
  ON public.cg_master FOR SELECT
  USING (true);

CREATE POLICY "Allow service role full access to cg_master"
  ON public.cg_master FOR ALL
  USING (true)
  WITH CHECK (true);

-- RLS policies for exchange_pairs (public read, service role write)
CREATE POLICY "Allow public read access to exchange_pairs"
  ON public.exchange_pairs FOR SELECT
  USING (true);

CREATE POLICY "Allow service role full access to exchange_pairs"
  ON public.exchange_pairs FOR ALL
  USING (true)
  WITH CHECK (true);

-- RLS policies for pending_ticker_mappings (public read, service role write)
CREATE POLICY "Allow public read access to pending_ticker_mappings"
  ON public.pending_ticker_mappings FOR SELECT
  USING (true);

CREATE POLICY "Allow service role full access to pending_ticker_mappings"
  ON public.pending_ticker_mappings FOR ALL
  USING (true)
  WITH CHECK (true);

-- Create trigger for updating updated_at
CREATE TRIGGER update_pending_ticker_mappings_updated_at
  BEFORE UPDATE ON public.pending_ticker_mappings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();