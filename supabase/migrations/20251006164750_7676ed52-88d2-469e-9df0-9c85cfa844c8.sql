-- ==========================================
-- Drop all existing brief cron jobs
-- ==========================================

SELECT cron.unschedule(8);   -- Old: generate-weekly-brief (Sunday 11 PM UTC)
SELECT cron.unschedule(14);  -- Old: generate-morning-brief (12 PM UTC, wrong key "type")
SELECT cron.unschedule(15);  -- Old: generate-evening-brief (8:15 PM UTC, wrong key "type")
SELECT cron.unschedule(16);  -- Old: generate-sunday-morning-brief (duplicate Sunday coverage)

-- ==========================================
-- Create new cron jobs with correct schedules and authentication
-- ==========================================

-- Morning Brief: Monday-Saturday at 7:30 AM ET (11:30 UTC during EDT)
SELECT cron.schedule(
  'generate-morning-brief-edt',
  '30 11 * * 1-6',
  $$
  SELECT net.http_post(
    url := 'https://odncvfiuzliyohxrsigc.supabase.co/functions/v1/generate-daily-brief',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9kbmN2Zml1emxpeW9oeHJzaWdjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg3Mzk4MjEsImV4cCI6MjA3NDMxNTgyMX0.7cnRatKpHqsylletKVel7WAprIYdpP85AXtXLswMYXQ'
    ),
    body := jsonb_build_object(
      'briefType', 'morning',
      'cron_secret', current_setting('supabase.vault.cron_secret', true)
    )
  );
  $$
);

-- Evening Brief: Monday-Saturday at 4:30 PM ET (20:30 UTC during EDT)
SELECT cron.schedule(
  'generate-evening-brief-edt',
  '30 20 * * 1-6',
  $$
  SELECT net.http_post(
    url := 'https://odncvfiuzliyohxrsigc.supabase.co/functions/v1/generate-daily-brief',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9kbmN2Zml1emxpeW9oeHJzaWdjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg3Mzk4MjEsImV4cCI6MjA3NDMxNTgyMX0.7cnRatKpHqsylletKVel7WAprIYdpP85AXtXLswMYXQ'
    ),
    body := jsonb_build_object(
      'briefType', 'evening',
      'cron_secret', current_setting('supabase.vault.cron_secret', true)
    )
  );
  $$
);

-- Weekend Brief: Sunday at 8:00 PM ET (Monday 00:00 UTC during EDT)
SELECT cron.schedule(
  'generate-weekend-brief-edt',
  '0 0 * * 1',
  $$
  SELECT net.http_post(
    url := 'https://odncvfiuzliyohxrsigc.supabase.co/functions/v1/generate-daily-brief',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9kbmN2Zml1emxpeW9oeHJzaWdjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg3Mzk4MjEsImV4cCI6MjA3NDMxNTgyMX0.7cnRatKpHqsylletKVel7WAprIYdpP85AXtXLswMYXQ'
    ),
    body := jsonb_build_object(
      'briefType', 'weekend',
      'cron_secret', current_setting('supabase.vault.cron_secret', true)
    )
  );
  $$
);