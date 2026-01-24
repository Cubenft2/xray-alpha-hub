# Cron Schedule Comparison - 9 Functions
**Date:** 2025-01-15

## Side-by-Side Comparison

| Function | config.toml Schedule | pg_cron Schedule (Lovable) | docs Schedule | Status |
|----------|---------------------|---------------------------|---------------|--------|
| **generate-brief-morning** | `0 11 * * *` | `0 11 * * *` | `0 11 * * *` | ✅ **MATCH** |
| **generate-brief-evening** | `0 23 * * *` | `0 23 * * *` | `0 23 * * *` | ✅ **MATCH** |
| **generate-sunday-special** | `0 1 * * 1` | `0 1 * * 1` | `0 1 * * 1` | ✅ **MATCH** |
| **polygon-stock-poller** | `1-56/5 * * * *` | `1-56/5 * * * *` | `1-56/5 * * * *` | ✅ **MATCH** |
| **polygon-stock-snapshot** | `3-58/5 * * * *` | `3-58/5 * * * *` | `3-58/5 * * * *` | ✅ **MATCH** |
| **sync-token-cards-lunarcrush-tier2** | `4,34 * * * *` | `4,34 * * * *` | `4,34 * * * *` | ✅ **MATCH** |
| **sync-token-cards-lunarcrush** | `59 1,3,5,7,9,11,13,15,17,19,21,23 * * *` | `0 */2 * * *` ❌ | `59 */2 * * *` | ⚠️ **DISCREPANCY** |
| **sync-top500-technicals** | `*/30 * * * *` | `*/30 * * * *` | `15,45 * * * *` | ⚠️ **DISCREPANCY** |
| **mark-polygon-tokens** | `0 4 * * *` | `0 4 * * *` | `10 4 * * *` | ⚠️ **DISCREPANCY** |

---

## Analysis

### ✅ Functions That Match (6/9)

All three sources agree on these schedules:
1. **generate-brief-morning** - `0 11 * * *`
2. **generate-brief-evening** - `0 23 * * *`
3. **generate-sunday-special** - `0 1 * * 1`
4. **polygon-stock-poller** - `1-56/5 * * * *`
5. **polygon-stock-snapshot** - `3-58/5 * * * *`
6. **sync-token-cards-lunarcrush-tier2** - `4,34 * * * *`

### ⚠️ Functions With Discrepancies (3/9)

#### 1. **sync-token-cards-lunarcrush**

| Source | Schedule | Notes |
|--------|----------|-------|
| **config.toml** | `59 1,3,5,7,9,11,13,15,17,19,21,23 * * *` | Odd hours at :59 (12 runs/day) |
| **pg_cron (Lovable)** | `0 */2 * * *` | ❌ **MINUTE-0 COLLISION** - Even hours at :00 |
| **docs** | `59 */2 * * *` | Even hours at :59 (12 runs/day) - Recommended fix |

**Issue:** pg_cron has a minute-0 collision. According to CRON_AUDIT_SUMMARY.md, there's a script `fix_lunarcrush_minute0_collision.sql` that was created to fix this.

**Action Required:** Verify if the fix script was executed in Supabase.

---

#### 2. **sync-top500-technicals**

| Source | Schedule | Notes |
|--------|----------|-------|
| **config.toml** | `*/30 * * * *` | Runs at :00 and :30 (minute-0 collision risk) |
| **pg_cron (Lovable)** | `*/30 * * * *` | Same as config.toml |
| **docs** | `15,45 * * * *` | Runs at :15 and :45 (avoids minute-0) |

**Issue:** config.toml and pg_cron both have minute-0 collision risk. Docs recommend `15,45 * * * *` to avoid collisions.

**Action Required:** Update config.toml and pg_cron to match docs (`15,45 * * * *`).

---

#### 3. **mark-polygon-tokens**

| Source | Schedule | Notes |
|--------|----------|-------|
| **config.toml** | `0 4 * * *` | 4:00 AM |
| **pg_cron (Lovable)** | `0 4 * * *` | Same as config.toml |
| **docs** | `10 4 * * *` | 4:10 AM (staggered to avoid collision with sync-cot-reports at 4:00) |

