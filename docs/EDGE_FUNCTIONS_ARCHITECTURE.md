# Edge Functions Architecture

## Overview

XR Market Watch uses a **Master Cards Architecture** where all market data flows into three central tables:

| Master Table | Purpose | Data Sources |
|-------------|---------|--------------|
| `token_cards` | Every crypto token | Polygon, CoinGecko, LunarCrush |
| `stock_cards` | Every stock | Polygon |
| `forex_cards` | Every forex pair | Polygon |

**One card per asset. All data flows INTO that card. ZombieDog's complete brain.**

---

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           EXTERNAL DATA SOURCES                              │
├─────────────────┬─────────────────────┬─────────────────────────────────────┤
│  POLYGON.IO     │    COINGECKO        │       LUNARCRUSH                    │
│  (~456 tokens)  │    (7,500+ tokens)  │       (Social sentiment)            │
│  Real-time      │    Comprehensive    │       Social metrics only           │
└────────┬────────┴──────────┬──────────┴─────────────────┬───────────────────┘
         │                   │                            │
         ▼                   ▼                            ▼
┌────────────────┐  ┌────────────────────┐  ┌────────────────────────────────┐
│sync-token-cards│  │sync-token-cards-   │  │sync-token-cards-lunarcrush     │
│-polygon        │  │coingecko-*         │  │                                │
└────────┬───────┘  └─────────┬──────────┘  └─────────────────┬──────────────┘
         │                    │                               │
         │ polygon_* cols     │ coingecko_* cols              │ lunarcrush_* cols
         │                    │                               │
         ▼                    ▼                               ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                            TOKEN_CARDS TABLE                                 │
│                                                                              │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────────────┐   │
│  │ POLYGON DATA     │  │ COINGECKO DATA   │  │ LUNARCRUSH DATA          │   │
│  │ polygon_price_usd│  │ coingecko_price  │  │ galaxy_score             │   │
│  │ polygon_rsi_14   │  │ coingecko_market │  │ alt_rank                 │   │
│  │ polygon_sma_*    │  │ coingecko_rsi_14 │  │ social_volume            │   │
│  │ polygon_macd_*   │  │ coingecko_sma_*  │  │ sentiment                │   │
│  │ polygon_updated  │  │ coingecko_ath/atl│  │ social_contributors      │   │
│  └──────────────────┘  └──────────────────┘  └──────────────────────────┘   │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │ DISPLAY COLUMNS (computed from best source)                            │ │
│  │ price_usd, price_source, rsi_14, market_cap, market_cap_rank           │ │
│  │ Trigger: compute_display_price() picks freshest source automatically   │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Multi-Source Design Philosophy

The token card is designed to hold data from **MULTIPLE sources** in **SEPARATE columns**. This is intentional:

### Why Keep Duplicate Data?

1. **Coverage Gap**: Polygon only covers ~456 tokens, CoinGecko covers 7,500+
2. **Freshness**: Polygon has real-time data for supported tokens
3. **AI Decision Making**: ZombieDog can choose the best/freshest source per token
4. **Cross-Validation**: Compare data from multiple sources for accuracy
5. **Fallback**: If one source fails, others are available

### Source Selection Logic

| Token | Polygon | CoinGecko | LunarCrush | Best Price Source |
|-------|---------|-----------|------------|-------------------|
| BTC | ✅ | ✅ | ✅ | Polygon (real-time) |
| ETH | ✅ | ✅ | ✅ | Polygon (real-time) |
| Random altcoin | ❌ | ✅ | ✅ | CoinGecko |
| New memecoin | ❌ | ✅ | ❌ | CoinGecko |

---

## Active Edge Functions

### Token Cards Sync (Primary Pipeline)

| Function | Schedule | Writes To | Source | Purpose |
|----------|----------|-----------|--------|---------|
| `sync-token-cards-polygon` | Every 1 min | `polygon_*` cols | Polygon | Real-time prices, OHLCV |
| `sync-token-cards-coingecko-prices` | Every 5 min | `coingecko_*` cols | CoinGecko | Market cap, supply, ATH/ATL |
| `sync-token-cards-coingecko-technicals` | 4x daily | `coingecko_rsi_*` | CoinGecko | RSI, SMA for non-Polygon tokens |
| `sync-token-cards-coingecko` | Daily 2:05 AM | `coingecko_id` | CoinGecko | ID mapping |
| `sync-token-cards-coingecko-contracts` | Daily 6:35 AM | `contracts` | CoinGecko | Contract addresses |
| `sync-token-cards-lunarcrush` | Every 4 min | `lunarcrush_*` cols | LunarCrush | Social metrics, sentiment |
| `sync-token-cards-metadata` | Daily 6:20 AM | `description`, `website` | CoinGecko | Metadata |
| `sync-polygon-crypto-technicals` | Every 3 min | `polygon_rsi_*` | Polygon | Technicals for Polygon tokens |
| `sync-token-news-polygon` | Every 15 min | `news_cache` | Polygon | FREE news (unlimited) |

