-- ============================================================================
-- Fix Cron Schedule Discrepancies
-- ============================================================================
-- This migration fixes 3 cron schedule discrepancies between config.toml/docs
-- and the actual pg_cron schedules to avoid minute-0 collisions and align
-- with documented schedules.
-- ============================================================================
-- Changes:
-- 1. sync-token-cards-lunarcrush: 0 */2 * * * → 59 */2 * * * (avoid minute-0)
-- 2. sync-top500-technicals: */30 * * * * → 15,45 * * * * (avoid minute-0)
-- 3. mark-polygon-tokens: 0 4 * * * → 10 4 * * * (avoid collision with sync-cot-reports)
-- ============================================================================

-- ============================================================================
-- 1. Fix sync-token-cards-lunarcrush: 0 */2 * * * → 59 */2 * * *
-- ============================================================================
DO $$
BEGIN
  -- Check if job exists and unschedule it
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'sync-token-cards-lunarcrush') THEN
    PERFORM cron.unschedule('sync-token-cards-lunarcrush');
    RAISE NOTICE 'Unscheduled sync-token-cards-lunarcrush';
  END IF;
END $$;

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
  ) AS request_id;
  $$
);

-- ============================================================================
-- 2. Fix sync-top500-technicals: */30 * * * * → 15,45 * * * *
-- ============================================================================
DO $$
BEGIN
  -- Check if job exists and unschedule it
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'sync-top500-technicals') THEN
    PERFORM cron.unschedule('sync-top500-technicals');
    RAISE NOTICE 'Unscheduled sync-top500-technicals';
  END IF;
END $$;

SELECT cron.schedule(
  'sync-top500-technicals',
  '15,45 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://odncvfiuzliyohxrsigc.supabase.co/functions/v1/sync-top500-technicals',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9kbmN2Zml1emxpeW9oeHJzaWdjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg3Mzk4MjEsImV4cCI6MjA3NDMxNTgyMX0.7cnRatKpHqsylletKVel7WAprIYdpP85AXtXLswMYXQ'
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

-- ============================================================================
-- 3. Fix mark-polygon-tokens: 0 4 * * * → 10 4 * * *
-- ============================================================================
DO $$
BEGIN
  -- Check if job exists and unschedule it
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'mark-polygon-tokens') THEN
    PERFORM cron.unschedule('mark-polygon-tokens');
    RAISE NOTICE 'Unscheduled mark-polygon-tokens';
  END IF;
END $$;

SELECT cron.schedule(
  'mark-polygon-tokens',
  '10 4 * * *',
  $$
  SELECT net.http_post(
    url := 'https://odncvfiuzliyohxrsigc.supabase.co/functions/v1/mark-polygon-tokens',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9kbmN2Zml1emxpeW9oeHJzaWdjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg3Mzk4MjEsImV4cCI6MjA3NDMxNTgyMX0.7cnRatKpHqsylletKVel7WAprIYdpP85AXtXLswMYXQ'
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

-- ============================================================================
-- VERIFICATION
-- ============================================================================
-- Verify all three jobs were updated correctly
DO $$
DECLARE
  job_record RECORD;
  all_correct BOOLEAN := true;
BEGIN
  RAISE NOTICE '=== Verification of Cron Schedule Fixes ===';
  
  -- Check sync-token-cards-lunarcrush
  SELECT schedule INTO job_record FROM cron.job WHERE jobname = 'sync-token-cards-lunarcrush';
  IF job_record.schedule = '59 */2 * * *' THEN
    RAISE NOTICE '✅ sync-token-cards-lunarcrush: CORRECT (59 */2 * * *)';
  ELSE
    RAISE WARNING '❌ sync-token-cards-lunarcrush: INCORRECT (expected: 59 */2 * * *, got: %)', job_record.schedule;
    all_correct := false;
  END IF;
  
  -- Check sync-top500-technicals
  SELECT schedule INTO job_record FROM cron.job WHERE jobname = 'sync-top500-technicals';
  IF job_record.schedule = '15,45 * * * *' THEN
    RAISE NOTICE '✅ sync-top500-technicals: CORRECT (15,45 * * * *)';
  ELSE
    RAISE WARNING '❌ sync-top500-technicals: INCORRECT (expected: 15,45 * * * *, got: %)', job_record.schedule;
    all_correct := false;
  END IF;
  
  -- Check mark-polygon-tokens
  SELECT schedule INTO job_record FROM cron.job WHERE jobname = 'mark-polygon-tokens';
  IF job_record.schedule = '10 4 * * *' THEN
    RAISE NOTICE '✅ mark-polygon-tokens: CORRECT (10 4 * * *)';
  ELSE
    RAISE WARNING '❌ mark-polygon-tokens: INCORRECT (expected: 10 4 * * *, got: %)', job_record.schedule;
    all_correct := false;
  END IF;
  
  IF all_correct THEN
    RAISE NOTICE '=== All cron schedules fixed successfully! ===';
  ELSE
    RAISE WARNING '=== Some cron schedules need attention ===';
  END IF;
END $$;
