-- ═══════════════════════════════════════════════════════════════════════════════
-- TOKEN CARDS: Unified data structure for all crypto assets
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE public.token_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  canonical_symbol TEXT UNIQUE NOT NULL,
  name TEXT,
  slug TEXT,
  logo_url TEXT,
  description TEXT,
  
  categories TEXT[],
  tags TEXT[],
  contracts JSONB DEFAULT '{}',
  primary_chain TEXT,
  
  lunarcrush_id INTEGER,
  coingecko_id TEXT,
  polygon_ticker TEXT,
  
  website TEXT,
  twitter TEXT,
  twitter_url TEXT,
  reddit TEXT,
  reddit_url TEXT,
  telegram TEXT,
  telegram_url TEXT,
  discord TEXT,
  discord_url TEXT,
  github TEXT,
  github_url TEXT,
  whitepaper_url TEXT,
  explorers JSONB DEFAULT '{}',
  
  identity_updated_at TIMESTAMPTZ,
  
  price_usd NUMERIC,
  price_btc NUMERIC,
  price_eth NUMERIC,
  
  open_24h NUMERIC,
  high_24h NUMERIC,
  low_24h NUMERIC,
  close_24h NUMERIC,
  vwap_24h NUMERIC,
  
  volume_24h_usd NUMERIC,
  volume_24h_native NUMERIC,
  trade_count_24h INTEGER,
  
  change_1h_usd NUMERIC,
  change_1h_pct NUMERIC,
  change_24h_usd NUMERIC,
  change_24h_pct NUMERIC,
  change_7d_usd NUMERIC,
  change_7d_pct NUMERIC,
  change_30d_usd NUMERIC,
  change_30d_pct NUMERIC,
  
  bid_price NUMERIC,
  ask_price NUMERIC,
  bid_size NUMERIC,
  ask_size NUMERIC,
  spread_usd NUMERIC,
  spread_pct NUMERIC,
  
  circulating_supply NUMERIC,
  total_supply NUMERIC,
  max_supply NUMERIC,
  market_cap NUMERIC,
  fully_diluted_valuation NUMERIC,
  market_cap_rank INTEGER,
  market_dominance NUMERIC,
  
  ath_price NUMERIC,
  ath_date TIMESTAMPTZ,
  ath_change_pct NUMERIC,
  atl_price NUMERIC,
  atl_date TIMESTAMPTZ,
  atl_change_pct NUMERIC,
  
  price_source TEXT DEFAULT 'polygon',
  price_updated_at TIMESTAMPTZ,
  
  rsi_14 NUMERIC,
  rsi_signal TEXT,
  
  sma_20 NUMERIC,
  sma_50 NUMERIC,
  sma_100 NUMERIC,
  sma_200 NUMERIC,
  ema_12 NUMERIC,
  ema_26 NUMERIC,
  ema_50 NUMERIC,
  ema_200 NUMERIC,
  
  price_vs_sma_20 TEXT,
  price_vs_sma_50 TEXT,
  price_vs_sma_200 TEXT,
  
  macd_line NUMERIC,
  macd_signal NUMERIC,
  macd_histogram NUMERIC,
  macd_trend TEXT,
  
  bollinger_upper NUMERIC,
  bollinger_middle NUMERIC,
  bollinger_lower NUMERIC,
  bollinger_position TEXT,
  
  stoch_k NUMERIC,
  stoch_d NUMERIC,
  stoch_signal TEXT,
  
  adx NUMERIC,
  adx_signal TEXT,
  
  technical_score INTEGER,
  technical_signal TEXT,
  
  technicals_updated_at TIMESTAMPTZ,
  
  galaxy_score INTEGER,
  galaxy_score_change_24h INTEGER,
  alt_rank INTEGER,
  alt_rank_change_24h INTEGER,
  
  sentiment INTEGER,
  sentiment_label TEXT,
  
  correlation_rank INTEGER,
  spam_score NUMERIC,
  
  social_volume_24h BIGINT,
  social_volume_change_24h_pct NUMERIC,
  social_dominance NUMERIC,
  
  interactions_24h BIGINT,
  interactions_change_24h_pct NUMERIC,
  
  contributors_active INTEGER,
  contributors_change_24h_pct NUMERIC,
  
  twitter_volume_24h BIGINT,
  twitter_sentiment INTEGER,
  twitter_interactions BIGINT,
  twitter_contributors INTEGER,
  
  reddit_volume_24h BIGINT,
  reddit_sentiment INTEGER,
  reddit_interactions BIGINT,
  reddit_contributors INTEGER,
  
  youtube_volume_24h BIGINT,
  youtube_sentiment INTEGER,
  youtube_interactions BIGINT,
  youtube_contributors INTEGER,
  
  tiktok_volume_24h BIGINT,
  tiktok_sentiment INTEGER,
  tiktok_interactions BIGINT,
  tiktok_contributors INTEGER,
  
  news_volume_24h BIGINT,
  news_sentiment INTEGER,
  
  telegram_volume_24h BIGINT,
  telegram_sentiment INTEGER,
  
  social_updated_at TIMESTAMPTZ,
  
  ai_summary TEXT,
  ai_summary_short TEXT,
  key_themes TEXT[],
  notable_events TEXT[],
  
  ai_updated_at TIMESTAMPTZ,
  
  top_posts JSONB DEFAULT '[]',
  top_posts_count INTEGER DEFAULT 0,
  
  posts_updated_at TIMESTAMPTZ,
  
  top_news JSONB DEFAULT '[]',
  top_news_count INTEGER DEFAULT 0,
  
  news_updated_at TIMESTAMPTZ,
  
  top_creators JSONB DEFAULT '[]',
  top_creators_count INTEGER DEFAULT 0,
  
  creators_updated_at TIMESTAMPTZ,
  
  is_honeypot BOOLEAN,
  honeypot_reason TEXT,
  honeypot_with_same_creator BOOLEAN,
  
  buy_tax NUMERIC,
  sell_tax NUMERIC,
  buy_tax_label TEXT,
  sell_tax_label TEXT,
  slippage_modifiable BOOLEAN,
  
  is_open_source BOOLEAN,
  is_proxy BOOLEAN,
  is_mintable BOOLEAN,
  can_take_back_ownership BOOLEAN,
  self_destruct BOOLEAN,
  external_call BOOLEAN,
  
  owner_address TEXT,
  creator_address TEXT,
  owner_can_change_balance BOOLEAN,
  hidden_owner BOOLEAN,
  is_ownership_renounced BOOLEAN,
  
  is_whitelisted BOOLEAN,
  is_blacklisted BOOLEAN,
  cannot_buy BOOLEAN,
  cannot_sell_all BOOLEAN,
  trading_cooldown BOOLEAN,
  transfer_pausable BOOLEAN,
  is_anti_whale BOOLEAN,
  
  holder_count INTEGER,
  top10_holder_percent NUMERIC,
  top10_holders JSONB DEFAULT '[]',
  
  lp_holder_count INTEGER,
  lp_total_supply NUMERIC,
  lp_holders JSONB DEFAULT '[]',
  is_lp_locked BOOLEAN,
  lp_lock_until TIMESTAMPTZ,
  
  security_score INTEGER,
  security_grade TEXT,
  security_flags TEXT[],
  security_risks_critical INTEGER DEFAULT 0,
  security_risks_high INTEGER DEFAULT 0,
  security_risks_medium INTEGER DEFAULT 0,
  security_risks_low INTEGER DEFAULT 0,
  
  security_chain TEXT,
  security_updated_at TIMESTAMPTZ,
  
  total_liquidity_usd NUMERIC,
  liquidity_change_24h_pct NUMERIC,
  
  dex_volume_24h NUMERIC,
  dex_volume_6h NUMERIC,
  dex_volume_1h NUMERIC,
  dex_buys_24h INTEGER,
  dex_sells_24h INTEGER,
  dex_buyers_24h INTEGER,
  dex_sellers_24h INTEGER,
  buy_sell_ratio NUMERIC,
  buy_sell_label TEXT,
  
  dex_pairs JSONB DEFAULT '[]',
  dex_pairs_count INTEGER DEFAULT 0,
  primary_dex TEXT,
  primary_dex_pair TEXT,
  oldest_pair_created_at TIMESTAMPTZ,
  pair_age_days INTEGER,
  
  liquidity_updated_at TIMESTAMPTZ,
  
  recent_trades JSONB DEFAULT '[]',
  large_trades_24h JSONB DEFAULT '[]',
  large_trades_count INTEGER DEFAULT 0,
  
  trades_updated_at TIMESTAMPTZ,
  
  zombiedog_analysis TEXT,
  zombiedog_signal TEXT,
  zombiedog_updated_at TIMESTAMPTZ,
  
  tier INTEGER DEFAULT 4,
  tier_reason TEXT,
  
  is_active BOOLEAN DEFAULT true,
  is_verified BOOLEAN DEFAULT false,
  is_scam BOOLEAN DEFAULT false,
  is_trending BOOLEAN DEFAULT false,
  
  manual_notes TEXT,
  manual_flags TEXT[],
  
  first_seen_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_token_cards_slug ON public.token_cards(slug);