### Stock Cards Sync

| Function | Schedule | Writes To | Source | Purpose |
|----------|----------|-----------|--------|---------|
| `sync-stock-cards` | Every 10 min | `stock_cards` | Polygon | Prices + company details |
| `sync-stock-cards-technicals` | Every 5 min | `stock_cards` | Polygon | RSI, SMA, MACD |
| `sync-stock-cards-52week` | Daily 7:45 AM | `stock_cards` | Polygon | 52-week high/low |
| `sync-stock-news-polygon` | Every 15 min | `news_cache` | Polygon | Stock news |

### Forex Cards Sync

| Function | Schedule | Writes To | Source | Purpose |
|----------|----------|-----------|--------|---------|
| `sync-forex-cards-polygon` | Every 15 min | `forex_cards` | Polygon | Prices |
| `sync-forex-cards-technicals` | Every 15 min | `forex_cards` | Polygon | Technicals |

### Supporting Functions

| Function | Schedule | Purpose |
|----------|----------|---------|
| `massive-crypto-snapshot` | Every 2 min | Prices to `live_prices` (intermediate) |
| `price-poller` | Every 5 min | Real-time prices |
| `polygon-stock-poller` | Every 5 min | Stock prices |
| `polygon-stock-snapshot` | Every 5 min | Stock snapshot |
| `exchange-data-aggregator` | Every 15 min | Exchange prices |
| `exchange-sync` | Every 6 hours | Exchange pair discovery |
| `polygon-company-prefetch` | Every 4 hours | Bulk company details |
| `auto-map-polygon-tickers` | Daily 2:15 AM | Ticker mapping |
| `auto-map-exchange-tickers` | Daily 2:30 AM | Exchange ticker mapping |

### ZombieDog AI

| Function | Purpose |
|----------|---------|
| `zombiedog-agent` | AI orchestrator - reads from master cards |
| `zombiedog-chat` | Chat interface |

### Content Generation

| Function | Schedule | Purpose |
|----------|----------|---------|
| `generate-brief-morning` | Daily 11:00 AM | Morning market brief |
| `generate-brief-evening` | Daily 11:00 PM | Evening market brief |
| `generate-sunday-special` | Weekly Monday 1:00 AM | Weekly deep dive |
| `news-fetch` | Every 15 min | RSS news aggregation |

---

## Column Mapping Reference

### token_cards - Polygon Columns

| Column | Description |
|--------|-------------|
| `polygon_ticker` | Polygon ticker symbol (e.g., `X:BTCUSD`) |
| `polygon_supported` | Whether Polygon has this token |
| `polygon_price_usd` | Real-time price |
| `polygon_change_24h_pct` | 24h change % |
| `polygon_volume_24h` | 24h volume |
| `polygon_high_24h`, `polygon_low_24h` | 24h range |
| `polygon_rsi_14` | RSI indicator |
| `polygon_sma_20`, `polygon_sma_50`, `polygon_sma_200` | Moving averages |
| `polygon_macd_line`, `polygon_macd_signal`, `polygon_macd_histogram` | MACD |
| `polygon_price_updated_at` | Last price update |

### token_cards - CoinGecko Columns

| Column | Description |
|--------|-------------|
| `coingecko_id` | CoinGecko coin ID |
| `coingecko_price_usd` | Price |
| `coingecko_market_cap` | Market cap |
| `coingecko_market_cap_rank` | Rank |
| `coingecko_volume_24h` | 24h volume |
| `coingecko_change_24h_pct` | 24h change % |
| `coingecko_circulating_supply`, `coingecko_total_supply`, `coingecko_max_supply` | Supply |
| `coingecko_ath`, `coingecko_ath_date`, `coingecko_ath_change_pct` | All-time high |
| `coingecko_atl`, `coingecko_atl_date`, `coingecko_atl_change_pct` | All-time low |
| `coingecko_rsi_14` | RSI (calculated from history) |
| `coingecko_sma_20`, `coingecko_sma_50` | Moving averages |
| `coingecko_price_updated_at` | Last price update |

