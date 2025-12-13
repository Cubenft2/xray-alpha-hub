-- Delete the old hourly cron job
SELECT cron.unschedule('lunarcrush-hourly-sync');

-- Delete the broken SSE restart job (calls non-existent function)
SELECT cron.unschedule('lunarcrush-sse-restart');

-- Create new every-minute cron job for lunarcrush-sync
SELECT cron.schedule(
  'lunarcrush-sync-1min',
  '* * * * *',
  $$
  SELECT net.http_post(
    url:='https://odncvfiuzliyohxrsigc.supabase.co/functions/v1/lunarcrush-sync',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9kbmN2Zml1emxpeW9oeHJzaWdjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg3Mzk4MjEsImV4cCI6MjA3NDMxNTgyMX0.7cnRatKpHqsylletKVel7WAprIYdpP85AXtXLswMYXQ"}'::jsonb,
    body:=concat('{"time": "', now(), '"}')::jsonb
  ) as request_id;
  $$
);