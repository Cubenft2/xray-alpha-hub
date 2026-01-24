-- ============================================
-- Verification Queries - Run After 15 Minutes
-- ============================================
-- Use these queries to verify the new cron jobs are executing properly
-- Run this script 15+ minutes after adding the cron jobs
-- ============================================

-- ============================================
-- 1. Check All Cron Jobs Status
-- ============================================
SELECT 
  jobid,
  jobname,
  schedule,
  active,
  nodename,
  nodeport
FROM cron.job
WHERE active = true
ORDER BY jobname;

-- ============================================
-- 2. Check Job Execution History (Last 30 Minutes)
-- ============================================
-- Note: This requires the pg_cron extension's job_run_details view
-- If it doesn't exist, check cron.job_run_details or your monitoring setup
SELECT 
  jobid,
  jobname,
  runid,
  job_pid,
  database,
  username,
  command,
  status,
  return_message,
  start_time,
  end_time
FROM cron.job_run_details
WHERE start_time > NOW() - INTERVAL '30 minutes'
ORDER BY start_time DESC
LIMIT 50;

-- ============================================
-- 3. Verify Frequent Jobs Are Running
-- ============================================
-- These should have run multiple times in the last 15 minutes:
-- - sync-polygon-crypto-technicals (every 3 min = ~5 runs)
-- - warm-derivs-cache (every 5 min = ~3 runs)
-- - exchange-data-aggregator (every 15 min = 1 run)
-- - price-poller (every 5 min = ~3 runs)

SELECT 
  jobname,
  COUNT(*) as run_count,
  MAX(start_time) as last_run,
  MIN(start_time) as first_run,
  COUNT(*) FILTER (WHERE status = 'succeeded') as succeeded,
  COUNT(*) FILTER (WHERE status = 'failed') as failed
FROM cron.job_run_details
WHERE start_time > NOW() - INTERVAL '15 minutes'
  AND jobname IN (
    'sync-polygon-crypto-technicals',
    'warm-derivs-cache',
    'exchange-data-aggregator',
    'price-poller'
  )
GROUP BY jobname
ORDER BY run_count DESC;

-- ============================================
-- 4. Check for Failed Jobs
-- ============================================
SELECT 
  jobname,
  status,
  return_message,
  start_time,
  end_time
FROM cron.job_run_details
WHERE start_time > NOW() - INTERVAL '30 minutes'
  AND status != 'succeeded'
ORDER BY start_time DESC;

-- ============================================
-- 5. Verify Data Updates (Technical Indicators)
-- ============================================
-- Check if sync-polygon-crypto-technicals is updating token_cards
SELECT 
  COUNT(*) as total_tokens,
  COUNT(*) FILTER (WHERE polygon_technicals_updated_at > NOW() - INTERVAL '15 minutes') as updated_last_15min,
  MAX(polygon_technicals_updated_at) as last_update,
  MIN(polygon_technicals_updated_at) as oldest_update
FROM token_cards
WHERE in_polygon = true OR polygon_supported = true;

-- ============================================
-- 6. Verify Data Updates (Top 500 Technicals)
-- ============================================
-- Check if sync-top500-technicals is updating token_cards
SELECT 
  COUNT(*) as total_top500,
  COUNT(*) FILTER (WHERE polygon_technicals_updated_at > NOW() - INTERVAL '30 minutes') as updated_last_30min,
  MAX(polygon_technicals_updated_at) as last_update
FROM token_cards
WHERE market_cap_rank <= 500
  AND (in_polygon = false OR in_polygon IS NULL);

-- ============================================
-- 7. Verify Data Updates (Derivatives Cache)
-- ============================================
-- Check if warm-derivs-cache is updating derivatives_cache
SELECT 
  COUNT(*) as total_entries,
  COUNT(*) FILTER (WHERE updated_at > NOW() - INTERVAL '15 minutes') as updated_last_15min,
  MAX(updated_at) as last_update
FROM derivatives_cache;

-- ============================================
-- 8. Verify Data Updates (Exchange Data)
-- ============================================
-- Check if exchange-data-aggregator is updating exchange_ticker_data
SELECT 
  COUNT(*) as total_tickers,
  COUNT(*) FILTER (WHERE updated_at > NOW() - INTERVAL '15 minutes') as updated_last_15min,
  MAX(updated_at) as last_update
FROM exchange_ticker_data;

-- ============================================
-- 9. Verify Data Updates (Live Prices)
-- ============================================
-- Check if price-poller is updating live_prices
SELECT 
  COUNT(*) as total_prices,
  COUNT(*) FILTER (WHERE updated_at > NOW() - INTERVAL '15 minutes') as updated_last_15min,
  MAX(updated_at) as last_update
FROM live_prices;

-- ============================================
-- 10. Check for Minute-0 Collisions (Should Be Empty)
-- ============================================
SELECT 
  jobname,
  schedule,
  'COLLISION RISK' as warning
FROM cron.job
WHERE active = true
  AND (
    schedule LIKE '% 0 %' 
    OR schedule LIKE '0 %' 
    OR schedule LIKE '%*/%0%'
  )
ORDER BY jobname;

-- ============================================
-- SUMMARY
-- ============================================
-- Expected Results After 15 Minutes:
-- ✅ sync-polygon-crypto-technicals: ~5 runs
-- ✅ warm-derivs-cache: ~3 runs
-- ✅ exchange-data-aggregator: 1 run
-- ✅ price-poller: ~3 runs
-- ✅ No minute-0 collisions
-- ✅ Data tables showing recent updates
