-- ============================================================
-- CRON JOBS RECREATION SCRIPT - 18 Essential Jobs with Proper Staggering
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/odncvfiuzliyohxrsigc/sql/new
-- ============================================================

-- Variables
-- Project URL: https://odncvfiuzliyohxrsigc.supabase.co
-- Anon Key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9kbmN2Zml1emxpeW9oeHJzaWdjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg3Mzk4MjEsImV4cCI6MjA3NDMxNTgyMX0.7cnRatKpHqsylletKVel7WAprIYdpP85AXtXLswMYXQ

-- ============================================================
-- HIGH FREQUENCY JOBS (Every 1-3 minutes)
-- ============================================================

-- 1. sync-token-cards-polygon - Every minute (crypto prices)
SELECT cron.schedule(
  'sync-token-cards-polygon-1min',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://odncvfiuzliyohxrsigc.supabase.co/functions/v1/sync-token-cards-polygon',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9kbmN2Zml1emxpeW9oeHJzaWdjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg3Mzk4MjEsImV4cCI6MjA3NDMxNTgyMX0.7cnRatKpHqsylletKVel7WAprIYdpP85AXtXLswMYXQ"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

-- 2. sync-forex-cards-polygon - Every minute (forex prices)
SELECT cron.schedule(
  'sync-forex-cards-polygon-1min',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://odncvfiuzliyohxrsigc.supabase.co/functions/v1/sync-forex-cards-polygon',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9kbmN2Zml1emxpeW9oeHJzaWdjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg3Mzk4MjEsImV4cCI6MjA3NDMxNTgyMX0.7cnRatKpHqsylletKVel7WAprIYdpP85AXtXLswMYXQ"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

-- 3. sync-token-cards-lunarcrush - Every 2 minutes on ODD minutes (1,3,5,7...)
SELECT cron.schedule(
  'sync-token-cards-lunarcrush-2min',
  '1-59/2 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://odncvfiuzliyohxrsigc.supabase.co/functions/v1/sync-token-cards-lunarcrush',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9kbmN2Zml1emxpeW9oeHJzaWdjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg3Mzk4MjEsImV4cCI6MjA3NDMxNTgyMX0.7cnRatKpHqsylletKVel7WAprIYdpP85AXtXLswMYXQ"}'::jsonb,
    body := '{"limit": 3000}'::jsonb
  ) AS request_id;
  $$
);

-- 4. sync-stock-cards - Every 2 minutes on ODD minutes (1,3,5,7...)
SELECT cron.schedule(
  'sync-stock-cards-2min',
  '1-59/2 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://odncvfiuzliyohxrsigc.supabase.co/functions/v1/sync-stock-cards',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9kbmN2Zml1emxpeW9oeHJzaWdjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg3Mzk4MjEsImV4cCI6MjA3NDMxNTgyMX0.7cnRatKpHqsylletKVel7WAprIYdpP85AXtXLswMYXQ"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

-- 5. sync-polygon-crypto-technicals - Every 3 minutes offset +2 (2,5,8,11...)
SELECT cron.schedule(
  'sync-polygon-crypto-technicals-3min',
  '2-59/3 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://odncvfiuzliyohxrsigc.supabase.co/functions/v1/sync-polygon-crypto-technicals',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9kbmN2Zml1emxpeW9oeHJzaWdjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg3Mzk4MjEsImV4cCI6MjA3NDMxNTgyMX0.7cnRatKpHqsylletKVel7WAprIYdpP85AXtXLswMYXQ"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

-- ============================================================
-- MEDIUM FREQUENCY JOBS (Every 5 minutes, staggered)
-- ============================================================

-- 6. polygon-stock-snapshot - Every 5 minutes offset +1 (1,6,11,16...)
SELECT cron.schedule(
  'polygon-stock-snapshot-5min',
  '1,6,11,16,21,26,31,36,41,46,51,56 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://odncvfiuzliyohxrsigc.supabase.co/functions/v1/polygon-stock-snapshot',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9kbmN2Zml1emxpeW9oeHJzaWdjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg3Mzk4MjEsImV4cCI6MjA3NDMxNTgyMX0.7cnRatKpHqsylletKVel7WAprIYdpP85AXtXLswMYXQ"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

-- 7. sync-stock-cards-technicals - Every 5 minutes offset +3 (3,8,13,18...)
SELECT cron.schedule(
  'sync-stock-cards-technicals-5min',
  '3,8,13,18,23,28,33,38,43,48,53,58 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://odncvfiuzliyohxrsigc.supabase.co/functions/v1/sync-stock-cards-technicals',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9kbmN2Zml1emxpeW9oeHJzaWdjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg3Mzk4MjEsImV4cCI6MjA3NDMxNTgyMX0.7cnRatKpHqsylletKVel7WAprIYdpP85AXtXLswMYXQ"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

-- 8. sync-token-cards-coingecko-prices - Every 5 minutes offset +4 (4,9,14,19...)
SELECT cron.schedule(
  'sync-token-cards-coingecko-prices-5min',
  '4,9,14,19,24,29,34,39,44,49,54,59 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://odncvfiuzliyohxrsigc.supabase.co/functions/v1/sync-token-cards-coingecko-prices',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9kbmN2Zml1emxpeW9oeHJzaWdjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg3Mzk4MjEsImV4cCI6MjA3NDMxNTgyMX0.7cnRatKpHqsylletKVel7WAprIYdpP85AXtXLswMYXQ"}'::jsonb,
    body := '{"limit": 2000}'::jsonb
  ) AS request_id;
  $$
);

-- ============================================================
-- LOWER FREQUENCY JOBS (Every 15 minutes, staggered)
-- ============================================================

-- 9. sync-forex-cards-technicals - Every 15 minutes offset +3 (3,18,33,48)
SELECT cron.schedule(
  'sync-forex-cards-technicals-15min',
  '3,18,33,48 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://odncvfiuzliyohxrsigc.supabase.co/functions/v1/sync-forex-cards-technicals',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9kbmN2Zml1emxpeW9oeHJzaWdjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg3Mzk4MjEsImV4cCI6MjA3NDMxNTgyMX0.7cnRatKpHqsylletKVel7WAprIYdpP85AXtXLswMYXQ"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

-- 10. sync-stock-news-polygon - Every 15 minutes offset +5 (5,20,35,50)
SELECT cron.schedule(
  'sync-stock-news-polygon-15min',
  '5,20,35,50 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://odncvfiuzliyohxrsigc.supabase.co/functions/v1/sync-stock-news-polygon',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9kbmN2Zml1emxpeW9oeHJzaWdjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg3Mzk4MjEsImV4cCI6MjA3NDMxNTgyMX0.7cnRatKpHqsylletKVel7WAprIYdpP85AXtXLswMYXQ"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

-- 11. sync-token-news-polygon - Every 15 minutes offset +10 (10,25,40,55)
SELECT cron.schedule(
  'sync-token-news-polygon-15min',
  '10,25,40,55 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://odncvfiuzliyohxrsigc.supabase.co/functions/v1/sync-token-news-polygon',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9kbmN2Zml1emxpeW9oeHJzaWdjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg3Mzk4MjEsImV4cCI6MjA3NDMxNTgyMX0.7cnRatKpHqsylletKVel7WAprIYdpP85AXtXLswMYXQ"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

-- ============================================================
-- HOURLY JOBS
-- ============================================================

-- 12. polygon-company-prefetch - Hourly at minute 7 (NOT minute 0!)
SELECT cron.schedule(
  'polygon-company-prefetch-hourly',
  '7 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://odncvfiuzliyohxrsigc.supabase.co/functions/v1/polygon-company-prefetch',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9kbmN2Zml1emxpeW9oeHJzaWdjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg3Mzk4MjEsImV4cCI6MjA3NDMxNTgyMX0.7cnRatKpHqsylletKVel7WAprIYdpP85AXtXLswMYXQ"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

-- ============================================================
-- DAILY JOBS
-- ============================================================

-- 13. sync-token-cards-coingecko - Daily at 5 AM UTC (metadata/logos)
SELECT cron.schedule(
  'sync-token-cards-coingecko-daily',
  '0 5 * * *',
  $$
  SELECT net.http_post(
    url := 'https://odncvfiuzliyohxrsigc.supabase.co/functions/v1/sync-token-cards-coingecko',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9kbmN2Zml1emxpeW9oeHJzaWdjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg3Mzk4MjEsImV4cCI6MjA3NDMxNTgyMX0.7cnRatKpHqsylletKVel7WAprIYdpP85AXtXLswMYXQ"}'::jsonb,
    body := '{"limit": 5000}'::jsonb
  ) AS request_id;
  $$
);

-- 14. sync-token-cards-coingecko-technicals - 4x daily (5 AM, 11 AM, 5 PM, 11 PM UTC)
SELECT cron.schedule(
  'sync-token-cards-coingecko-technicals-4x',
  '0 5,11,17,23 * * *',
  $$
  SELECT net.http_post(
    url := 'https://odncvfiuzliyohxrsigc.supabase.co/functions/v1/sync-token-cards-coingecko-technicals',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9kbmN2Zml1emxpeW9oeHJzaWdjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg3Mzk4MjEsImV4cCI6MjA3NDMxNTgyMX0.7cnRatKpHqsylletKVel7WAprIYdpP85AXtXLswMYXQ"}'::jsonb,
    body := '{"limit": 2000}'::jsonb
  ) AS request_id;
  $$
);

-- 15. sync-stock-cards-52week - Daily at 7 AM UTC
SELECT cron.schedule(
  'sync-stock-cards-52week-daily',
  '0 7 * * *',
  $$
  SELECT net.http_post(
    url := 'https://odncvfiuzliyohxrsigc.supabase.co/functions/v1/sync-stock-cards-52week',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9kbmN2Zml1emxpeW9oeHJzaWdjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg3Mzk4MjEsImV4cCI6MjA3NDMxNTgyMX0.7cnRatKpHqsylletKVel7WAprIYdpP85AXtXLswMYXQ"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

-- 16. generate-brief-morning - Daily at 12 PM UTC (8 AM ET)
SELECT cron.schedule(
  'generate-brief-morning',
  '0 12 * * *',
  $$
  SELECT net.http_post(
    url := 'https://odncvfiuzliyohxrsigc.supabase.co/functions/v1/generate-brief-morning',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9kbmN2Zml1emxpeW9oeHJzaWdjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg3Mzk4MjEsImV4cCI6MjA3NDMxNTgyMX0.7cnRatKpHqsylletKVel7WAprIYdpP85AXtXLswMYXQ"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

-- 17. generate-brief-evening - Daily at 10 PM UTC (6 PM ET)
SELECT cron.schedule(
  'generate-brief-evening',
  '0 22 * * *',
  $$
  SELECT net.http_post(
    url := 'https://odncvfiuzliyohxrsigc.supabase.co/functions/v1/generate-brief-evening',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9kbmN2Zml1emxpeW9oeHJzaWdjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg3Mzk4MjEsImV4cCI6MjA3NDMxNTgyMX0.7cnRatKpHqsylletKVel7WAprIYdpP85AXtXLswMYXQ"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

-- 18. generate-sunday-special - Weekly on Monday at 1 AM UTC (Sunday 9 PM ET)
SELECT cron.schedule(
  'generate-sunday-special',
  '0 1 * * 1',
  $$
  SELECT net.http_post(
    url := 'https://odncvfiuzliyohxrsigc.supabase.co/functions/v1/generate-sunday-special',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9kbmN2Zml1emxpeW9oeHJzaWdjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg3Mzk4MjEsImV4cCI6MjA3NDMxNTgyMX0.7cnRatKpHqsylletKVel7WAprIYdpP85AXtXLswMYXQ"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

-- ============================================================
-- VERIFICATION: Check all 18 jobs were created
-- ============================================================
SELECT 
  jobname,
  schedule,
  active,
  CASE 
    WHEN schedule = '* * * * *' THEN 'Every minute'
    WHEN schedule = '1-59/2 * * * *' THEN 'Every 2min (odd: 1,3,5...)'
    WHEN schedule = '2-59/3 * * * *' THEN 'Every 3min (2,5,8...)'
    WHEN schedule LIKE '%,6,%' THEN 'Every 5min (+1 offset)'
    WHEN schedule LIKE '%,8,%' THEN 'Every 5min (+3 offset)'
    WHEN schedule LIKE '%,9,%' THEN 'Every 5min (+4 offset)'
    WHEN schedule LIKE '3,18%' THEN 'Every 15min (+3)'
    WHEN schedule LIKE '5,20%' THEN 'Every 15min (+5)'
    WHEN schedule LIKE '10,25%' THEN 'Every 15min (+10)'
    WHEN schedule = '7 * * * *' THEN 'Hourly at :07'
    WHEN schedule LIKE '0 5 * * *' THEN 'Daily 5AM UTC'
    WHEN schedule LIKE '0 5,11%' THEN '4x daily'
    WHEN schedule LIKE '0 7 * * *' THEN 'Daily 7AM UTC'
    WHEN schedule LIKE '0 12 * * *' THEN 'Daily 12PM UTC (8AM ET)'
    WHEN schedule LIKE '0 22 * * *' THEN 'Daily 10PM UTC (6PM ET)'
    WHEN schedule LIKE '0 1 * * 1' THEN 'Weekly Monday 1AM UTC'
    ELSE schedule
  END as schedule_description
FROM cron.job 
WHERE active = true
ORDER BY jobname;
