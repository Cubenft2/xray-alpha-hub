# XRayCrypto™ - Database Schema Documentation

## Overview

XRayCrypto uses PostgreSQL (version 15) hosted on Supabase with 19 tables, Row-Level Security (RLS) enabled, and real-time subscriptions. Total database size: ~2GB in production.

---

## Table Categories

### 1. Core Tables (4)
- ticker_mappings
- live_prices
- market_briefs
- daily_quotes

### 2. Data Source Tables (4)
- cg_master
- poly_tickers
- poly_fx_pairs
- exchange_pairs

### 3. Social & Sentiment (2)
- social_sentiment
- market_alerts

### 4. News & Content (1)
- earnings_calendar

### 5. Metadata & Admin (5)
- pending_ticker_mappings
- missing_symbols
- market_brief_audits
- quote_library
- user_roles

### 6. System Tables (3)
- cache_kv
- site_settings
- price_sync_leader

---

## Detailed Schema

### 1. ticker_mappings

**Purpose**: Central symbol resolution system that maps various ticker formats to standardized internal format.

```sql
CREATE TABLE ticker_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol TEXT NOT NULL UNIQUE,              -- Normalized symbol (BTC, AAPL)
  display_name TEXT NOT NULL,               -- Human-readable (Bitcoin, Apple Inc.)
  display_symbol TEXT,                      -- Optional display override
  type TEXT NOT NULL,                       -- 'crypto', 'stock', 'forex'
  tradingview_symbol TEXT NOT NULL,         -- For TradingView charts
  aliases TEXT[],                           -- Alternative symbols
  
  -- Data source identifiers
  coingecko_id TEXT,                        -- CoinGecko API ID
  polygon_ticker TEXT,                      -- Polygon.io ticker
  coinglass_symbol TEXT,                    -- CoinGlass symbol
  
  -- Feature flags
  is_active BOOLEAN NOT NULL DEFAULT true,
  tradingview_supported BOOLEAN DEFAULT true,
  price_supported BOOLEAN DEFAULT true,
  social_supported BOOLEAN DEFAULT false,
  derivs_supported BOOLEAN DEFAULT false,
  
  -- Exchange info (for crypto)
  exchange TEXT,                            -- Primary exchange
  preferred_exchange TEXT,                  -- User preference
  dex_address TEXT,                         -- DEX contract address
  dex_chain TEXT,                           -- Blockchain (ethereum, bsc)
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ticker_mappings_symbol ON ticker_mappings(symbol);
CREATE INDEX idx_ticker_mappings_type ON ticker_mappings(type);
CREATE INDEX idx_ticker_mappings_coingecko ON ticker_mappings(coingecko_id);
CREATE INDEX idx_ticker_mappings_polygon ON ticker_mappings(polygon_ticker);
CREATE INDEX idx_ticker_mappings_active ON ticker_mappings(is_active);
```

**RLS Policies**:
- Public read for active mappings
- Service role full access

**Sample Data**:
```json
{
  "symbol": "BTC",
  "display_name": "Bitcoin",
  "type": "crypto",
  "tradingview_symbol": "BINANCE:BTCUSDT",
  "aliases": ["XBT", "BITCOIN"],
  "coingecko_id": "bitcoin",
  "is_active": true,
  "price_supported": true,
  "social_supported": true
}
```

### Usage in Charts

The `ticker_mappings` table is central to the chart rendering system:

#### **MiniChart Component Consumption**
```typescript
// 1. Check explicit overrides first
const override = OVERRIDES[symbol.toUpperCase()];
if (override) return override.symbol;

// 2. Query ticker_mappings table
const mapping = await supabase
  .from('ticker_mappings')
  .select('tradingview_symbol, coingecko_id, polygon_ticker')
  .eq('symbol', symbol)
  .single();

// 3. Use tradingview_symbol for chart rendering
if (mapping.tradingview_symbol) {
  renderTradingViewChart(mapping.tradingview_symbol);
}
```

