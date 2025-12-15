
-- Schedule polygon-stock-snapshot (every 5 minutes)
SELECT cron.schedule(
  'polygon-stock-snapshot-5min',
  '*/5 * * * *',
  $$SELECT net.http_post(
    url:='https://odncvfiuzliyohxrsigc.supabase.co/functions/v1/polygon-stock-snapshot',
    headers:=jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9kbmN2Zml1emxpeW9oeHJzaWdjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg3Mzk4MjEsImV4cCI6MjA3NDMxNTgyMX0.7cnRatKpHqsylletKVel7WAprIYdpP85AXtXLswMYXQ'),
    body:='{}'::jsonb
  ) AS request_id$$
);

-- Schedule sync-forex-cards-polygon (every 1 minute)
SELECT cron.schedule(
  'sync-forex-cards-polygon-1min',
  '* * * * *',
  $$SELECT net.http_post(
    url:='https://odncvfiuzliyohxrsigc.supabase.co/functions/v1/sync-forex-cards-polygon',
    headers:=jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9kbmN2Zml1emxpeW9oeHJzaWdjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg3Mzk4MjEsImV4cCI6MjA3NDMxNTgyMX0.7cnRatKpHqsylletKVel7WAprIYdpP85AXtXLswMYXQ'),
    body:='{}'::jsonb
  ) AS request_id$$
);
