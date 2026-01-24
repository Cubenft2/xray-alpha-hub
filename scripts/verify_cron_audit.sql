-- ============================================
-- Comprehensive Cron Audit - Verify Lovable's Findings
-- ============================================
-- Run this to verify the current state of pg_cron
-- ============================================

-- ============================================
-- 1. Count Total Active Jobs in pg_cron
-- ============================================
SELECT 
  COUNT(*) as total_active_jobs,
  COUNT(*) FILTER (WHERE active = true) as active_count,
  COUNT(*) FILTER (WHERE active = false) as inactive_count
FROM cron.job;

-- ============================================
-- 2. Verify sync-token-cards-lunarcrush Schedule
-- ============================================
-- Should be: 59 */2 * * * (not 0 */2 * * *)
SELECT 
  jobid,
  jobname,
  schedule,
  active,
  CASE 
    WHEN schedule = '59 */2 * * *' THEN '✅ CORRECT'
    WHEN schedule = '0 */2 * * *' THEN '❌ WRONG - Minute-0 collision!'
    ELSE '⚠️ UNEXPECTED SCHEDULE'
  END as status
FROM cron.job
WHERE jobname = 'sync-token-cards-lunarcrush';

-- ============================================
-- 3. Check for Minute-0 Collisions
-- ============================================
-- This query finds schedules that run at minute 0
-- Note: Some minute-0 jobs are intentional (daily/weekly briefs)
SELECT 
  jobid,
  jobname,
  schedule,
  CASE 
    WHEN jobname IN ('generate-brief-morning', 'generate-brief-evening', 'generate-sunday-special', 'sync-cot-reports') 
    THEN '⚠️ INTENTIONAL (daily/weekly)'
    ELSE '❌ MINUTE-0 COLLISION RISK'
  END as warning
FROM cron.job
WHERE active = true
  AND (
    -- Matches "0 *" (minute 0 of every hour)
    schedule LIKE '0 %'
    -- Matches "*/X *" patterns that include minute 0 (like */30, */15, */10, */5, */2, */1)
    OR schedule LIKE '*/% * * * *'
    -- Matches "0,30 *" or similar patterns with 0
    OR schedule LIKE '0,%'
    OR schedule LIKE '%,0 %'
    OR schedule LIKE '%,0,%'
  )
ORDER BY 
  CASE WHEN jobname IN ('generate-brief-morning', 'generate-brief-evening', 'generate-sunday-special', 'sync-cot-reports') THEN 1 ELSE 0 END,
  jobname;

-- ============================================
-- 4. List All Active Cron Jobs (Sorted)
-- ============================================
SELECT 
  jobid,
  jobname,
  schedule,
  active
FROM cron.job
WHERE active = true
ORDER BY jobname;

-- ============================================
-- 5. Compare config.toml vs pg_cron
-- ============================================
-- Functions in config.toml with cron schedules (40 total):
-- This query helps identify which ones are missing from pg_cron
-- Expected jobs from config.toml:
WITH expected_jobs AS (
  SELECT unnest(ARRAY[
    'manual-price-sync',
    'generate-brief-morning',
    'generate-brief-evening',
    'generate-sunday-special',
    'exchange-data-aggregator',
    'exchange-sync',
    'polygon-stock-poller',
    'polygon-company-prefetch',
    'auto-map-polygon-tickers',
    'auto-map-exchange-tickers',
    'price-poller',
    'lunarcrush-news',
    'polygon-stock-snapshot',
    'warm-derivs-cache',
    'polygon-news-unified',
    'massive-forex-sync',
    'sync-polygon-crypto-technicals',
    'sync-token-cards-lunarcrush-tier1',
    'sync-token-cards-lunarcrush-tier2',
    'sync-token-cards-lunarcrush-tier3',
    'sync-token-cards-lunarcrush',
    'sync-token-cards-polygon',
    'sync-forex-cards-polygon',
    'sync-forex-cards-technicals',
    'sync-token-cards-lunarcrush-enhanced',
    'sync-token-cards-coingecko',
    'sync-token-cards-metadata',
    'sync-top500-technicals',
    'sync-token-cards-coingecko-technicals',
    'sync-token-cards-coingecko-prices',
    'sync-token-cards-coingecko-contracts',
    'sync-stock-cards',
    'sync-stock-cards-52week',
    'sync-stock-cards-technicals',
    'sync-token-cards-websocket',
    'mark-polygon-tokens',
    'sync-token-cards-lunarcrush-ai',
    'sync-lunarcrush-topics',
    'sync-lunarcrush-ai-top25',
    'sync-cot-reports'
  ]) as jobname
)
SELECT 
  e.jobname,
  CASE 
    WHEN j.jobid IS NULL THEN '❌ MISSING FROM pg_cron'
    WHEN j.active = false THEN '⚠️ INACTIVE'
    ELSE '✅ PRESENT'
  END as status,
  j.schedule as current_schedule
FROM expected_jobs e
LEFT JOIN cron.job j ON e.jobname = j.jobname
ORDER BY e.jobname;

-- ============================================
-- 6. Find Functions That Should Have Cron But Don't
-- ============================================
-- This is a manual check - compare the list above with supabase/functions/ directory
-- Functions that exist but might need cron:
-- - massive-crypto-snapshot (has cron in config.toml? Let me check...)
-- - Any other functions that should run on schedule

-- ============================================
-- SUMMARY EXPECTATIONS
-- ============================================
-- Expected: 42 active jobs in pg_cron
-- Expected: sync-token-cards-lunarcrush at 59 */2 * * *
-- Expected: No minute-0 collisions (except intentional ones like generate-brief-morning at 0 11)
-- Expected: All 40 config.toml cron jobs present in pg_cron