CREATE INDEX idx_token_cards_lunarcrush_id ON public.token_cards(lunarcrush_id);
CREATE INDEX idx_token_cards_coingecko_id ON public.token_cards(coingecko_id);
CREATE INDEX idx_token_cards_polygon_ticker ON public.token_cards(polygon_ticker);
CREATE INDEX idx_token_cards_market_cap ON public.token_cards(market_cap DESC NULLS LAST);
CREATE INDEX idx_token_cards_volume ON public.token_cards(volume_24h_usd DESC NULLS LAST);
CREATE INDEX idx_token_cards_change_24h ON public.token_cards(change_24h_pct DESC NULLS LAST);
CREATE INDEX idx_token_cards_galaxy_score ON public.token_cards(galaxy_score DESC NULLS LAST);
CREATE INDEX idx_token_cards_alt_rank ON public.token_cards(alt_rank ASC NULLS LAST);
CREATE INDEX idx_token_cards_sentiment ON public.token_cards(sentiment DESC NULLS LAST);
CREATE INDEX idx_token_cards_social_volume ON public.token_cards(social_volume_24h DESC NULLS LAST);
CREATE INDEX idx_token_cards_market_cap_rank ON public.token_cards(market_cap_rank ASC NULLS LAST);
CREATE INDEX idx_token_cards_tier ON public.token_cards(tier);
CREATE INDEX idx_token_cards_primary_chain ON public.token_cards(primary_chain);
CREATE INDEX idx_token_cards_categories ON public.token_cards USING GIN(categories);
CREATE INDEX idx_token_cards_is_active ON public.token_cards(is_active) WHERE is_active = true;
CREATE INDEX idx_token_cards_is_trending ON public.token_cards(is_trending) WHERE is_trending = true;
CREATE INDEX idx_token_cards_price_updated ON public.token_cards(price_updated_at);
CREATE INDEX idx_token_cards_social_updated ON public.token_cards(social_updated_at);
CREATE INDEX idx_token_cards_security_updated ON public.token_cards(security_updated_at);

