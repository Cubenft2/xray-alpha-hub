-- ============================================================
-- CRON JOB STAGGER FIX - Prevent minute-0 collisions
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/odncvfiuzliyohxrsigc/sql/new
-- ============================================================

-- PHASE 1: Stagger high-frequency jobs to prevent collision at minute 0
-- ============================================================

-- 2-MINUTE JOBS: Offset sync-stock-cards to odd minutes
SELECT cron.alter_job(
  job_id := (SELECT jobid FROM cron.job WHERE jobname = 'sync-stock-cards-2min'),
  schedule := '1-59/2 * * * *'  -- Runs at minute 1, 3, 5, 7... (offset from polygon-rest-poller)
);

-- 3-MINUTE JOBS: Offset to avoid minute 0
SELECT cron.alter_job(
  job_id := (SELECT jobid FROM cron.job WHERE jobname = 'sync-polygon-crypto-technicals-3min'),
  schedule := '2-59/3 * * * *'  -- Runs at minute 2, 5, 8, 11... (offset by 2)
);

-- 5-MINUTE JOBS: Spread across 5-minute window
SELECT cron.alter_job(
  job_id := (SELECT jobid FROM cron.job WHERE jobname = 'polygon-stock-snapshot-5min'),
  schedule := '1,6,11,16,21,26,31,36,41,46,51,56 * * * *'  -- Offset +1 minute
);

SELECT cron.alter_job(
  job_id := (SELECT jobid FROM cron.job WHERE jobname = 'sync-stock-cards-technicals-5min'),
  schedule := '3,8,13,18,23,28,33,38,43,48,53,58 * * * *'  -- Offset +3 minutes
);

-- 15-MINUTE JOBS: Spread across 15-minute window
SELECT cron.alter_job(
  job_id := (SELECT jobid FROM cron.job WHERE jobname = 'sync-forex-cards-technicals-15min'),
  schedule := '3,18,33,48 * * * *'  -- Offset +3 minutes
);

SELECT cron.alter_job(
  job_id := (SELECT jobid FROM cron.job WHERE jobname = 'sync-stock-news-polygon-15min'),
  schedule := '5,20,35,50 * * * *'  -- Offset +5 minutes
);

-- Fix price-poller-backup (had 6-field cron - invalid)
SELECT cron.alter_job(
  job_id := (SELECT jobid FROM cron.job WHERE jobname = 'price-poller-backup'),
  schedule := '7,22,37,52 * * * *'  -- Offset +7 minutes, every 15min
);


-- PHASE 2: Fix CoinGecko Jobs
-- ============================================================

-- Update sync-token-cards-coingecko-prices to run every 5 minutes with offset
SELECT cron.alter_job(
  job_id := (SELECT jobid FROM cron.job WHERE jobname LIKE '%coingecko-prices%' LIMIT 1),
  schedule := '4,9,14,19,24,29,34,39,44,49,54,59 * * * *'  -- Every 5min, offset +4
);

-- Check if coingecko-technicals job exists, if not create it
DO $$
DECLARE
  job_exists boolean;
  func_url text := 'https://odncvfiuzliyohxrsigc.supabase.co/functions/v1/sync-token-cards-coingecko-technicals';
  anon_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9kbmN2Zml1emxpeW9oeHJzaWdjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg3Mzk4MjEsImV4cCI6MjA3NDMxNTgyMX0.7cnRatKpHqsylletKVel7WAprIYdpP85AXtXLswMYXQ';
BEGIN
  SELECT EXISTS(SELECT 1 FROM cron.job WHERE jobname LIKE '%coingecko-technicals%') INTO job_exists;
  
  IF NOT job_exists THEN
    PERFORM cron.schedule(
      'sync-token-cards-coingecko-technicals-4x',
      '0 5,11,17,23 * * *',  -- 4x daily at 5 AM, 11 AM, 5 PM, 11 PM UTC
      format(
        $$SELECT net.http_post(
          url := '%s',
          headers := '{"Content-Type": "application/json", "Authorization": "Bearer %s"}'::jsonb,
          body := '{"limit": 2000}'::jsonb
        ) AS request_id$$,
        func_url, anon_key
      )
    );
    RAISE NOTICE 'Created new coingecko-technicals cron job';
  ELSE
    -- Update existing job
    UPDATE cron.job 
    SET schedule = '0 5,11,17,23 * * *'
    WHERE jobname LIKE '%coingecko-technicals%';
    RAISE NOTICE 'Updated existing coingecko-technicals cron job';
  END IF;
END $$;


-- PHASE 3: Disable Redundant Jobs (OPTIONAL - review first)
-- ============================================================
-- These jobs may be duplicates. Review before uncommenting.

-- Option A: If polygon-rest-poller duplicates sync-token-cards-polygon-1min
-- SELECT cron.alter_job(
--   job_id := (SELECT jobid FROM cron.job WHERE jobname = 'polygon-rest-poller'),
--   active := false
-- );

-- Option B: If price-poller-backup is no longer needed
-- SELECT cron.alter_job(
--   job_id := (SELECT jobid FROM cron.job WHERE jobname = 'price-poller-backup'),
--   active := false
-- );


-- ============================================================
-- VERIFICATION: Check the new schedule distribution
-- ============================================================
SELECT 
  jobname,
  schedule,
  active,
  CASE 
    WHEN schedule LIKE '* * * * *' THEN 'Every minute'
    WHEN schedule LIKE '*/2 * * * *' THEN 'Every 2min (0,2,4...)'
    WHEN schedule LIKE '1-59/2 * * * *' THEN 'Every 2min (1,3,5...)'
    WHEN schedule LIKE '*/3 * * * *' THEN 'Every 3min (0,3,6...)'
    WHEN schedule LIKE '2-59/3 * * * *' THEN 'Every 3min (2,5,8...)'
    WHEN schedule LIKE '*/5 * * * *' THEN 'Every 5min (0,5,10...)'
    WHEN schedule LIKE '%,6,%' THEN 'Every 5min (+1 offset)'
    WHEN schedule LIKE '%,8,%' THEN 'Every 5min (+3 offset)'
    WHEN schedule LIKE '%,9,%' THEN 'Every 5min (+4 offset)'
    WHEN schedule LIKE '*/15 * * * *' THEN 'Every 15min (0,15,30,45)'
    WHEN schedule LIKE '3,18%' THEN 'Every 15min (+3 offset)'
    WHEN schedule LIKE '5,20%' THEN 'Every 15min (+5 offset)'
    WHEN schedule LIKE '7,22%' THEN 'Every 15min (+7 offset)'
    ELSE schedule
  END as schedule_description
FROM cron.job 
WHERE active = true
ORDER BY 
  CASE 
    WHEN schedule LIKE '* * * * *' THEN 1
    WHEN schedule LIKE '%/2 %' THEN 2
    WHEN schedule LIKE '%/3 %' THEN 3
    WHEN schedule LIKE '%/5 %' OR schedule LIKE '%,6,%' OR schedule LIKE '%,8,%' OR schedule LIKE '%,9,%' THEN 5
    WHEN schedule LIKE '%/15 %' OR schedule LIKE '3,18%' OR schedule LIKE '5,20%' OR schedule LIKE '7,22%' THEN 15
    ELSE 60
  END,
  jobname;
