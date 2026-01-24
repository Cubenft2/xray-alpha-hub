# Cron Audit Cleanup Summary

**Date:** 2026-01-05

## Files Organized

### ✅ Deleted
- `remove_legacy_news_fetch.sql` - We decided to keep `news-fetch-rss` after analysis

### ✅ Moved to `scripts/`
- `add_missing_cron_jobs.sql` - SQL script to add 13 missing cron jobs (already executed)
- `add_missing_cron_jobs_clean.sql` - Clean version without psql-specific commands
- `fix_lunarcrush_minute0_collision.sql` - Fix for minute-0 collision (already executed)
- `verify_cron_audit.sql` - Verification queries
- `verify_jobs_after_15min.sql` - Post-fix verification queries

### ✅ Moved to `docs/`
- `CRON_AUDIT_SUMMARY.md` - Summary of cron audit findings
- `PG_CRON_VS_CONFIG_TOML_COMPARISON.md` - Comparison of pg_cron vs config.toml
- `NEWS_FETCH_RSS_ANALYSIS.md` - Analysis of news-fetch-rss function

## Documentation Updates

### `docs/EDGE_FUNCTIONS_AUDIT.md`
- ✅ Updated count: 42 active cron jobs (40 in config.toml + 2 manual/legacy)
- ✅ Added `news-fetch-rss` to active cron list (not in config.toml)
- ✅ Added `sync-cot-reports-monday-backup` to active cron list (not in config.toml)
- ✅ Updated deprecated section to clarify `news-fetch` function is deprecated but `news-fetch-rss` cron job is active
- ✅ Added note about `sync-cot-reports` (was missing from list)

## Current State

### Total Active Cron Jobs: 42
- **40 jobs** defined in `supabase/config.toml`
- **2 jobs** manually created in pg_cron (not in config.toml):
  1. `news-fetch-rss` - RSS news aggregation (provides feed diversity)
  2. `sync-cot-reports-monday-backup` - Backup COT reports sync (catches delayed releases)

### Recommendations
1. ✅ **Keep `news-fetch-rss`** - Provides RSS feed diversity, low cost, actively used by `get-cached-news`
2. ✅ **Keep `sync-cot-reports-monday-backup`** - Intentional backup job for holiday/weekend delays
3. 📝 **Consider adding both to config.toml** - For better documentation and consistency

## Next Steps
1. Monitor `news-fetch-rss` usage to confirm it's still needed
2. Add `news-fetch-rss` and `sync-cot-reports-monday-backup` to `config.toml` for documentation
3. Update `docs/EDGE_FUNCTIONS_AUDIT.md` if schedules change
