# pg_cron vs config.toml Comparison

**Date:** 2026-01-05

## Mapping: pg_cron Job Names → config.toml Function Names

| # | pg_cron Job Name | config.toml Function | Status |
|---|------------------|---------------------|--------|
| 1 | auto-map-exchange-tickers | `auto-map-exchange-tickers` | ✅ MATCH |
| 2 | auto-map-polygon-tickers | `auto-map-polygon-tickers` | ✅ MATCH |
| 3 | exchange-data-aggregator | `exchange-data-aggregator` | ✅ MATCH |
| 4 | exchange-sync | `exchange-sync` | ✅ MATCH |
| 5 | generate-brief-evening | `generate-brief-evening` | ✅ MATCH |
| 6 | generate-brief-morning | `generate-brief-morning` | ✅ MATCH |
| 7 | generate-sunday-special | `generate-sunday-special` | ✅ MATCH |
| 8 | lunarcrush-news-30min | `lunarcrush-news` | ✅ MATCH |
| 9 | manual-price-sync | `manual-price-sync` | ✅ MATCH |
| 10 | mark-polygon-tokens | `mark-polygon-tokens` | ✅ MATCH |
| 11 | massive-forex-sync | `massive-forex-sync` | ✅ MATCH |
| 12 | **news-fetch-rss** | ❌ **NOT IN config.toml** | ⚠️ **LEGACY** |
| 13 | polygon-company-prefetch-4hr | `polygon-company-prefetch` | ✅ MATCH |
| 14 | polygon-news-unified-15min | `polygon-news-unified` | ✅ MATCH |
| 15 | polygon-stock-poller-3min | `polygon-stock-poller` | ✅ MATCH |
| 16 | polygon-stock-snapshot-5min | `polygon-stock-snapshot` | ✅ MATCH |
| 17 | price-poller | `price-poller` | ✅ MATCH |
| 18 | **sync-cot-reports-monday-backup** | ❌ **NOT IN config.toml** | ⚠️ **LEGACY** |
| 19 | sync-cot-reports-weekly | `sync-cot-reports` | ✅ MATCH |
| 20 | sync-forex-cards-polygon-15min | `sync-forex-cards-polygon` | ✅ MATCH |
| 21 | sync-forex-cards-technicals-15min | `sync-forex-cards-technicals` | ✅ MATCH |
| 22 | sync-lunarcrush-ai-top25-hourly | `sync-lunarcrush-ai-top25` | ✅ MATCH |
| 23 | sync-lunarcrush-topics | `sync-lunarcrush-topics` | ✅ MATCH |
| 24 | sync-polygon-crypto-technicals | `sync-polygon-crypto-technicals` | ✅ MATCH |
| 25 | sync-stock-cards-10min | `sync-stock-cards` | ✅ MATCH |
| 26 | sync-stock-cards-52week-daily | `sync-stock-cards-52week` | ✅ MATCH |
| 27 | sync-stock-cards-technicals-5min | `sync-stock-cards-technicals` | ✅ MATCH |
| 28 | sync-token-cards-coingecko | `sync-token-cards-coingecko` | ✅ MATCH |
| 29 | sync-token-cards-coingecko-contracts | `sync-token-cards-coingecko-contracts` | ✅ MATCH |
| 30 | sync-token-cards-coingecko-prices-5min | `sync-token-cards-coingecko-prices` | ✅ MATCH |
| 31 | sync-token-cards-coingecko-technicals-daily | `sync-token-cards-coingecko-technicals` | ✅ MATCH |
| 32 | sync-token-cards-lunarcrush | `sync-token-cards-lunarcrush` | ✅ MATCH |
| 33 | sync-token-cards-lunarcrush-ai | `sync-token-cards-lunarcrush-ai` | ✅ MATCH |
| 34 | sync-token-cards-lunarcrush-enhanced | `sync-token-cards-lunarcrush-enhanced` | ✅ MATCH |
| 35 | sync-token-cards-lunarcrush-tier1 | `sync-token-cards-lunarcrush-tier1` | ✅ MATCH |
| 36 | sync-token-cards-lunarcrush-tier2 | `sync-token-cards-lunarcrush-tier2` | ✅ MATCH |
| 37 | sync-token-cards-lunarcrush-tier3 | `sync-token-cards-lunarcrush-tier3` | ✅ MATCH |
| 38 | sync-token-cards-metadata-daily | `sync-token-cards-metadata` | ✅ MATCH |
| 39 | sync-token-cards-polygon-1min | `sync-token-cards-polygon` | ✅ MATCH |
| 40 | sync-token-cards-websocket-5min | `sync-token-cards-websocket` | ✅ MATCH |
| 41 | sync-top500-technicals | `sync-top500-technicals` | ✅ MATCH |
| 42 | warm-derivs-cache | `warm-derivs-cache` | ✅ MATCH |

---

## ❌ Jobs in pg_cron but NOT in config.toml (2 total)

### 1. `news-fetch-rss`
- **Status:** ❌ **LEGACY/DEPRECATED**
- **Evidence:** config.toml line 50-53 shows:
  ```toml
  # DEPRECATED: Replaced by polygon-news-unified
  # Keep function for backwards compatibility but remove cron
  [functions.news-fetch]
  verify_jwt = false
  ```
- **Recommendation:** 🗑️ **REMOVE FROM pg_cron** - This is explicitly deprecated and replaced by `polygon-news-unified`

### 2. `sync-cot-reports-monday-backup`
- **Status:** ✅ **INTENTIONAL BACKUP** (but not in config.toml)
- **Evidence:** Migration `20260104033737_274e950e-4185-4591-9018-f743b0df1c51.sql` shows:
  ```sql
  -- Add Monday backup cron job to catch delayed COT releases (holidays, etc.)
  -- Runs every Monday at 2:00 PM UTC (9 AM ET, after market open)
  ```
- **Schedule:** `0 14 * * 1` (Monday at 2:00 PM UTC)
- **Purpose:** Backup job to catch delayed COT report releases on holidays/weekends
- **Recommendation:** 📝 **ADD TO config.toml** - This is a legitimate backup job that should be documented

---

## Summary

- **Total pg_cron jobs:** 42
- **Matched in config.toml:** 40
- **Not in config.toml:** 2 (both legacy/deprecated)

### Action Items

1. ✅ **Remove `news-fetch-rss`** from pg_cron (explicitly deprecated in config.toml)
2. 📝 **Add `sync-cot-reports-monday-backup`** to config.toml (legitimate backup job, needs documentation)

### SQL to Clean Up

```sql
-- Remove deprecated news-fetch-rss (replaced by polygon-news-unified)
SELECT cron.unschedule('news-fetch-rss');
```

### Recommended Addition to config.toml

```toml
# Backup COT reports sync - catches delayed releases on holidays/weekends
# Runs every Monday at 2:00 PM UTC (9 AM ET, after market open)
[functions.sync-cot-reports-monday-backup]
verify_jwt = false

[[functions.sync-cot-reports-monday-backup.cron]]
schedule = "0 14 * * 1"
```

**Note:** After removing `news-fetch-rss`, you'll have **41 active jobs** (40 from config.toml + 1 backup not yet in config.toml).
