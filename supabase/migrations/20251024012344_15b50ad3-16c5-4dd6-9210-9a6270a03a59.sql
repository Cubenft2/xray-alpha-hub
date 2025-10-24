-- Schedule price-poller backup function to run every 15 seconds
-- This will activate when WebSocket relay fails
SELECT cron.schedule(
  'price-poller-backup',
  '*/15 * * * * *',
  $$
  SELECT
    net.http_post(
        url:='https://odncvfiuzliyohxrsigc.supabase.co/functions/v1/price-poller',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9kbmN2Zml1emxpeW9oeHJzaWdjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg3Mzk4MjEsImV4cCI6MjA3NDMxNTgyMX0.7cnRatKpHqsylletKVel7WAprIYdpP85AXtXLswMYXQ"}'::jsonb,
        body:='{"trigger": "cron"}'::jsonb
    ) as request_id;
  $$
);