**Issue:** config.toml and pg_cron both run at 4:00, but docs recommend 4:10 to avoid collision with `sync-cot-reports` which runs at `0 4 * * 6` (Saturday 4:00 AM).

**Action Required:** Update config.toml and pg_cron to match docs (`10 4 * * *`).

---

## SQL Fix Scripts - Did They Run?

### Script: `fix_lunarcrush_minute0_collision.sql`

**Location:** `scripts/fix_lunarcrush_minute0_collision.sql`

**Status According to docs/CRON_AUDIT_CLEANUP_SUMMARY.md:**
- Line 13: "`fix_lunarcrush_minute0_collision.sql` - Fix for minute-0 collision **(already executed)**"

**However:**
- The script is in the `scripts/` directory (not in `supabase/migrations/`)
- There's **NO migration file** for this fix
- If it was executed, it would have been run manually via SQL editor, not via migration

**Conclusion:** ✅ **Script exists and was marked as executed**, but verification needed to confirm if it actually fixed the pg_cron schedule.

---

### Other Fixes

**According to docs/CRON_AUDIT_SUMMARY.md (lines 99-103):**

| Function | Original (config.toml) | Fixed (pg_cron) | Status |
|----------|------------------------|-----------------|--------|
| `sync-top500-technicals` | `*/30 * * * *` | `15,45 * * * *` | ⏳ **PENDING** |
| `mark-polygon-tokens` | `0 4 * * *` | `10 4 * * *` | ⏳ **PENDING** |
| `sync-token-cards-lunarcrush` | `59 1,3,5,7,9,11,13,15,17,19,21,23 * * *` | `59 */2 * * *` | ⏳ **PENDING** (but script exists) |

**Note:** The CRON_AUDIT_SUMMARY.md shows these as "Fixed (pg_cron)" but the action items (line 108) say "Pending: Run `fix_lunarcrush_minute0_collision.sql`".

---

## Final Answer: Did SQL Fix Scripts Run?

### Answer: **MIXED - Only PARTIALLY**

1. **`fix_lunarcrush_minute0_collision.sql`:**
   - ✅ Script exists in `scripts/` directory
   - ✅ Marked as "already executed" in CRON_AUDIT_CLEANUP_SUMMARY.md
   - ❓ **BUT:** pg_cron schedule in Lovable's report still shows `0 */2 * * *` (the OLD schedule)
   - ❓ **VERIFICATION NEEDED:** Run `verify_cron_audit.sql` or check pg_cron directly to confirm

2. **`sync-top500-technicals` and `mark-polygon-tokens`:**
   - ❌ **NO SQL scripts exist** to fix these
   - ❌ **NOT executed** - Both config.toml and pg_cron still have the old schedules
   - ⚠️ **ONLY docs were updated** to show the "correct" schedules

3. **config.toml Updates:**
   - ❌ **NOT updated** - All three functions still have old schedules in config.toml
   - ✅ **Only docs/SYSTEM_ARCHITECTURE.md was updated** to reflect the "correct" schedules

---

## Summary

**Did the SQL fix script run?** 

**Answer:** According to documentation, `fix_lunarcrush_minute0_collision.sql` was marked as "already executed", BUT:
- There's no migration file for it (it's only in `scripts/`)
- Lovable's report still shows the old schedule (`0 */2 * * *`)
- Verification is needed to confirm if it actually ran in Supabase

**Did we only update config.toml?**

**Answer:** **NO** - We actually:
1. ✅ **Updated docs/SYSTEM_ARCHITECTURE.md** with the "correct" schedules
2. ❌ **Did NOT update config.toml** (still has old schedules)
3. ❌ **Did NOT create migration files** for sync-top500-technicals and mark-polygon-tokens
4. ❓ **Possibly executed** fix_lunarcrush_minute0_collision.sql manually (but needs verification)

**Current State:**
- **config.toml** = Still has OLD schedules (source of truth for Supabase cron)
- **pg_cron** = Likely still has OLD schedules (needs verification)
- **docs** = Has NEW "correct" schedules (but doesn't match reality)

**Recommendation:**
1. Verify actual pg_cron schedules in Supabase
2. Create migration files to fix the discrepancies
3. Update config.toml to match docs
4. Run migrations in Supabase
