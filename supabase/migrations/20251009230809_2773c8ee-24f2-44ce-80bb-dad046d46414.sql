-- Morning Brief: 7:00 AM EDT (11:00 AM UTC) Mon-Sat
SELECT cron.schedule(
  'generate-morning-brief',
  '0 11 * * 1-6',
  $$
  SELECT net.http_post(
    url := 'https://odncvfiuzliyohxrsigc.supabase.co/functions/v1/generate-daily-brief',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9kbmN2Zml1emxpeW9oeHJzaWdjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg3Mzk4MjEsImV4cCI6MjA3NDMxNTgyMX0.7cnRatKpHqsylletKVel7WAprIYdpP85AXtXLswMYXQ'
    ),
    body := jsonb_build_object(
      'briefType', 'morning',
      'cron_secret', current_setting('app.settings.cron_secret', true)
    )
  );
  $$
);

-- Evening Brief: 4:30 PM EDT (8:30 PM UTC) Mon-Sat
SELECT cron.schedule(
  'generate-evening-brief',
  '30 20 * * 1-6',
  $$
  SELECT net.http_post(
    url := 'https://odncvfiuzliyohxrsigc.supabase.co/functions/v1/generate-daily-brief',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9kbmN2Zml1emxpeW9oeHJzaWdjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg3Mzk4MjEsImV4cCI6MjA3NDMxNTgyMX0.7cnRatKpHqsylletKVel7WAprIYdpP85AXtXLswMYXQ'
    ),
    body := jsonb_build_object(
      'briefType', 'evening',
      'cron_secret', current_setting('app.settings.cron_secret', true)
    )
  );
  $$
);

-- Sunday Week Recap: 6:00 PM EDT (10:00 PM UTC) Sunday
SELECT cron.schedule(
  'generate-weekend-brief',
  '0 22 * * 0',
  $$
  SELECT net.http_post(
    url := 'https://odncvfiuzliyohxrsigc.supabase.co/functions/v1/generate-daily-brief',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9kbmN2Zml1emxpeW9oeHJzaWdjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg3Mzk4MjEsImV4cCI6MjA3NDMxNTgyMX0.7cnRatKpHqsylletKVel7WAprIYdpP85AXtXLswMYXQ'
    ),
    body := jsonb_build_object(
      'briefType', 'weekend',
      'cron_secret', current_setting('app.settings.cron_secret', true)
    )
  );
  $$
);