### token_cards - LunarCrush Columns

| Column | Description |
|--------|-------------|
| `lunarcrush_id` | LunarCrush ID |
| `galaxy_score` | Galaxy Score (1-100) |
| `alt_rank` | AltRank position |
| `social_volume` | Social mentions volume |
| `social_contributors` | Unique contributors |
| `sentiment` | Sentiment score |
| `lunarcrush_price_usd` | Price from LunarCrush |
| `lunarcrush_price_updated_at` | Last update |

### token_cards - Display Columns (Computed)

| Column | Description |
|--------|-------------|
| `price_usd` | Best available price |
| `price_source` | Which source (`polygon`, `coingecko`, `lunarcrush`) |
| `price_updated_at` | Freshest timestamp |
| `market_cap` | From CoinGecko (authoritative) |
| `market_cap_rank` | From CoinGecko (authoritative) |
| `rsi_14` | Best available RSI |
| `sma_20`, `sma_50`, `sma_200` | Best available MAs |

---

## Deleted Functions (Deprecated)

These functions were removed because they wrote to deprecated tables:

| Function | Reason | Replaced By |
|----------|--------|-------------|
| `sync-polygon-crypto-reference` | Wrote to `polygon_crypto_cards` | `sync-token-cards-polygon` |
| `sync-polygon-crypto-snapshot` | Wrote to `polygon_crypto_cards` | `sync-token-cards-polygon` |
| `bootstrap-polygon-to-token-cards` | Read from `polygon_crypto_cards` | Direct writes to `token_cards` |
| `polygon-indicators-refresh` | Wrote to `technical_indicators` | `sync-polygon-crypto-technicals` |
| `lunarcrush-sync` | Wrote to `crypto_snapshot` | `sync-token-cards-lunarcrush` |
| `polygon-crypto-snapshot` | Wrote to `crypto_snapshot` | `sync-token-cards-polygon` |
| `massive-forex-snapshot` | Wrote to `live_prices` | `sync-forex-cards-polygon` |
| `warm-news-cache` | Expensive Tavily API | `sync-token-news-polygon` (FREE) |

---

## External API Dependencies

| API | Functions Using It | Cost Model |
|-----|-------------------|------------|
| **Polygon.io** | All `polygon-*`, `sync-*-polygon` | Unlimited (paid plan) |
| **CoinGecko** | All `coingecko-*`, `sync-*-coingecko-*` | Rate limited (500/min) |
| **LunarCrush** | `sync-token-cards-lunarcrush`, `lunarcrush-*` | Rate limited |
| **Anthropic** | `zombiedog-agent`, `generate-brief-*` | Per token |

---

## Cron Schedule Summary

| Time Offset | Functions |
|-------------|-----------|
| `:00` | Token cards Polygon prices |
| `:01,:04,:07...` | Polygon crypto technicals |
| `:01,:06,:11...` | Polygon stock poller |
| `:01,:03,:05...` | Massive crypto snapshot |
| `:02,:07,:12...` | Price poller |
| `:02,:06,:10...` | Token cards LunarCrush |
| `:03,:08,:13...` | Stock cards technicals, Polygon stock snapshot |
| `:04,:09,:14...` | CoinGecko prices, Derivs cache |
| `:05,:20,:35,:50` | Exchange data, Forex prices |
| `:07,:22,:37,:52` | Forex technicals |
| `:08,:23,:38,:53` | News fetch |
| `:10,:25,:40,:55` | Token news Polygon |
| `:12,:27,:42,:57` | Stock news Polygon |
| `:15 */4` | Company prefetch |
| `:20 */6` | Exchange sync |
| `:30 *` | Manual price sync |

---

## Best Practices

### DO:
- Write to master card tables (`token_cards`, `stock_cards`, `forex_cards`)
- Use source-prefixed columns (`polygon_*`, `coingecko_*`, `lunarcrush_*`)
- Let the `compute_display_price` trigger handle source selection
- Stagger cron schedules to avoid API rate limits

### DON'T:
- Write to deprecated tables (`crypto_snapshot`, `polygon_crypto_cards`, `technical_indicators`)
- Remove functions just because they seem to duplicate data
- Overwrite source-specific columns with data from other sources
