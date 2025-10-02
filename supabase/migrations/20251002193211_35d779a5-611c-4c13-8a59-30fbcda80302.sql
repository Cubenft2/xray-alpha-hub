-- Clean up cron jobs: Keep only 3 briefs (Morning, Evening, Weekly)

-- Step 1: Remove duplicate/incorrect cron jobs
SELECT cron.unschedule('generate-premarket-brief');
SELECT cron.unschedule('generate-postmarket-brief');
SELECT cron.unschedule('generate-sunday-evening-brief');

-- Step 2: Update Morning Brief (12:00 UTC Mon-Fri)
SELECT cron.unschedule('generate-morning-brief');
SELECT cron.schedule(
  'generate-morning-brief',
  '0 12 * * 1-5',
  $$
  SELECT net.http_post(
    url:='https://odncvfiuzliyohxrsigc.supabase.co/functions/v1/generate-daily-brief',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9kbmN2Zml1emxpeW9oeHJzaWdjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg3Mzk4MjEsImV4cCI6MjA3NDMxNTgyMX0.7cnRatKpHqsylletKVel7WAprIYdpP85AXtXLswMYXQ"}'::jsonb,
    body:='{"scheduled": true, "briefType": "morning"}'::jsonb
  ) as request_id;
  $$
);

-- Step 3: Update Evening Brief (20:15 UTC Mon-Fri)
SELECT cron.unschedule('generate-evening-brief');
SELECT cron.schedule(
  'generate-evening-brief',
  '15 20 * * 1-5',
  $$
  SELECT net.http_post(
    url:='https://odncvfiuzliyohxrsigc.supabase.co/functions/v1/generate-daily-brief',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9kbmN2Zml1emxpeW9oeHJzaWdjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg3Mzk4MjEsImV4cCI6MjA3NDMxNTgyMX0.7cnRatKpHqsylletKVel7WAprIYdpP85AXtXLswMYXQ"}'::jsonb,
    body:='{"scheduled": true, "briefType": "evening"}'::jsonb
  ) as request_id;
  $$
);

-- Note: generate-weekly-brief (Sunday 23:00 UTC) is already correct and remains unchanged