-- Tier calculation trigger
CREATE OR REPLACE FUNCTION public.calculate_token_tier()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.market_cap_rank IS NOT NULL THEN
    IF NEW.market_cap_rank <= 50 THEN
      NEW.tier = 1;
    ELSIF NEW.market_cap_rank <= 500 THEN
      NEW.tier = 2;
    ELSIF NEW.market_cap_rank <= 2000 THEN
      NEW.tier = 3;
    ELSE
      NEW.tier = 4;
    END IF;
    NEW.tier_reason = 'market_cap';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER token_cards_updated_at
  BEFORE UPDATE ON public.token_cards
  FOR EACH ROW
  EXECUTE FUNCTION public.update_token_cards_timestamp();

CREATE TRIGGER token_cards_tier_calculation
  BEFORE INSERT OR UPDATE OF market_cap_rank ON public.token_cards
  FOR EACH ROW
  EXECUTE FUNCTION public.calculate_token_tier();

-- RLS
ALTER TABLE public.token_cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to token_cards"
  ON public.token_cards FOR SELECT
  USING (true);

CREATE POLICY "Service role full access to token_cards"
  ON public.token_cards FOR ALL
  USING (true)
  WITH CHECK (true);

-- ═══════════════════════════════════════════════════════════════════════════════
-- TOKEN PRICE HISTORY
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE public.token_price_history (
  id BIGSERIAL PRIMARY KEY,
  token_symbol TEXT NOT NULL,
  timeframe TEXT NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL,
  open NUMERIC NOT NULL,
  high NUMERIC NOT NULL,
  low NUMERIC NOT NULL,
  close NUMERIC NOT NULL,
  volume NUMERIC,
  vwap NUMERIC,
  trade_count INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(token_symbol, timeframe, timestamp)
);

CREATE INDEX idx_token_price_hist_lookup ON public.token_price_history(token_symbol, timeframe, timestamp DESC);

ALTER TABLE public.token_price_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to token_price_history"
  ON public.token_price_history FOR SELECT USING (true);

CREATE POLICY "Service role full access to token_price_history"
  ON public.token_price_history FOR ALL USING (true) WITH CHECK (true);

-- ═══════════════════════════════════════════════════════════════════════════════
-- TOKEN SOCIAL HISTORY
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE public.token_social_history (
  id BIGSERIAL PRIMARY KEY,
  token_symbol TEXT NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL,
  timeframe TEXT NOT NULL,
  galaxy_score INTEGER,
  alt_rank INTEGER,
  sentiment INTEGER,
  social_volume BIGINT,
  interactions BIGINT,
  contributors INTEGER,
  price_usd NUMERIC,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(token_symbol, timeframe, timestamp)
);

CREATE INDEX idx_token_social_hist_lookup ON public.token_social_history(token_symbol, timeframe, timestamp DESC);

ALTER TABLE public.token_social_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to token_social_history"
  ON public.token_social_history FOR SELECT USING (true);

CREATE POLICY "Service role full access to token_social_history"
  ON public.token_social_history FOR ALL USING (true) WITH CHECK (true);