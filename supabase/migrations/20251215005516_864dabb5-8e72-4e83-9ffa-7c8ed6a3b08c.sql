-- Create the timestamp update function if not exists
CREATE OR REPLACE FUNCTION public.update_token_cards_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- ═══════════════════════════════════════════════════════════════════════════════
-- STOCK CARDS
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE public.stock_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol TEXT UNIQUE NOT NULL,
  name TEXT,
  logo_url TEXT,
  
  sector TEXT,
  industry TEXT,
  exchange TEXT,
  country TEXT,
  
  price_usd NUMERIC,
  open_price NUMERIC,
  high_price NUMERIC,
  low_price NUMERIC,
  close_price NUMERIC,
  previous_close NUMERIC,
  change_usd NUMERIC,
  change_pct NUMERIC,
  volume BIGINT,
  avg_volume BIGINT,
  
  market_cap NUMERIC,
  pe_ratio NUMERIC,
  eps NUMERIC,
  dividend_yield NUMERIC,
  fifty_two_week_high NUMERIC,
  fifty_two_week_low NUMERIC,
  
  is_delayed BOOLEAN DEFAULT true,
  price_updated_at TIMESTAMPTZ,
  
  rsi_14 NUMERIC,
  sma_20 NUMERIC,
  sma_50 NUMERIC,
  sma_200 NUMERIC,
  macd_line NUMERIC,
  macd_signal NUMERIC,
  technical_signal TEXT,
  
  technicals_updated_at TIMESTAMPTZ,
  
  galaxy_score INTEGER,
  sentiment INTEGER,
  social_volume_24h BIGINT,
  social_dominance NUMERIC,
  interactions_24h BIGINT,
  contributors_active INTEGER,
  
  twitter_volume BIGINT,
  reddit_volume BIGINT,
  news_volume BIGINT,
  
  social_updated_at TIMESTAMPTZ,
  
  ai_summary TEXT,
  top_posts JSONB DEFAULT '[]',
  top_news JSONB DEFAULT '[]',
  
  ai_updated_at TIMESTAMPTZ,
  
  tier INTEGER DEFAULT 3,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_stock_cards_market_cap ON public.stock_cards(market_cap DESC NULLS LAST);
CREATE INDEX idx_stock_cards_sector ON public.stock_cards(sector);
CREATE INDEX idx_stock_cards_exchange ON public.stock_cards(exchange);
CREATE INDEX idx_stock_cards_volume ON public.stock_cards(volume DESC NULLS LAST);
CREATE INDEX idx_stock_cards_change_pct ON public.stock_cards(change_pct DESC NULLS LAST);

ALTER TABLE public.stock_cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to stock_cards"
  ON public.stock_cards FOR SELECT
  USING (true);

CREATE POLICY "Service role full access to stock_cards"
  ON public.stock_cards FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE TRIGGER stock_cards_updated_at
  BEFORE UPDATE ON public.stock_cards
  FOR EACH ROW
  EXECUTE FUNCTION public.update_token_cards_timestamp();

-- ═══════════════════════════════════════════════════════════════════════════════
-- FOREX CARDS
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE public.forex_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pair TEXT UNIQUE NOT NULL,
  base_currency TEXT NOT NULL,
  quote_currency TEXT NOT NULL,
  
  display_name TEXT,
  base_flag TEXT,
  quote_flag TEXT,
  
  rate NUMERIC,
  bid NUMERIC,
  ask NUMERIC,
  spread_pips NUMERIC,
  
  open_24h NUMERIC,
  high_24h NUMERIC,
  low_24h NUMERIC,
  change_24h NUMERIC,
  change_24h_pct NUMERIC,
  
  price_updated_at TIMESTAMPTZ,
  
  rsi_14 NUMERIC,
  sma_20 NUMERIC,
  sma_50 NUMERIC,
  sma_200 NUMERIC,
  macd_line NUMERIC,
  macd_signal NUMERIC,
  technical_signal TEXT,
  
  technicals_updated_at TIMESTAMPTZ,
  
  is_major BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_forex_cards_base ON public.forex_cards(base_currency);
CREATE INDEX idx_forex_cards_quote ON public.forex_cards(quote_currency);
CREATE INDEX idx_forex_cards_is_major ON public.forex_cards(is_major) WHERE is_major = true;
CREATE INDEX idx_forex_cards_change ON public.forex_cards(change_24h_pct DESC NULLS LAST);

ALTER TABLE public.forex_cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to forex_cards"
  ON public.forex_cards FOR SELECT
  USING (true);

CREATE POLICY "Service role full access to forex_cards"
  ON public.forex_cards FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE TRIGGER forex_cards_updated_at
  BEFORE UPDATE ON public.forex_cards
  FOR EACH ROW
  EXECUTE FUNCTION public.update_token_cards_timestamp();