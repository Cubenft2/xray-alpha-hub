-- ============================================
-- Fix Minute-0 Collision: sync-token-cards-lunarcrush
-- ============================================
-- Current: 0 */2 * * * (runs at :00 of every even hour - COLLISION RISK)
-- Fixed: 59 */2 * * * (runs at :59 of every even hour - SAFE)
--
-- This matches the pattern in config.toml which uses minute 59
-- ============================================

-- First, unschedule the old job
SELECT cron.unschedule('sync-token-cards-lunarcrush');

-- Then, schedule it with the corrected time (minute 59)
SELECT cron.schedule(
  'sync-token-cards-lunarcrush',
  '59 */2 * * *',
  $$
  SELECT net.http_post(
    url := 'https://odncvfiuzliyohxrsigc.supabase.co/functions/v1/sync-token-cards-lunarcrush',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9kbmN2Zml1emxpeW9oeHJzaWdjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg3Mzk4MjEsImV4cCI6MjA3NDMxNTgyMX0.7cnRatKpHqsylletKVel7WAprIYdpP85AXtXLswMYXQ'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- ============================================
-- VERIFICATION
-- ============================================
-- Verify the schedule was updated:
SELECT jobid, jobname, schedule, active 
FROM cron.job 
WHERE jobname = 'sync-token-cards-lunarcrush';

-- Check for any remaining minute-0 collisions:
SELECT jobname, schedule 
FROM cron.job 
WHERE (schedule LIKE '% 0 %' OR schedule LIKE '0 %' OR schedule LIKE '%*/%0%')
  AND active = true
ORDER BY jobname;
