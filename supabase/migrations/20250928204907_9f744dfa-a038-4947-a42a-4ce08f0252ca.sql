-- Set up cron jobs for daily market briefs

-- Morning brief at 8:00 AM EST (13:00 UTC) - before market opens
SELECT cron.schedule(
  'generate-morning-brief',
  '0 13 * * 1-5', -- Monday to Friday at 13:00 UTC (8:00 AM EST)
  $$
  SELECT
    net.http_post(
        url:='https://odncvfiuzliyohxrsigc.supabase.co/functions/v1/generate-daily-brief',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9kbmN2Zml1emxpeW9oeHJzaWdjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg3Mzk4MjEsImV4cCI6MjA3NDMxNTgyMX0.7cnRatKpHqsylletKVel7WAprIYdpP85AXtXLswMYXQ"}'::jsonb,
        body:=concat('{"scheduled": true, "briefType": "premarket", "time": "', now(), '"}')::jsonb
    ) as request_id;
  $$
);

-- Evening brief at 6:00 PM EST (23:00 UTC) - after market closes
SELECT cron.schedule(
  'generate-evening-brief',
  '0 23 * * 1-5', -- Monday to Friday at 23:00 UTC (6:00 PM EST)
  $$
  SELECT
    net.http_post(
        url:='https://odncvfiuzliyohxrsigc.supabase.co/functions/v1/generate-daily-brief',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9kbmN2Zml1emxpeW9oeHJzaWdjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg3Mzk4MjEsImV4cCI6MjA3NDMxNTgyMX0.7cnRatKpHqsylletKVel7WAprIYdpP85AXtXLswMYXQ"}'::jsonb,
        body:=concat('{"scheduled": true, "briefType": "postmarket", "time": "', now(), '"}')::jsonb
    ) as request_id;
  $$
);

-- Sunday evening brief at 8:00 PM EST (Monday 1:00 UTC) - week ahead preview
SELECT cron.schedule(
  'generate-sunday-evening-brief',
  '0 1 * * 1', -- Monday at 1:00 UTC (Sunday 8:00 PM EST)
  $$
  SELECT
    net.http_post(
        url:='https://odncvfiuzliyohxrsigc.supabase.co/functions/v1/generate-daily-brief',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9kbmN2Zml1emxpeW9oeHJzaWdjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg3Mzk4MjEsImV4cCI6MjA3NDMxNTgyMX0.7cnRatKpHqsylletKVel7WAprIYdpP85AXtXLswMYXQ"}'::jsonb,
        body:=concat('{"scheduled": true, "briefType": "weekend", "time": "', now(), '"}')::jsonb
    ) as request_id;
  $$
);