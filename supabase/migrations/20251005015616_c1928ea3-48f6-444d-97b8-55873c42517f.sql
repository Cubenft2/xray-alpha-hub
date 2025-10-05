-- Update cron jobs to include Saturday morning/evening briefs and Sunday morning brief

-- Unschedule existing morning and evening brief jobs
SELECT cron.unschedule('generate-morning-brief');
SELECT cron.unschedule('generate-evening-brief');

-- Reschedule morning brief for Mon-Sat (12:00 UTC)
SELECT cron.schedule(
  'generate-morning-brief',
  '0 12 * * 1-6',
  $$
  SELECT net.http_post(
    url:='https://odncvfiuzliyohxrsigc.supabase.co/functions/v1/generate-daily-brief',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9kbmN2Zml1emxpeW9oeHJzaWdjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg3Mzk4MjEsImV4cCI6MjA3NDMxNTgyMX0.7cnRatKpHqsylletKVel7WAprIYdpP85AXtXLswMYXQ"}'::jsonb,
    body:='{"type": "morning"}'::jsonb
  ) as request_id;
  $$
);

-- Reschedule evening brief for Mon-Sat (20:15 UTC)
SELECT cron.schedule(
  'generate-evening-brief',
  '15 20 * * 1-6',
  $$
  SELECT net.http_post(
    url:='https://odncvfiuzliyohxrsigc.supabase.co/functions/v1/generate-daily-brief',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9kbmN2Zml1emxpeW9oeHJzaWdjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg3Mzk4MjEsImV4cCI6MjA3NDMxNTgyMX0.7cnRatKpHqsylletKVel7WAprIYdpP85AXtXLswMYXQ"}'::jsonb,
    body:='{"type": "evening"}'::jsonb
  ) as request_id;
  $$
);

-- Add new Sunday morning brief (12:00 UTC)
SELECT cron.schedule(
  'generate-sunday-morning-brief',
  '0 12 * * 0',
  $$
  SELECT net.http_post(
    url:='https://odncvfiuzliyohxrsigc.supabase.co/functions/v1/generate-daily-brief',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9kbmN2Zml1emxpeW9oeHJzaWdjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg3Mzk4MjEsImV4cCI6MjA3NDMxNTgyMX0.7cnRatKpHqsylletKVel7WAprIYdpP85AXtXLswMYXQ"}'::jsonb,
    body:='{"type": "morning"}'::jsonb
  ) as request_id;
  $$
);