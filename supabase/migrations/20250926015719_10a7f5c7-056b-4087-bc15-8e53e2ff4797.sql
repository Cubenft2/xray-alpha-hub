-- Enable pg_cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Schedule news-fetch function to run at 9 AM UTC daily
SELECT cron.schedule(
  'news-fetch-morning',
  '0 9 * * *',
  $$
  SELECT
    net.http_post(
        url:='https://odncvfiuzliyohxrsigc.supabase.co/functions/v1/news-fetch',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9kbmN2Zml1emxpeW9oeHJzaWdjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg3Mzk4MjEsImV4cCI6MjA3NDMxNTgyMX0.7cnRatKpHqsylletKVel7WAprIYdpP85AXtXLswMYXQ"}'::jsonb,
        body:=concat('{"scheduled": true, "session": "premarket", "time": "', now(), '"}')::jsonb
    ) as request_id;
  $$
);

-- Schedule news-fetch function to run at 9 PM UTC daily
SELECT cron.schedule(
  'news-fetch-evening',
  '0 21 * * *',
  $$
  SELECT
    net.http_post(
        url:='https://odncvfiuzliyohxrsigc.supabase.co/functions/v1/news-fetch',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9kbmN2Zml1emxpeW9oeHJzaWdjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg3Mzk4MjEsImV4cCI6MjA3NDMxNTgyMX0.7cnRatKpHqsylletKVel7WAprIYdpP85AXtXLswMYXQ"}'::jsonb,
        body:=concat('{"scheduled": true, "session": "postmarket", "time": "', now(), '"}')::jsonb
    ) as request_id;
  $$
);