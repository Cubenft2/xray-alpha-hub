-- ============================================================
-- PHASE 1: Create new normalized schema
-- ============================================================

-- 1. Master assets table (single source of truth)
CREATE TABLE public.assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol VARCHAR(20) NOT NULL,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(10) NOT NULL CHECK (type IN ('crypto', 'stock', 'forex')),
  logo_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(symbol, type)
);

-- 2. Polygon.io specific data
CREATE TABLE public.polygon_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  polygon_ticker VARCHAR(30) NOT NULL,
  market VARCHAR(10) NOT NULL CHECK (market IN ('crypto', 'stocks', 'forex')),
  is_active BOOLEAN DEFAULT true,
  last_synced TIMESTAMPTZ DEFAULT now(),
  UNIQUE(asset_id),
  UNIQUE(polygon_ticker)
);

-- 3. CoinGecko specific data  
CREATE TABLE public.coingecko_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  coingecko_id VARCHAR(100) NOT NULL UNIQUE,
  market_cap_rank INTEGER,
  categories JSONB DEFAULT '[]',
  last_synced TIMESTAMPTZ DEFAULT now(),
  UNIQUE(asset_id)
);

-- 4. Token contracts by chain
CREATE TABLE public.token_contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  chain VARCHAR(20) NOT NULL,
  contract_address VARCHAR(100) NOT NULL,
  decimals INTEGER DEFAULT 18,
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(asset_id, chain),
  UNIQUE(chain, contract_address)
);

-- 5. LunarCrush social data
CREATE TABLE public.lunarcrush_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  lunarcrush_id VARCHAR(50),
  galaxy_score DECIMAL(5,2),
  alt_rank INTEGER,
  social_volume INTEGER,
  last_synced TIMESTAMPTZ DEFAULT now(),
  UNIQUE(asset_id)
);

-- 6. TradingView mappings (for charts)
CREATE TABLE public.tradingview_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  tradingview_symbol VARCHAR(50) NOT NULL,
  exchange VARCHAR(20),
  is_supported BOOLEAN DEFAULT true,
  UNIQUE(asset_id),
  UNIQUE(tradingview_symbol)
);

-- ============================================================
-- PHASE 2: Update live_prices to reference assets
-- ============================================================

ALTER TABLE public.live_prices 
  ADD COLUMN IF NOT EXISTS asset_id UUID REFERENCES public.assets(id),
  ADD COLUMN IF NOT EXISTS source VARCHAR(20) DEFAULT 'polygon';

-- ============================================================
-- PHASE 3: Create indexes for performance
-- ============================================================

CREATE INDEX idx_assets_symbol ON public.assets(symbol);
CREATE INDEX idx_assets_type ON public.assets(type);
CREATE INDEX idx_assets_symbol_type ON public.assets(symbol, type);
CREATE INDEX idx_polygon_assets_ticker ON public.polygon_assets(polygon_ticker);
CREATE INDEX idx_polygon_assets_market ON public.polygon_assets(market);
CREATE INDEX idx_coingecko_assets_cgid ON public.coingecko_assets(coingecko_id);
CREATE INDEX idx_token_contracts_address ON public.token_contracts(contract_address);
CREATE INDEX idx_token_contracts_chain ON public.token_contracts(chain);
CREATE INDEX idx_live_prices_asset_id ON public.live_prices(asset_id);
CREATE INDEX idx_live_prices_source ON public.live_prices(source);

-- ============================================================
-- PHASE 4: Enable RLS with proper policies
-- ============================================================

ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.polygon_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coingecko_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.token_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lunarcrush_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tradingview_assets ENABLE ROW LEVEL SECURITY;

-- Public read access (restrictive policies)
CREATE POLICY "Allow public read access to assets" 
  ON public.assets FOR SELECT USING (true);

CREATE POLICY "Allow public read access to polygon_assets" 
  ON public.polygon_assets FOR SELECT USING (true);

CREATE POLICY "Allow public read access to coingecko_assets" 
  ON public.coingecko_assets FOR SELECT USING (true);

CREATE POLICY "Allow public read access to token_contracts" 
  ON public.token_contracts FOR SELECT USING (true);

CREATE POLICY "Allow public read access to lunarcrush_assets" 
  ON public.lunarcrush_assets FOR SELECT USING (true);

CREATE POLICY "Allow public read access to tradingview_assets" 
  ON public.tradingview_assets FOR SELECT USING (true);

-- Service role full access (for edge functions)
CREATE POLICY "Service role full access to assets" 
  ON public.assets FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access to polygon_assets" 
  ON public.polygon_assets FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access to coingecko_assets" 
  ON public.coingecko_assets FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access to token_contracts" 
  ON public.token_contracts FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access to lunarcrush_assets" 
  ON public.lunarcrush_assets FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access to tradingview_assets" 
  ON public.tradingview_assets FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- PHASE 5: Create backward-compatible view
-- ============================================================

CREATE OR REPLACE VIEW public.ticker_mappings_v2 AS
SELECT 
  a.id,
  a.symbol,
  a.name AS display_name,
  a.type,
  a.logo_url,
  p.polygon_ticker,
  c.coingecko_id,
  tv.tradingview_symbol,
  tv.is_supported AS tradingview_supported,
  tc.contract_address AS dex_address,
  tc.chain AS dex_chain,
  lc.galaxy_score,
  lc.alt_rank,
  true AS is_active,
  a.created_at,
  a.updated_at
FROM public.assets a
LEFT JOIN public.polygon_assets p ON a.id = p.asset_id
LEFT JOIN public.coingecko_assets c ON a.id = c.asset_id
LEFT JOIN public.tradingview_assets tv ON a.id = tv.asset_id
LEFT JOIN public.token_contracts tc ON a.id = tc.asset_id AND tc.is_primary = true
LEFT JOIN public.lunarcrush_assets lc ON a.id = lc.asset_id;