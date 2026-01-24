# Cron System Audit Summary

**Date:** 2026-01-05  
**Verified Against:** Lovable's findings

## Key Findings

### 1. Job Count Verification
- **config.toml:** 40 cron schedules defined
- **pg_cron (expected):** 42 active jobs
- **Documentation:** Fixed from 48 → 42

**Discrepancy:** 2 extra jobs in pg_cron not in config.toml (likely legacy or manually added)

### 2. sync-token-cards-lunarcrush Schedule
- **config.toml:** `59 1,3,5,7,9,11,13,15,17,19,21,23 * * *` (odd hours at :59)
- **pg_cron (current):** `0 */2 * * *` ❌ **MINUTE-0 COLLISION**
- **pg_cron (should be):** `59 */2 * * *` ✅ (even hours at :59)

**Note:** The fixed schedule (`59 */2 * * *`) differs from config.toml. This is intentional to:
- Avoid minute-0 collisions
- Run at even hours (0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22) instead of odd hours

### 3. Minute-0 Collision Check

**Query to find collisions:**
```sql
SELECT jobname, schedule 
FROM cron.job 
WHERE active = true
  AND (
    schedule LIKE '0 %'
    OR schedule LIKE '*/% * * * *'
    OR schedule LIKE '0,%'
    OR schedule LIKE '%,0 %'
  )
ORDER BY jobname;
```

**Expected intentional minute-0 jobs:**
- `generate-brief-morning`: `0 11 * * *` (intentional - daily at 11 AM)
- `generate-brief-evening`: `0 23 * * *` (intentional - daily at 11 PM)
- `generate-sunday-special`: `0 1 * * 1` (intentional - weekly)
- `sync-cot-reports`: `0 4 * * 6` (intentional - weekly Saturday)

**Problem jobs (should be fixed):**
- `sync-token-cards-lunarcrush`: Currently `0 */2 * * *` → Should be `59 */2 * * *`

### 4. Functions vs Cron Jobs

**Functions in `supabase/functions/` that have cron in config.toml (40 total):**
1. manual-price-sync
2. generate-brief-morning
3. generate-brief-evening
4. generate-sunday-special
5. exchange-data-aggregator
6. exchange-sync
7. polygon-stock-poller
8. polygon-company-prefetch
9. auto-map-polygon-tickers
10. auto-map-exchange-tickers
11. price-poller
12. lunarcrush-news
13. polygon-stock-snapshot
14. warm-derivs-cache
15. polygon-news-unified
16. massive-forex-sync
17. sync-polygon-crypto-technicals
18. sync-token-cards-lunarcrush-tier1
19. sync-token-cards-lunarcrush-tier2
20. sync-token-cards-lunarcrush-tier3
21. sync-token-cards-lunarcrush
22. sync-token-cards-polygon
23. sync-forex-cards-polygon
24. sync-forex-cards-technicals
25. sync-token-cards-lunarcrush-enhanced
26. sync-token-cards-coingecko
27. sync-token-cards-metadata
28. sync-top500-technicals
29. sync-token-cards-coingecko-technicals
30. sync-token-cards-coingecko-prices
31. sync-token-cards-coingecko-contracts
32. sync-stock-cards
33. sync-stock-cards-52week
34. sync-stock-cards-technicals
35. sync-token-cards-websocket
36. mark-polygon-tokens
37. sync-token-cards-lunarcrush-ai
38. sync-lunarcrush-topics
39. sync-lunarcrush-ai-top25
40. sync-cot-reports

**Functions that might need cron but don't have it:**
- `massive-crypto-snapshot` - Mentioned in docs but NOT in config.toml (might be deprecated)
- All other functions are either frontend-called, manual-only, or test functions

### 5. Schedule Corrections Applied

| Function | Original (config.toml) | Fixed (pg_cron) | Reason |
|----------|------------------------|-----------------|--------|
| `sync-top500-technicals` | `*/30 * * * *` | `15,45 * * * *` | Avoid minute-0 |
| `mark-polygon-tokens` | `0 4 * * *` | `10 4 * * *` | Avoid collision with sync-cot-reports |
| `sync-token-cards-lunarcrush` | `59 1,3,5,7,9,11,13,15,17,19,21,23 * * *` | `59 */2 * * *` | Avoid minute-0, simplify schedule |

## Action Items

1. ✅ **Fixed:** Documentation count (48 → 42)
2. ⏳ **Pending:** Run `fix_lunarcrush_minute0_collision.sql` to fix sync-token-cards-lunarcrush
3. ⏳ **Pending:** Run `verify_cron_audit.sql` to confirm all findings
4. ⏳ **Pending:** Identify the 2 extra jobs in pg_cron (if they exist)

## Verification Queries

Run `verify_cron_audit.sql` to:
- Count total jobs (should be 42)
- Verify sync-token-cards-lunarcrush schedule
- Find any remaining minute-0 collisions
- Compare config.toml vs pg_cron
