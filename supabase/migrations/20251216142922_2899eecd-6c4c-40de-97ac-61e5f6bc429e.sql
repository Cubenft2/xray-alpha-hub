-- Disable redundant massive-forex-snapshot cron (writes to live_prices, not forex_cards)
SELECT cron.unschedule('massive-forex-snapshot-every-1-min');

-- Schedule new forex technicals sync every 15 minutes
SELECT cron.schedule(
  'sync-forex-cards-technicals-15min',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://odncvfiuzliyohxrsigc.supabase.co/functions/v1/sync-forex-cards-technicals',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9kbmN2Zml1emxpeW9oeHJzaWdjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg3Mzk4MjEsImV4cCI6MjA3NDMxNTgyMX0.7cnRatKpHqsylletKVel7WAprIYdpP85AXtXLswMYXQ"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);