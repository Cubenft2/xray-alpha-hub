-- Unschedule old job
SELECT cron.unschedule('sync-token-cards-lunarcrush-enhanced');

-- Schedule new job: every 2 hours at minute 7 (avoids minute 0 collision)
-- 25 tokens × 4 endpoints = 100 API calls per run
-- 12 runs/day = 1,200 API calls/day (within 2,000 budget)
SELECT cron.schedule(
  'sync-token-cards-lunarcrush-enhanced',
  '7 */2 * * *',
  $$
  SELECT net.http_post(
    url := 'https://odncvfiuzliyohxrsigc.supabase.co/functions/v1/sync-token-cards-lunarcrush-enhanced',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9kbmN2Zml1emxpeW9oeHJzaWdjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg3Mzk4MjEsImV4cCI6MjA3NDMxNTgyMX0.7cnRatKpHqsylletKVel7WAprIYdpP85AXtXLswMYXQ"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);