#### **TradingView Symbol Field**
The `tradingview_symbol` field stores exchange-qualified symbols:
- **Crypto**: `BINANCE:BTCUSDT`, `BYBIT:ETHUSD`, `COINBASE:ETHUSD`
- **Stocks**: `NASDAQ:AAPL`, `NYSE:TSLA`, `AMEX:SPY`
- **Forex**: `FX:EURUSD`, `OANDA:GBPUSD`

#### **Fallback Behavior**
When `tradingview_supported: false`:
- MiniChart automatically uses sparkline fallback
- Uses `coingecko_id` or `polygon_ticker` for price data
- No TradingView widget is rendered

#### **Override Examples**
Special cases requiring explicit overrides:
```json
{
  "symbol": "WAL",
  "tradingview_symbol": "WALUSD",
  "note": "Direct TradingView symbol, no exchange prefix needed"
},
{
  "symbol": "USELESS",
  "tradingview_symbol": "USELESSUSD",
  "note": "Custom TradingView symbol format"
}
```

---

### 2. live_prices

**Purpose**: Real-time price data for all supported assets (crypto, stocks, forex).

```sql
CREATE TABLE live_prices (
  ticker TEXT PRIMARY KEY,                  -- Normalized ticker
  display TEXT NOT NULL,                    -- Display name
  price NUMERIC NOT NULL,                   -- Current price (USD)
  change24h NUMERIC NOT NULL,               -- 24h change %
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_live_prices_updated ON live_prices(updated_at DESC);
```

**RLS Policies**:
- Public read access
- Service role write access

**Update Frequency**:
- Crypto: Real-time (via WebSocket)
- Stocks: 15-second delay (market hours)
- Forex: Real-time

**Sample Data**:
```json
{
  "ticker": "BTC",
  "display": "Bitcoin",
  "price": 45230.50,
  "change24h": 3.45,
  "updated_at": "2025-01-15T14:23:10Z"
}
```

---

### 3. market_briefs

**Purpose**: Store AI-generated market analysis briefs (daily and weekly).

```sql
CREATE TABLE market_briefs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,                -- URL-friendly ID
  title TEXT NOT NULL,                      -- Brief title
  brief_type VARCHAR NOT NULL,              -- 'daily' or 'weekly'
  
  -- Main content
  executive_summary TEXT NOT NULL,          -- TL;DR section
  content_sections JSONB NOT NULL DEFAULT '{}',  -- All sections
  
  -- Additional data
  market_data JSONB DEFAULT '{}',           -- Market metrics
  social_data JSONB DEFAULT '{}',           -- Social sentiment
  featured_assets TEXT[],                   -- Main assets discussed
  
  -- Quote
  stoic_quote TEXT,
  stoic_quote_author TEXT,
  
  -- Metrics
  sentiment_score NUMERIC,                  -- Overall sentiment
  view_count INTEGER DEFAULT 0,
  
  -- Publishing
  is_published BOOLEAN DEFAULT false,
  published_at TIMESTAMPTZ,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_market_briefs_slug ON market_briefs(slug);
CREATE INDEX idx_market_briefs_type ON market_briefs(brief_type);
CREATE INDEX idx_market_briefs_published ON market_briefs(is_published, published_at DESC);
```

**RLS Policies**:
- Public read for published briefs only
- Service role full access

**Content Sections Structure**:
```json
{
  "executive_summary": "...",
  "market_overview": {
    "fear_greed_index": 65,
    "fear_greed_label": "Greed",
    "top_gainers": [...],
    "top_losers": [...]
  },
  "featured_assets": [
    {
      "symbol": "BTC",
      "analysis": "...",
      "metrics": {...}
    }
  ],
  "social_data": {
    "top_social_assets": [...],
    "avg_galaxy_score": 72
  },
  "news_summary": [...],
  "market_alerts": [...]
}
```

---

### 4. daily_quotes

**Purpose**: Track which quotes have been used in which briefs.

