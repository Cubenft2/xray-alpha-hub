-- Enable pg_cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Enable pg_net extension for HTTP requests
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Schedule premarket brief generation (12:00 PM UTC / 6:00 AM Denver time)
SELECT cron.schedule(
  'generate-premarket-brief',
  '0 12 * * *',
  $$
  SELECT
    net.http_post(
        url:='https://odncvfiuzliyohxrsigc.supabase.co/functions/v1/generate-daily-brief',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9kbmN2Zml1emxpeW9oeHJzaWdjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg3Mzk4MjEsImV4cCI6MjA3NDMxNTgyMX0.7cnRatKpHqsylletKVel7WAprIYdpP85AXtXLswMYXQ"}'::jsonb,
        body:='{"briefType": "premarket"}'::jsonb
    ) as request_id;
  $$
);

-- Schedule postmarket brief generation (8:15 PM UTC / 2:15 PM Denver time)
SELECT cron.schedule(
  'generate-postmarket-brief',
  '15 20 * * *',
  $$
  SELECT
    net.http_post(
        url:='https://odncvfiuzliyohxrsigc.supabase.co/functions/v1/generate-daily-brief',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9kbmN2Zml1emxpeW9oeHJzaWdjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg3Mzk4MjEsImV4cCI6MjA3NDMxNTgyMX0.7cnRatKpHqsylletKVel7WAprIYdpP85AXtXLswMYXQ"}'::jsonb,
        body:='{"briefType": "postmarket"}'::jsonb
    ) as request_id;
  $$
);

-- Schedule weekly comprehensive brief (11:00 PM UTC Sunday / 5:00 PM Denver time Sunday)
SELECT cron.schedule(
  'generate-weekly-brief',
  '0 23 * * 0',
  $$
  SELECT
    net.http_post(
        url:='https://odncvfiuzliyohxrsigc.supabase.co/functions/v1/generate-daily-brief',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9kbmN2Zml1emxpeW9oeHJzaWdjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg3Mzk4MjEsImV4cCI6MjA3NDMxNTgyMX0.7cnRatKpHqsylletKVel7WAprIYdpP85AXtXLswMYXQ"}'::jsonb,
        body:='{"briefType": "weekend"}'::jsonb
    ) as request_id;
  $$
);