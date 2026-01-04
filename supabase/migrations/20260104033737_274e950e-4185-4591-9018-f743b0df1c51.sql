-- Add Monday backup cron job to catch delayed COT releases (holidays, etc.)
-- Runs every Monday at 2:00 PM UTC (9 AM ET, after market open)
SELECT cron.schedule(
  'sync-cot-reports-monday-backup',
  '0 14 * * 1',
  $$
  SELECT net.http_post(
    url := 'https://odncvfiuzliyohxrsigc.supabase.co/functions/v1/sync-cot-reports',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9kbmN2Zml1emxpeW9oeHJzaWdjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg3Mzk4MjEsImV4cCI6MjA3NDMxNTgyMX0.7cnRatKpHqsylletKVel7WAprIYdpP85AXtXLswMYXQ"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);