```sql
CREATE TABLE daily_quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brief_id UUID REFERENCES market_briefs(id),
  brief_type VARCHAR NOT NULL,
  quote_text TEXT NOT NULL,
  author TEXT NOT NULL,
  source TEXT NOT NULL,
  used_date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_daily_quotes_date ON daily_quotes(used_date DESC);
CREATE INDEX idx_daily_quotes_brief ON daily_quotes(brief_id);
```

---

### 5. cg_master

**Purpose**: Master list of all cryptocurrencies from CoinGecko.

```sql
CREATE TABLE cg_master (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cg_id TEXT NOT NULL UNIQUE,               -- CoinGecko ID
  symbol TEXT NOT NULL,                     -- Symbol (btc, eth)
  name TEXT NOT NULL,                       -- Full name
  platforms JSONB DEFAULT '{}',             -- Contract addresses by chain
  created_at TIMESTAMPTZ DEFAULT now(),
  synced_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_cg_master_symbol ON cg_master(symbol);
CREATE INDEX idx_cg_master_synced ON cg_master(synced_at DESC);
```

**Platforms Structure**:
```json
{
  "ethereum": "0x...",
  "binance-smart-chain": "0x...",
  "polygon-pos": "0x..."
}
```

---

### 6. poly_tickers

**Purpose**: Stock ticker data from Polygon.io.

```sql
CREATE TABLE poly_tickers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticker TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  market TEXT NOT NULL,                     -- 'stocks', 'crypto', 'fx'
  locale TEXT,                              -- 'us', 'global'
  primary_exchange TEXT,                    -- 'XNAS', 'XNYS'
  type TEXT,                                -- 'CS' (common stock), 'ETF'
  active BOOLEAN DEFAULT true,
  delisted_utc TIMESTAMPTZ,
  currency_name TEXT,
  base_currency_symbol TEXT,
  base_currency_name TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  synced_at TIMESTAMPTZ DEFAULT now(),
  last_updated_utc TIMESTAMPTZ
);

CREATE INDEX idx_poly_tickers_ticker ON poly_tickers(ticker);
CREATE INDEX idx_poly_tickers_active ON poly_tickers(active);
CREATE INDEX idx_poly_tickers_market ON poly_tickers(market);
```

---

### 7. poly_fx_pairs

**Purpose**: Forex pairs from Polygon.io.

```sql
CREATE TABLE poly_fx_pairs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticker TEXT NOT NULL UNIQUE,              -- 'C:EURUSD'
  name TEXT NOT NULL,                       -- 'Euro - United States Dollar'
  base_currency TEXT NOT NULL,              -- 'EUR'
  quote_currency TEXT NOT NULL,             -- 'USD'
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  synced_at TIMESTAMPTZ DEFAULT now()
);
```

---

### 8. exchange_pairs

**Purpose**: Trading pairs from centralized exchanges.

```sql
CREATE TABLE exchange_pairs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exchange TEXT NOT NULL,                   -- 'binance', 'coinbase'
  symbol TEXT NOT NULL,                     -- 'BTCUSDT'
  base_asset TEXT NOT NULL,                 -- 'BTC'
  quote_asset TEXT NOT NULL,                -- 'USDT'
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  synced_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(exchange, symbol)
);

CREATE INDEX idx_exchange_pairs_exchange ON exchange_pairs(exchange);
CREATE INDEX idx_exchange_pairs_base ON exchange_pairs(base_asset);
```

---

### 9. social_sentiment

**Purpose**: Social sentiment data from LunarCrush.

