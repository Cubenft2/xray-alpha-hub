-- ============================================================================
-- Fix lunarcrush-news cron job to pass CRON_SECRET
-- ============================================================================
-- The lunarcrush-news function requires CRON_SECRET in the request body,
-- but config.toml cron jobs don't send request bodies. This migration
-- creates a pg_cron job that can pass the secret properly.
-- ============================================================================

-- Step 1: Remove any existing pg_cron jobs for lunarcrush-news
DO $$
DECLARE
  job_record RECORD;
BEGIN
  FOR job_record IN 
    SELECT jobid, jobname 
    FROM cron.job 
    WHERE jobname LIKE '%lunarcrush-news%' OR command LIKE '%lunarcrush-news%'
  LOOP
    PERFORM cron.unschedule(job_record.jobid);
    RAISE NOTICE 'Deleted cron job: % (ID: %)', job_record.jobname, job_record.jobid;
  END LOOP;
END $$;

-- Step 2: Create pg_cron job for lunarcrush-news
-- Runs every 30 minutes at :12 and :42 (matching config.toml schedule)
SELECT cron.schedule(
  'lunarcrush-news-refresh',
  '12,42 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://odncvfiuzliyohxrsigc.supabase.co/functions/v1/lunarcrush-news',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9kbmN2Zml1emxpeW9oeHJzaWdjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg3Mzk4MjEsImV4cCI6MjA3NDMxNTgyMX0.7cnRatKpHqsylletKVel7WAprIYdpP85AXtXLswMYXQ'
    ),
    body := jsonb_build_object(
      'cronSecret', current_setting('app.settings.cron_secret', true)
    )
  ) AS request_id;
  $$
);

-- Step 3: Verify the job was created
DO $$
DECLARE
  job_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO job_count 
  FROM cron.job 
  WHERE jobname = 'lunarcrush-news-refresh';
  
  IF job_count = 1 THEN
    RAISE NOTICE '✅ Successfully created lunarcrush-news-refresh cron job';
  ELSE
    RAISE WARNING '⚠️ Expected 1 job but found %', job_count;
  END IF;
END $$;
