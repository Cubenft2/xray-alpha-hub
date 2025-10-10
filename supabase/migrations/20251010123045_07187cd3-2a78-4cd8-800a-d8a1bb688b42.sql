-- ============================================================================
-- AUTOMATED DAILY BRIEF CRON JOBS - Summer Time Base (EDT)
-- ============================================================================
-- This migration:
-- 1. Deletes ALL existing cron jobs for generate-daily-brief
-- 2. Creates 3 new jobs with correct authentication and schedule:
--    - Morning Brief: Daily (Mon-Sun) at 10:00 UTC (6:00 AM EDT / 5:00 AM EST)
--    - Evening Brief: Mon-Sat at 20:30 UTC (4:30 PM EDT / 3:30 PM EST)
--    - Weekend Brief: Sunday at 22:00 UTC (6:00 PM EDT / 5:00 PM EST)
-- ============================================================================

-- Step 1: Delete ALL existing cron jobs for generate-daily-brief
DO $$
DECLARE
  job_record RECORD;
BEGIN
  FOR job_record IN 
    SELECT jobid, jobname 
    FROM cron.job 
    WHERE command LIKE '%generate-daily-brief%'
  LOOP
    PERFORM cron.unschedule(job_record.jobid);
    RAISE NOTICE 'Deleted cron job: % (ID: %)', job_record.jobname, job_record.jobid;
  END LOOP;
END $$;

-- Step 2: Create Morning Brief (Daily Mon-Sun at 10:00 UTC = 6 AM EDT)
SELECT cron.schedule(
  'generate-morning-brief-daily',
  '0 10 * * 1-7',
  $$
  SELECT net.http_post(
    url := 'https://odncvfiuzliyohxrsigc.supabase.co/functions/v1/generate-daily-brief',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9kbmN2Zml1emxpeW9oeHJzaWdjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg3Mzk4MjEsImV4cCI6MjA3NDMxNTgyMX0.7cnRatKpHqsylletKVel7WAprIYdpP85AXtXLswMYXQ',
      'x-cron-secret', current_setting('app.settings.cron_secret', true)
    ),
    body := jsonb_build_object(
      'briefType', 'morning',
      'cron_secret', current_setting('app.settings.cron_secret', true)
    )
  );
  $$
);

-- Step 3: Create Evening Brief (Mon-Sat at 20:30 UTC = 4:30 PM EDT)
SELECT cron.schedule(
  'generate-evening-brief-weekdays',
  '30 20 * * 1-6',
  $$
  SELECT net.http_post(
    url := 'https://odncvfiuzliyohxrsigc.supabase.co/functions/v1/generate-daily-brief',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9kbmN2Zml1emxpeW9oeHJzaWdjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg3Mzk4MjEsImV4cCI6MjA3NDMxNTgyMX0.7cnRatKpHqsylletKVel7WAprIYdpP85AXtXLswMYXQ',
      'x-cron-secret', current_setting('app.settings.cron_secret', true)
    ),
    body := jsonb_build_object(
      'briefType', 'evening',
      'cron_secret', current_setting('app.settings.cron_secret', true)
    )
  );
  $$
);

-- Step 4: Create Weekend Brief (Sunday only at 22:00 UTC = 6 PM EDT)
SELECT cron.schedule(
  'generate-weekend-brief-sunday',
  '0 22 * * 0',
  $$
  SELECT net.http_post(
    url := 'https://odncvfiuzliyohxrsigc.supabase.co/functions/v1/generate-daily-brief',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9kbmN2Zml1emxpeW9oeHJzaWdjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg3Mzk4MjEsImV4cCI6MjA3NDMxNTgyMX0.7cnRatKpHqsylletKVel7WAprIYdpP85AXtXLswMYXQ',
      'x-cron-secret', current_setting('app.settings.cron_secret', true)
    ),
    body := jsonb_build_object(
      'briefType', 'weekend',
      'cron_secret', current_setting('app.settings.cron_secret', true)
    )
  );
  $$
);

-- Step 5: Verify the jobs were created
DO $$
DECLARE
  job_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO job_count 
  FROM cron.job 
  WHERE command LIKE '%generate-daily-brief%';
  
  RAISE NOTICE 'Total cron jobs for generate-daily-brief: %', job_count;
  
  IF job_count != 3 THEN
    RAISE WARNING 'Expected 3 jobs but found %. Please check cron.job table.', job_count;
  ELSE
    RAISE NOTICE '✅ All 3 automated brief jobs created successfully!';
  END IF;
END $$;