```sql
CREATE TABLE social_sentiment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_symbol TEXT NOT NULL,
  asset_name TEXT NOT NULL,
  sentiment_score NUMERIC NOT NULL,         -- -1 to 1
  social_volume INTEGER DEFAULT 0,          -- Mentions count
  social_volume_24h_change NUMERIC,         -- % change
  galaxy_score NUMERIC,                     -- 0-100 proprietary score
  trending_rank INTEGER,                    -- Rank in trending
  viral_posts JSONB DEFAULT '[]',           -- Top posts
  top_influencers JSONB DEFAULT '[]',       -- Top voices
  data_timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_social_sentiment_symbol ON social_sentiment(asset_symbol);
CREATE INDEX idx_social_sentiment_timestamp ON social_sentiment(data_timestamp DESC);
CREATE INDEX idx_social_sentiment_galaxy ON social_sentiment(galaxy_score DESC);
```

---

### 10. market_alerts

**Purpose**: Real-time market alerts for significant events.

```sql
CREATE TABLE market_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_type VARCHAR NOT NULL,              -- 'price', 'volume', 'sentiment'
  severity VARCHAR,                         -- 'info', 'warning', 'critical'
  asset_symbol TEXT NOT NULL,
  asset_name TEXT NOT NULL,
  alert_message TEXT NOT NULL,
  trigger_value NUMERIC,
  current_value NUMERIC,
  is_active BOOLEAN DEFAULT true,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_market_alerts_active ON market_alerts(is_active, created_at DESC);
CREATE INDEX idx_market_alerts_symbol ON market_alerts(asset_symbol);
```

**RLS Policies**:
- Public read for active alerts only

---

### 11. earnings_calendar

**Purpose**: Upcoming earnings dates for stocks.

```sql
CREATE TABLE earnings_calendar (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stock_symbol TEXT NOT NULL,
  company_name TEXT NOT NULL,
  earnings_date DATE NOT NULL,
  earnings_time VARCHAR,                    -- 'BMO', 'AMC', 'Time TBA'
  expected_eps NUMERIC,
  category TEXT,                            -- 'tech', 'finance', etc.
  is_crypto_related BOOLEAN DEFAULT false,
  importance_score INTEGER,                 -- 1-10
  social_sentiment NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_earnings_date ON earnings_calendar(earnings_date);
CREATE INDEX idx_earnings_symbol ON earnings_calendar(stock_symbol);
```

---

### 12. pending_ticker_mappings

**Purpose**: Symbols detected in briefs that need admin review/approval.

```sql
CREATE TABLE pending_ticker_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol TEXT NOT NULL,
  normalized_symbol TEXT NOT NULL,
  display_name TEXT,
  match_type TEXT,                          -- 'exact_symbol', 'fuzzy', 'ai'
  confidence_score NUMERIC DEFAULT 0.00,    -- 0-1
  tradingview_symbol TEXT,
  coingecko_id TEXT,
  polygon_ticker TEXT,
  aliases TEXT[],
  context JSONB DEFAULT '{}',               -- Where symbol was found
  status TEXT DEFAULT 'pending',            -- 'pending', 'approved', 'rejected'
  validation_notes TEXT,
  auto_approved BOOLEAN DEFAULT false,
  reviewed_by TEXT,
  reviewed_at TIMESTAMPTZ,
  seen_count INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_pending_status ON pending_ticker_mappings(status);
CREATE INDEX idx_pending_confidence ON pending_ticker_mappings(confidence_score DESC);
```

---

### 13. missing_symbols

**Purpose**: Track unrecognized symbols for pattern analysis.

```sql
CREATE TABLE missing_symbols (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol TEXT NOT NULL,
  normalized_symbol TEXT NOT NULL,
  occurrence_count INTEGER DEFAULT 1,
  first_seen_at TIMESTAMPTZ DEFAULT now(),
  last_seen_at TIMESTAMPTZ DEFAULT now(),
  context JSONB DEFAULT '{}',
  resolved BOOLEAN DEFAULT false,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_missing_symbols_symbol ON missing_symbols(normalized_symbol);
CREATE INDEX idx_missing_symbols_count ON missing_symbols(occurrence_count DESC);
```

---

### 14. market_brief_audits

**Purpose**: Validation metrics and audit trail for market briefs.

