-- Create pg_cron job for WebSocket sync (every 5 minutes)
SELECT cron.schedule(
  'sync-token-cards-websocket-5min',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url:='https://odncvfiuzliyohxrsigc.supabase.co/functions/v1/sync-token-cards-websocket',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9kbmN2Zml1emxpeW9oeHJzaWdjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg3Mzk4MjEsImV4cCI6MjA3NDMxNTgyMX0.7cnRatKpHqsylletKVel7WAprIYdpP85AXtXLswMYXQ"}'::jsonb,
    body:='{}'::jsonb
  ) as request_id;
  $$
)