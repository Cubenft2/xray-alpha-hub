-- Schedule massive-forex-snapshot every 1 minute
SELECT cron.schedule(
  'massive-forex-snapshot-every-1-min',
  '* * * * *',
  $$
  SELECT net.http_post(
    url:='https://odncvfiuzliyohxrsigc.supabase.co/functions/v1/massive-forex-snapshot',
    headers:=jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9kbmN2Zml1emxpeW9oeHJzaWdjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg3Mzk4MjEsImV4cCI6MjA3NDMxNTgyMX0.7cnRatKpHqsylletKVel7WAprIYdpP85AXtXLswMYXQ'
    ),
    body:='{}'::jsonb
  ) as request_id;
  $$
);

-- Schedule massive-forex-sync daily at 3 AM UTC
SELECT cron.schedule(
  'massive-forex-sync-daily-3am',
  '0 3 * * *',
  $$
  SELECT net.http_post(
    url:='https://odncvfiuzliyohxrsigc.supabase.co/functions/v1/massive-forex-sync',
    headers:=jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9kbmN2Zml1emxpeW9oeHJzaWdjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg3Mzk4MjEsImV4cCI6MjA3NDMxNTgyMX0.7cnRatKpHqsylletKVel7WAprIYdpP85AXtXLswMYXQ'
    ),
    body:='{}'::jsonb
  ) as request_id;
  $$
);