```sql
CREATE TABLE market_brief_audits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brief_id UUID REFERENCES market_briefs(id),
  missing_symbols TEXT[],                   -- Symbols that couldn't be resolved
  provider_status JSONB NOT NULL DEFAULT '{}',  -- API health checks
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audits_brief ON market_brief_audits(brief_id);
CREATE INDEX idx_audits_created ON market_brief_audits(created_at DESC);
```

**Provider Status Structure**:
```json
{
  "coingecko": {
    "status": "success",
    "response_time_ms": 234,
    "coins_fetched": 100
  },
  "polygon": {
    "status": "success",
    "response_time_ms": 156
  },
  "lunarcrush": {
    "status": "rate_limited",
    "retry_after": 60
  }
}
```

---

### 15. quote_library

**Purpose**: Library of stoic and trading quotes for briefs.

```sql
CREATE TABLE quote_library (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_text TEXT NOT NULL,
  author TEXT NOT NULL,
  category TEXT,                            -- 'stoic', 'trading', 'wisdom'
  is_active BOOLEAN NOT NULL DEFAULT true,
  times_used INTEGER NOT NULL DEFAULT 0,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_quote_library_active ON quote_library(is_active);
CREATE INDEX idx_quote_library_times_used ON quote_library(times_used);
```

---

### 16. cache_kv

**Purpose**: Key-value cache for expensive operations (service role only).

```sql
CREATE TABLE cache_kv (
  k TEXT PRIMARY KEY,
  v JSONB NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_cache_expires ON cache_kv(expires_at);
```

**RLS**: Deny all public/authenticated access, service role only

---

### 17. site_settings

**Purpose**: App-wide configuration (service role only).

```sql
CREATE TABLE site_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key TEXT NOT NULL UNIQUE,
  setting_value JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**RLS**: Deny all public/authenticated access, service role only

---

### 18. price_sync_leader

**Purpose**: Leader election for price sync jobs (prevents duplicate runs).

```sql
CREATE TABLE price_sync_leader (
  id TEXT PRIMARY KEY DEFAULT 'singleton',
  instance_id TEXT NOT NULL,
  heartbeat_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

---

### 19. user_roles

**Purpose**: Role-Based Access Control (RBAC) for admin features.

```sql
CREATE TYPE app_role AS ENUM ('admin', 'moderator', 'user');

CREATE TABLE user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, role)
);

CREATE INDEX idx_user_roles_user ON user_roles(user_id);
```

**RLS Policies**:
- Users can view their own roles only
- Service role full access

---

## Database Functions

### 1. has_role()

**Purpose**: Security definer function to check user roles (prevents recursive RLS).

```sql
CREATE OR REPLACE FUNCTION has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;
```

### 2. update_updated_at_column()

**Purpose**: Trigger function to auto-update `updated_at` timestamps.

```sql
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
```

### 3. auto_approve_pending_mappings()

**Purpose**: Automatically approve high-confidence pending ticker mappings.

```sql
CREATE OR REPLACE FUNCTION auto_approve_pending_mappings()
RETURNS TABLE(approved_count INTEGER, rejected_count INTEGER)
...
```

---

## Performance Optimization

### Indexes
- Primary keys on all tables
- Foreign key columns indexed
- Frequently queried columns (symbol, date, active status)
- Composite indexes for common query patterns

### Partitioning (Future)
- Plan to partition `social_sentiment` by date
- Plan to partition `market_brief_audits` by date

### Vacuum & Analyze
- Auto-vacuum enabled
- Analyze runs after major inserts

---

## Backup & Recovery

### Automated Backups
- **Frequency**: Daily full backups
- **Retention**: 30 days
- **Location**: Supabase managed backup storage

### Point-in-Time Recovery
- **Enabled**: Yes
- **Window**: 7 days

---

**Total Tables**: 19
**Total Rows (est.)**: 1.5M+
**Database Size**: ~2GB
**Indexes**: 45+
**RLS Enabled**: All tables
**Real-time**: Enabled on live_prices, market_briefs
